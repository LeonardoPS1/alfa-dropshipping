import assert from 'node:assert/strict';
import { isIP } from 'node:net';
import { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import express from 'express';
import { createChatRouter } from '../src/routes/chat';
import { ChatMessage, LlmResponse } from '../src/llm/client';
import { McpSubagent } from '../src/mcp/registry';
import { createProductApp } from '../../subagent-producto/src/server';
import { searchDropiCatalog } from '../../subagent-producto/src/tools/searchDropiCatalog';
import { scoreProduct } from '../../subagent-producto/src/tools/scoreProduct';
import { queryPipeline, Query } from '../../dashboard/src/lib/pipelineQuery';

const ALLOWED_TOOLS = ['search_dropi_catalog', 'score_product'];

export interface SmokeDatabaseConfig {
  connectionString: string;
  databaseName: string;
}

export async function seedSmokeTenant(query: Query, tenantId: string, runId: string): Promise<void> {
  const result = await query<{ id: string }>(
    'INSERT INTO tenants (id, name) VALUES ($1, $2) RETURNING id',
    [tenantId, `controlled-smoke-${runId}`],
  );
  if (result.rows[0]?.id !== tenantId) throw new Error('Smoke tenant seed did not return the requested tenant');
}

export function loadSmokeDatabaseConfig(env: Record<string, string | undefined> = process.env): SmokeDatabaseConfig {
  const connectionString = env.ALFA_SMOKE_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('ALFA_SMOKE_DATABASE_URL is required; DATABASE_URL is never used by this harness');
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('ALFA_SMOKE_DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('ALFA_SMOKE_DATABASE_URL must use PostgreSQL');
  }
  if (!isLoopbackHost(parsed.hostname)) {
    throw new Error('ALFA_SMOKE_DATABASE_URL must target loopback; remote hosts are not accepted');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!databaseName || !/(?:smoke|test|disposable)/i.test(databaseName)) {
    throw new Error('ALFA_SMOKE_DATABASE_URL must name an explicitly disposable smoke, test, or disposable database');
  }

  return { connectionString, databaseName };
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host === '::1') return true;
  if (isIP(host) === 4) return host.startsWith('127.');
  return false;
}

function makeToolResponse(id: string, name: string, args: Record<string, unknown>): LlmResponse {
  const wireCall = {
    id,
    type: 'function' as const,
    function: { name, arguments: JSON.stringify(args) },
  };
  return {
    content: null,
    toolCalls: [{ id, type: 'function', name, arguments: wireCall.function.arguments }],
    assistantMessage: { role: 'assistant', content: null, tool_calls: [wireCall] },
  };
}

async function stopServer(server: ReturnType<express.Express['listen']> | undefined): Promise<void> {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

export async function runDiscoverySmoke(env: Record<string, string | undefined> = process.env) {
  const databaseConfig = loadSmokeDatabaseConfig(env);
  const runId = randomUUID();
  const requestId = randomUUID();
  const tenantId = runId;
  const dashboardToken = randomUUID();
  const productToken = randomUUID();
  if (dashboardToken === productToken) throw new Error('Smoke credentials must be distinct');

  const database = new Pool({ connectionString: databaseConfig.connectionString, max: 3 });
  let productServer: ReturnType<express.Express['listen']> | undefined;
  let orchestratorServer: ReturnType<express.Express['listen']> | undefined;
  let phase = 'database_preflight';
  let forbiddenTransportCalls = 0;
  let providerTurn = 0;
  let productId: string | undefined;
  const originalProductUrl = process.env.MCP_PRODUCTO_URL;

  const query: Query = async <Row = Record<string, unknown>>(sql: string, values: unknown[]) => {
    const result = await database.query(sql, values);
    return { rows: result.rows as Row[] };
  };

  try {
    const identity = await database.query<{ database_name: string }>('SELECT current_database() AS database_name');
    assert.equal(identity.rows[0]?.database_name, databaseConfig.databaseName, 'connected database differs from explicit smoke target');
    const requiredTables = await database.query<{ tenants: string | null; products: string | null; evaluations: string | null; agent_logs: string | null }>(
      `SELECT to_regclass('public.tenants')::text AS tenants,
              to_regclass('public.products')::text AS products,
              to_regclass('public.evaluations')::text AS evaluations,
              to_regclass('public.agent_logs')::text AS agent_logs`,
    );
    assert.ok(requiredTables.rows[0]?.tenants && requiredTables.rows[0]?.products && requiredTables.rows[0]?.evaluations && requiredTables.rows[0]?.agent_logs,
      'discovery smoke requires tenant, discovery, evaluation, and audit tables to be present');

    phase = 'smoke_tenant_seed';
    await seedSmokeTenant(query, tenantId, runId);

    phase = 'product_fixture_server';
    const fixture = {
      external_id: `smoke-${runId}`,
      source_url: `https://fixture.invalid/products/${runId}`,
      name: 'Deterministic smoke product',
      supplier_price: 12990,
      category: 'fixture',
      shipping_days_estimate: null,
    };
    const productApp = createProductApp({
      discoveryToken: productToken,
      searchDropiCatalog: (input) => searchDropiCatalog(input, {
        query: (sql, values = []) => query(sql, values),
        scrape: async () => [fixture],
      }),
      scoreProduct: (input) => scoreProduct(input, { query: (sql, values = []) => query(sql, values) }),
    });
    productServer = productApp.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      productServer!.once('listening', resolve);
      productServer!.once('error', reject);
    });
    const productAddress = productServer.address() as AddressInfo;
    const productUrl = `http://127.0.0.1:${productAddress.port}`;

    phase = 'chat_to_product_to_pipeline';
    const orchestratorApp = express();
    orchestratorApp.use(express.json());
    const config = {
      internalToken: dashboardToken,
      tenantId,
      productToken,
      productUrl,
    };
    orchestratorApp.use('/chat', createChatRouter({
      config,
      callLlm: async (messages: ChatMessage[], tools): Promise<LlmResponse> => {
        providerTurn += 1;
        const exposedNames = tools.map((tool) => tool.name);
        assert.deepEqual(exposedNames, ALLOWED_TOOLS, 'provider received a non-allowlisted tool schema');
        if (providerTurn === 1) return makeToolResponse('smoke-search', 'search_dropi_catalog', { query: 'fixture product' });
        if (providerTurn === 2) {
          const lastToolMessage = [...messages].reverse().find((message) => message.role === 'tool');
          assert.ok(lastToolMessage, 'search result was not linked into the provider transcript');
          const result = JSON.parse(lastToolMessage.content ?? '{}');
          productId = result.products?.[0]?.id;
          assert.ok(productId, 'product discovery did not return an internal identity');
          return makeToolResponse('smoke-score', 'score_product', { product_id: productId });
        }
        assert.equal(providerTurn, 3, 'controlled smoke unexpectedly required additional provider turns');
        return { content: 'Deterministic discovery smoke completed.', toolCalls: [], assistantMessage: { role: 'assistant', content: 'Deterministic discovery smoke completed.' } };
      },
      callTool: async (subagent: McpSubagent, toolName: string, params: Record<string, unknown>, token: string) => {
        if (subagent.key !== 'producto' || !ALLOWED_TOOLS.includes(toolName)) {
          forbiddenTransportCalls += 1;
          throw new Error('Forbidden smoke transport was blocked');
        }
        const { buildProductToolRequest } = await import('../src/mcp/client');
        const request = buildProductToolRequest({ ...subagent, baseUrl: productUrl }, toolName, params, token);
        const response = await fetch(request.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...request.headers },
          body: JSON.stringify(request.body),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Product fixture returned HTTP ${response.status}`);
        return body;
      },
      logAgentCall: async (event) => {
        await query(
          `INSERT INTO agent_logs (tenant_id, subagent, tool_name, input, output, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [event.tenantId, event.subagent, event.toolName, JSON.stringify(event.input), JSON.stringify(event.output), JSON.stringify(event.metadata ?? {})],
        );
      },
    }));
    orchestratorServer = orchestratorApp.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      orchestratorServer!.once('listening', resolve);
      orchestratorServer!.once('error', reject);
    });
    const orchestratorAddress = orchestratorServer.address() as AddressInfo;
    phase = 'chat_http_outcome';
    const response = await fetch(`http://127.0.0.1:${orchestratorAddress.port}/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Alfa-Internal-Token': dashboardToken,
        'X-Alfa-Tenant-Id': tenantId,
        'X-Alfa-Request-Id': requestId,
      },
      body: JSON.stringify({ message: 'Discover the deterministic fixture product.' }),
    });
    assert.equal(response.status, 200, 'orchestrator did not complete the controlled chat journey');
    assert.equal((await response.json() as { reply?: string }).reply, 'Deterministic discovery smoke completed.');
    phase = 'forbidden_transport_guard';
    assert.equal(forbiddenTransportCalls, 0, 'a forbidden transport was invoked');
    assert.equal(providerTurn, 3, 'expected two allowlisted tool calls and a final response');

    phase = 'dashboard_pipeline_read';
    const pipeline = await queryPipeline(tenantId, query);
    assert.equal(pipeline.length, 1, 'pipeline did not return exactly the fixture product for this isolated tenant');
    assert.equal(pipeline[0].id, productId);
    assert.ok(pipeline[0].evaluation_id, 'score_product did not persist an evaluation');
    assert.equal(pipeline[0].evaluation_status, 'incomplete');
    assert.equal(pipeline[0].evaluation_score, null, 'incomplete evidence must not produce a fabricated total score');
    assert.equal((pipeline[0].catalog_price_evidence as { status?: string } | null)?.status, 'observed');

    phase = 'audit_linkage';
    const audit = await database.query<{ request_id: string }>(
      `SELECT metadata ->> 'request_id' AS request_id
       FROM agent_logs WHERE tenant_id = $1 AND metadata ->> 'request_id' = $2`,
      [tenantId, requestId],
    );
    assert.equal(audit.rows.length, 2, 'expected one audit row for discovery and one for evaluation');

    return {
      mode: 'deterministic provider and catalog fixtures',
      runId,
      status: 'passed',
      journey: 'chat -> product discovery -> evaluation -> dashboard pipeline query',
      results: {
        providerTurns: providerTurn,
        toolCalls: 2,
        products: pipeline.length,
        evaluations: 1,
        evaluationStatus: pipeline[0].evaluation_status,
        evaluationScore: pipeline[0].evaluation_score,
        auditRows: audit.rows.length,
        forbiddenTransportCalls,
      },
      skippedLiveIntegrations: ['Dropi live catalog', 'LLM provider', 'Shopify', 'Ads', 'social publishing', 'n8n mutations'],
    };
  } catch (error) {
    const candidate = error as { code?: unknown; name?: unknown };
    const errorCode = typeof candidate.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(candidate.code)
      ? candidate.code
      : typeof candidate.name === 'string' && /^[A-Za-z0-9]{1,32}$/.test(candidate.name)
        ? candidate.name
        : 'SmokeAssertionFailed';
    throw Object.assign(new Error(`Discovery smoke failed in ${phase} (${errorCode})`), { phase, errorCode, runId });
  } finally {
    if (originalProductUrl === undefined) delete process.env.MCP_PRODUCTO_URL;
    else process.env.MCP_PRODUCTO_URL = originalProductUrl;
    await stopServer(orchestratorServer);
    await stopServer(productServer);
    await database.end();
  }
}

async function main(): Promise<void> {
  const runId = randomUUID();
  try {
    const result = await runDiscoverySmoke();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const failure = error as { phase?: unknown; errorCode?: unknown; runId?: unknown };
    const missingUrl = error instanceof Error && error.message.includes('ALFA_SMOKE_DATABASE_URL is required');
    console.error(JSON.stringify({
      mode: 'deterministic provider and catalog fixtures',
      runId: typeof failure.runId === 'string' ? failure.runId : runId,
      status: 'failed',
      failedArea: typeof failure.phase === 'string' ? failure.phase : 'configuration',
      errorCode: typeof failure.errorCode === 'string' ? failure.errorCode : missingUrl ? 'ALFA_SMOKE_DATABASE_URL_REQUIRED' : 'SmokeConfigurationFailed',
      skippedLiveIntegrations: ['Dropi live catalog', 'LLM provider', 'Shopify', 'Ads', 'social publishing', 'n8n mutations'],
    }, null, 2));
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
