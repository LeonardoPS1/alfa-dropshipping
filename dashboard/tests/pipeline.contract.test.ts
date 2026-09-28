import assert from 'node:assert/strict';
import test from 'node:test';
import * as auth from '../src/lib/tenantContext';
import * as detail from '../src/lib/productDetail';
import * as pipeline from '../src/lib/pipelineQuery';
import * as pipelineRoute from '../src/lib/pipelineRead';
import * as chatRoute from '../src/lib/chatProxy';
import * as chatClient from '../src/lib/orchestratorClient';
import * as evidenceDisplay from '../src/lib/evidenceDisplay';
import { runPostgresTenantIsolationScenario } from './helpers/postgres-pipeline.integration';

const tenantA = '00000000-0000-0000-0000-00000000000a';
const tenantB = '00000000-0000-0000-0000-00000000000b';

test('authenticated single-admin session resolves only the configured server tenant', () => {
  assert.equal(typeof auth.resolveTenantId, 'function');
  assert.equal(auth.resolveTenantId?.({ user: { id: '1' } } as never, tenantA), tenantA);
  assert.throws(() => auth.resolveTenantId?.(null, tenantA), /session/i);
  assert.throws(() => auth.resolveTenantId?.({ user: { id: '1' } } as never, 'not-a-uuid'), /tenant/i);
});

test('pipeline read rejects unauthenticated requests before querying and ignores caller tenant input', async () => {
  assert.equal(typeof pipelineRoute.readPipelineRequest, 'function');
  let queryCount = 0;
  const handler = pipelineRoute.readPipelineRequest?.({
    getSession: async () => null,
    resolveTenant: () => tenantA,
    readPipeline: async () => { queryCount += 1; return []; },
  });
  const unauthenticated = await handler!(null);
  assert.equal(unauthenticated.status, 401);
  assert.equal(queryCount, 0);

  const authenticatedHandler = pipelineRoute.readPipelineRequest?.({
    getSession: async () => ({ user: { id: '1' } }),
    resolveTenant: () => tenantA,
    readPipeline: async (tenantId: string) => { assert.equal(tenantId, tenantA); return []; },
  });
  const response = await authenticatedHandler!({ tenant_id: tenantB });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { columns: { discovered_incomplete: [], evaluado: [], creativos_listos: [], publicado: [], en_campana: [], pausado: [] } });
});

test('pipeline SQL selects declared fields and tenant-scopes products, latest evaluations, and related rows', async () => {
  assert.equal(typeof pipeline.queryPipeline, 'function');
  let statement = '';
  let values: unknown[] = [];
  await pipeline.queryPipeline?.(tenantA, async (sql: string, parameters: unknown[]) => {
    statement = sql;
    values = parameters;
    return { rows: [] };
  });

  assert.deepEqual(values, [tenantA]);
  assert.match(statement, /p\.tenant_id\s*=\s*\$1/i);
  assert.match(statement, /e\.tenant_id\s*=\s*p\.tenant_id/i);
  assert.match(statement, /campaign\.tenant_id\s*=\s*p\.tenant_id/i);
  assert.match(statement, /image\.tenant_id\s*=\s*p\.tenant_id/i);
  assert.match(statement, /copy\.tenant_id\s*=\s*p\.tenant_id/i);
  assert.match(statement, /p\.raw_data/i);
  assert.match(statement, /e\.evidence/i);
  assert.doesNotMatch(statement, /p\.total_score/i);
  assert.doesNotMatch(statement, /\b(?:INSERT|UPDATE|DELETE|CALL)\b/i);
});

test('pipeline preserves evaluation evidence first and discovery evidence as fallback', async () => {
  assert.equal(typeof pipeline.queryPipeline, 'function');
  const observed = { status: 'observed', value: 12.5, source: 'dropi', source_id: 'sku-a' };
  const discovery = { status: 'estimated', value: 13, source: 'catalog estimate' };
  const rows = [
    { id: 'evaluated', evaluation_id: 'eval-a', evaluation_status: 'incomplete', source: 'dropi', source_id: 'sku-a', evaluation_evidence: { catalog_price: observed }, discovery_evidence: discovery },
    { id: 'discovered', evaluation_id: null, evaluation_status: 'discovered', source: 'dropi', source_id: 'sku-b', evaluation_evidence: null, discovery_evidence: discovery },
  ];
  const result = await pipeline.queryPipeline?.(tenantA, async () => ({ rows }));
  assert.equal(result?.[0].catalog_price_evidence, observed);
  assert.equal(result?.[0].evaluation_id, 'eval-a');
  assert.equal(result?.[0].evaluation_status, 'incomplete');
  assert.equal(result?.[1].catalog_price_evidence, discovery);
  assert.equal(result?.[1].evaluation_status, 'discovered');
});

test('pipeline read distinguishes a successful empty read from database failure', async () => {
  assert.equal(typeof pipelineRoute.readPipelineRequest, 'function');
  const options = { getSession: async () => ({ user: { id: '1' } }), resolveTenant: () => tenantA };
  const empty = pipelineRoute.readPipelineRequest?.({ ...options, readPipeline: async () => [] });
  assert.equal((await empty!(undefined)).status, 200);

  const failed = pipelineRoute.readPipelineRequest?.({ ...options, readPipeline: async () => { throw new Error('database unavailable'); } });
  const response = await failed!(undefined);
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: 'Pipeline unavailable' });
});

test('discovered and incomplete products remain visible instead of disappearing from the board', async () => {
  const handler = pipelineRoute.readPipelineRequest?.({
    getSession: async () => ({ user: { id: '1' } }),
    resolveTenant: () => tenantA,
    readPipeline: async () => [
      { id: 'discovered', evaluation_status: 'discovered' },
      { id: 'incomplete', evaluation_status: 'incomplete' },
      { id: 'evaluated', evaluation_status: 'evaluated' },
    ] as never,
  });
  const response = await handler!(undefined);
  assert.ok('columns' in response.body);
  assert.deepEqual(response.body.columns.discovered_incomplete.map((row) => row.id), ['discovered', 'incomplete']);
  assert.deepEqual(response.body.columns.evaluado.map((row) => row.id), ['evaluated']);
});

test('product detail and every related-record query are scoped to the trusted tenant', async () => {
  assert.equal(typeof detail.queryProductDetail, 'function');
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  await detail.queryProductDetail?.('product-a', tenantA, async (sql: string, values: unknown[]) => {
    statements.push({ sql, values });
    return { rows: [] };
  });
  assert.equal(statements.length, 6);
  for (const { sql, values } of statements) {
    assert.deepEqual(values, ['product-a', tenantA]);
    assert.match(sql, /tenant_id\s*=\s*\$2/i);
    assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|CALL)\b/i);
  }
  assert.match(statements[0].sql, /id\s*=\s*\$1/i);
});

test('evidence display retains status and provenance and renders unavailable without a fabricated number', () => {
  assert.equal(typeof evidenceDisplay.describeEvidence, 'function');
  assert.deepEqual(evidenceDisplay.describeEvidence?.({ status: 'observed', value: 15, source: 'dropi', source_id: 'p-1' }), {
    label: '15', status: 'observed', provenance: 'dropi · p-1',
  });
  assert.deepEqual(evidenceDisplay.describeEvidence?.({ status: 'unavailable', value: null, source: 'dropi', reason: 'not observed' }), {
    label: 'Unavailable', status: 'unavailable', provenance: 'dropi · not observed',
  });
});

test('chat proxy requires session, ignores browser tenant authority, and preserves partial orchestrator outcomes', async () => {
  assert.equal(typeof chatRoute.proxyChatRequest, 'function');
  const calls: unknown[][] = [];
  const handler = chatRoute.proxyChatRequest?.({
    getSession: async () => ({ user: { id: '1' } }),
    resolveTenant: () => tenantA,
    createRequestId: () => 'request-id',
    sendMessage: async (...args: unknown[]) => { calls.push(args); return { status: 'partial', reply: 'Partial result', failed: ['catalog'] }; },
  });
  const response = await handler!({ message: 'Find products', tenant_id: tenantB });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'partial', reply: 'Partial result', failed: ['catalog'] });
  assert.deepEqual(calls, [[tenantA, 'request-id', 'Find products']]);

  const denied = chatRoute.proxyChatRequest?.({ getSession: async () => null, resolveTenant: () => tenantA, createRequestId: () => 'unused', sendMessage: async () => { throw new Error('must not call'); } });
  assert.equal((await denied!(undefined)).status, 401);
});

test('orchestrator client sends trusted headers and no caller-selected tenant body field', async () => {
  assert.equal(typeof chatClient.sendChatMessage, 'function');
  let request: { url: string; data: unknown; headers: Record<string, string> } | undefined;
  await chatClient.sendChatMessage?.(tenantA, 'request-id', 'Find products', {
    internalToken: 'server-secret',
    post: async (url: string, data: unknown, headers: Record<string, string>) => {
      request = { url, data, headers };
      return { data: { status: 'complete', reply: 'Done' } };
    },
  });
  assert.equal(request?.url, '/chat');
  assert.deepEqual(request?.data, { message: 'Find products' });
  assert.equal(request?.headers['X-Alfa-Internal-Token'], 'server-secret');
  assert.equal(request?.headers['X-Tenant-ID'], tenantA);
  assert.equal(request?.headers['X-Request-ID'], 'request-id');
});

test('orchestrator client fails closed without its internal credential and preserves non-success response bodies', async () => {
  await assert.rejects(() => chatClient.sendChatMessage?.(tenantA, 'request-id', 'Find products', {
    internalToken: '',
    post: async () => { throw new Error('must not dispatch'); },
  }), /credential/i);

  const failed = await chatClient.sendChatMessage?.(tenantA, 'request-id', 'Find products', {
    internalToken: 'server-secret',
    post: async () => ({ status: 502, data: { status: 'partial', error: 'audit unavailable' } }),
  });
  assert.deepEqual(failed, { status: 502, body: { status: 'partial', error: 'audit unavailable' } });
});

test('disposable PostgreSQL harness rejects remote hosts before opening a connection', async () => {
  await assert.rejects(
    () => runPostgresTenantIsolationScenario('postgres://user:pass@production.example/alfa_test'),
    /loopback-only/i
  );
});

test('guarded disposable PostgreSQL scenario proves tenant-isolated pipeline and detail reads', { skip: !process.env.LOCAL_TEST_DATABASE_URL }, async () => {
  await runPostgresTenantIsolationScenario(process.env.LOCAL_TEST_DATABASE_URL!);
});
