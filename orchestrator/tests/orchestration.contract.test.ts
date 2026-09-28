import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import express from 'express';
import { AddressInfo } from 'node:net';

const chat = require('../src/routes/chat') as Record<string, any>;
const { sanitize } = require('../src/db/pool') as { sanitize: (value: unknown) => unknown };
const token = 'orchestrator-audit-test-token';
const productToken = 'separate-product-service-token';
const tenantId = '11111111-1111-4111-8111-111111111111';
const requestId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';

function wireCall(name: string, args: unknown, id = 'call-1') {
  return { id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } };
}

function providerResult(calls: ReturnType<typeof wireCall>[] = [], content: string | null = null) {
  return {
    content,
    toolCalls: calls.map((call) => ({ id: call.id, type: call.type, name: call.function.name, arguments: call.function.arguments })),
    assistantMessage: { role: 'assistant', content, ...(calls.length ? { tool_calls: calls } : {}) },
  };
}

let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
let providerCalls = 0;
let tools: Array<{ subagent: any; name: string; params: Record<string, unknown>; productToken: string }> = [];
let auditEvents: any[] = [];
let provider: (...args: any[]) => Promise<any> = async () => providerResult([], 'No results');
let invokeTool: (...args: any[]) => Promise<any> = async () => ({ products: [{ id: productId }] });
let audit: (...args: any[]) => Promise<void> = async (event) => { auditEvents.push(event); };

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/chat', chat.createChatRouter({
    config: {
      internalToken: token,
      tenantId,
      productToken,
      productUrl: 'http://producto.test',
    },
    callLlm: (...args: any[]) => provider(...args),
    callTool: (...args: any[]) => invokeTool(...args),
    logAgentCall: (event: any) => audit(event),
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/chat`;
}

async function post(url: string, body = { message: 'Find a product' }) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Alfa-Internal-Token': token,
      'X-Alfa-Tenant-Id': tenantId,
      'X-Alfa-Request-Id': requestId,
    },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
  providerCalls = 0;
  tools = [];
  auditEvents = [];
  provider = async () => providerResult([], 'No results');
  invokeTool = async () => ({ products: [{ id: productId }] });
  audit = async (event) => { auditEvents.push(event); };
});

test('chat loop binds trusted tool context, retains linked transcript, and returns final provider answer', async () => {
  const url = await startServer();
  const call = wireCall('search_dropi_catalog', { query: 'lamp' });
  let nextMessages: any[] = [];
  provider = async (messages) => {
    providerCalls += 1;
    nextMessages = messages;
    return providerCalls === 1 ? providerResult([call]) : providerResult([], 'Found one');
  };
  invokeTool = async (subagent, name, params, suppliedToken) => {
    tools.push({ subagent, name, params, productToken: suppliedToken });
    return { products: [{ id: productId }] };
  };
  const response = await post(url);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: 'Found one', attachments: [] });
  assert.equal(providerCalls, 2);
  assert.equal(tools.length, 1);
  assert.equal(tools[0].subagent.key, 'producto');
  assert.equal(tools[0].params.tenant_id, tenantId);
  assert.equal(tools[0].params.request_id, requestId);
  assert.equal(tools[0].productToken, productToken);
  assert.deepEqual(nextMessages[2], { role: 'assistant', content: null, tool_calls: [call] });
  assert.equal(nextMessages[3].tool_call_id, call.id);
  assert.equal(nextMessages[3].name, call.function.name);
  assert.equal(JSON.parse(nextMessages[3].content).products[0].id, productId);
  assert.equal(JSON.stringify(nextMessages).includes(token), false);
});

test('malformed or forbidden provider batches fail atomically without a tool call or next provider turn', async (t) => {
  const cases = [
    { label: 'forbidden capability', calls: [wireCall('publish_product', {})] },
    { label: 'malformed JSON', calls: [{ ...wireCall('search_dropi_catalog', {}), function: { name: 'search_dropi_catalog', arguments: '{' } }] },
    { label: 'unexpected tenant field', calls: [wireCall('search_dropi_catalog', { query: 'lamp', tenant_id: tenantId })] },
    { label: 'duplicate call IDs', calls: [wireCall('search_dropi_catalog', { query: 'one' }, 'dup'), wireCall('score_product', { product_id: productId }, 'dup')] },
  ];
  for (const item of cases) {
    await t.test(item.label, async () => {
      const url = await startServer();
      provider = async () => { providerCalls += 1; return providerResult(item.calls); };
      const response = await post(url);
      assert.equal(response.status, 422);
      assert.equal(providerCalls, 1);
      assert.equal(tools.length, 0);
      assert.equal(auditEvents.at(-1)?.metadata?.outcome, 'protocol_failure');
    });
  }
});

test('the complete provider batch is checked against the eight-call budget before dispatch', async () => {
  const url = await startServer();
  provider = async () => {
    providerCalls += 1;
    return providerResult(Array.from({ length: 9 }, (_, index) => wireCall('search_dropi_catalog', { query: `item-${index}` }, `call-${index}`)));
  };
  const response = await post(url);
  assert.equal(response.status, 422);
  assert.equal(providerCalls, 1);
  assert.equal(tools.length, 0);
  assert.equal(auditEvents.at(-1)?.metadata?.outcome, 'budget_failure');
});

test('six provider turns is a hard request budget', async () => {
  const url = await startServer();
  invokeTool = async (subagent, name, params, suppliedToken) => {
    tools.push({ subagent, name, params, productToken: suppliedToken });
    return { products: [{ id: productId }] };
  };
  provider = async () => {
    providerCalls += 1;
    return providerCalls <= 6 ? providerResult([wireCall('search_dropi_catalog', { query: `item-${providerCalls}` }, `call-${providerCalls}`)]) : providerResult([], 'must not run');
  };
  const response = await post(url);
  assert.equal(providerCalls, 6);
  assert.equal(tools.length, 6);
  assert.equal(response.status, 422);
  assert.equal((await response.json() as any).status, 'partial');
  assert.equal(auditEvents.at(-1)?.metadata?.outcome, 'budget_failure');
});

test('tool failure is audited and stops before another provider turn', async () => {
  const url = await startServer();
  provider = async () => { providerCalls += 1; return providerResult([wireCall('search_dropi_catalog', { query: 'lamp' })]); };
  invokeTool = async () => { throw new Error('provider API key leaked?'); };
  const response = await post(url);
  assert.equal(response.status, 502);
  assert.equal(providerCalls, 1);
  assert.equal(auditEvents.at(-1)?.metadata?.outcome, 'tool_failure');
  assert.equal(JSON.stringify(auditEvents).includes('provider API key leaked?'), false);
});

test('partial tool outcome is audited distinctly and halts later provider calls', async () => {
  const url = await startServer();
  provider = async () => { providerCalls += 1; return providerResult([wireCall('search_dropi_catalog', { query: 'lamp' })]); };
  invokeTool = async () => ({ status: 'partial', products: [{ id: productId }] });
  const response = await post(url);
  assert.equal(response.status, 502);
  assert.equal((await response.json() as any).status, 'partial');
  assert.equal(providerCalls, 1);
  assert.equal(auditEvents.at(-1)?.metadata?.outcome, 'partial');
});

test('audit records are bounded, linked, sanitized, and exclude user text and credentials', async () => {
  const url = await startServer();
  provider = async () => {
    providerCalls += 1;
    return providerCalls === 1
      ? providerResult([wireCall('score_product', { product_id: productId })])
      : providerResult([], 'Done');
  };
  invokeTool = async () => ({ product_id: productId, access_token: 'never-log', detail: 'x'.repeat(9000) });
  await post(url, { message: 'private customer message' });
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].tenantId, tenantId);
  assert.equal(auditEvents[0].metadata.request_id, requestId);
  assert.equal(auditEvents[0].metadata.tool_call_id, 'call-1');
  assert.equal(auditEvents[0].output.access_token, '[REDACTED]');
  assert.ok(auditEvents[0].output.detail.length < 9000);
  assert.equal(JSON.stringify(auditEvents).includes(token), false);
  assert.equal(JSON.stringify(auditEvents).includes(productToken), false);
  assert.equal(JSON.stringify(auditEvents).includes('private customer message'), false);
});

test('audit persistence failure never claims a successful result', async () => {
  const url = await startServer();
  provider = async () => { providerCalls += 1; return providerResult([wireCall('search_dropi_catalog', { query: 'lamp' })]); };
  audit = async () => { throw new Error('audit unavailable'); };
  const response = await post(url);
  assert.equal(response.status, 500);
  assert.notEqual((await response.json() as any).status, 'complete');
  assert.equal(providerCalls, 1);
});

test('audit sanitization redacts credential-bearing connection URIs under ordinary fields', () => {
  const sanitized = sanitize({ detail: 'postgresql://audit-user:credential-marker@db.invalid/alfa' });
  const encoded = JSON.stringify(sanitized);
  assert.ok(!encoded.includes('credential-marker'), 'credential-bearing URI values must not be retained');
});

test('audit sanitization omits oversized object keys without collisions', () => {
  const oversizedKey = 'k'.repeat(1_000_000);
  const sanitized = sanitize({ safe: 'preserved', [oversizedKey]: 'discarded' }) as Record<string, unknown>;
  const encoded = JSON.stringify(sanitized);
  assert.ok(encoded.length < 1024, 'sanitized output must remain bounded');
  assert.ok(!encoded.includes(oversizedKey), 'oversized property names must be omitted as a unit');
  assert.equal(sanitized.safe, 'preserved');
});
