import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import express from 'express';
import { AddressInfo } from 'node:net';

const chatModule = (() => {
  try { return require('../src/routes/chat') as Record<string, any>; }
  catch { return {}; }
})();
const configModule = (() => {
  try { return require('../src/config') as Record<string, any>; }
  catch { return {}; }
})();
const token = 'orchestrator-auth-test-token';
const productToken = 'different-product-service-token';
const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
let providerCalls = 0;
let toolCalls = 0;
let auditCalls = 0;
let providerMessages: any[] = [];

function createConfig() {
  return configModule.loadOrchestratorConfig({
    ORCHESTRATOR_INTERNAL_TOKEN: token,
    ORCHESTRATOR_TENANT_ID: tenantId,
    ORCHESTRATOR_PRODUCT_TOKEN: productToken,
    MCP_PRODUCTO_URL: 'http://producto.test',
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/chat', chatModule.createChatRouter({
    config: createConfig(),
    callLlm: async (messages: any[]) => {
      providerCalls += 1;
      providerMessages = messages;
      return { content: 'ready', toolCalls: [], assistantMessage: { role: 'assistant', content: 'ready' } };
    },
    callTool: async () => { toolCalls += 1; return {}; },
    logAgentCall: async () => { auditCalls += 1; },
  }));
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/chat`;
}

async function post(url: string, headers: Record<string, string>, body = { message: 'hello' }) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
  providerCalls = 0;
  toolCalls = 0;
  auditCalls = 0;
  providerMessages = [];
});

test('chat route exposes an injectable router factory', () => {
  assert.equal(typeof chatModule.createChatRouter, 'function');
});

test('startup config validates internal token, tenant UUID, product token, and product URL', () => {
  assert.equal(typeof configModule.loadOrchestratorConfig, 'function');
  assert.equal(typeof configModule.OrchestratorConfigurationError, 'function');
});

if (typeof chatModule.createChatRouter === 'function' && typeof configModule.loadOrchestratorConfig === 'function') {
test('startup config rejects missing values, invalid tenant UUIDs, reused credentials, and unsafe URLs', () => {
  const valid = {
    ORCHESTRATOR_INTERNAL_TOKEN: token,
    ORCHESTRATOR_TENANT_ID: tenantId,
    ORCHESTRATOR_PRODUCT_TOKEN: productToken,
    MCP_PRODUCTO_URL: 'https://producto.internal',
  };
  assert.equal(configModule.loadOrchestratorConfig(valid).tenantId, tenantId);
  for (const env of [
    { ...valid, ORCHESTRATOR_INTERNAL_TOKEN: '' },
    { ...valid, ORCHESTRATOR_TENANT_ID: 'tenant' },
    { ...valid, ORCHESTRATOR_PRODUCT_TOKEN: token },
    { ...valid, MCP_PRODUCTO_URL: 'http://user:pass@producto.internal' },
  ]) assert.throws(() => configModule.loadOrchestratorConfig(env));
});

test('missing and wrong internal tokens stop before provider, tool, or audit access', async (t) => {
  for (const [name, supplied] of [['missing', ''], ['wrong', 'incorrect']] as const) {
    await t.test(name, async () => {
      const url = await startServer();
      const headers: Record<string, string> = { 'X-Alfa-Tenant-Id': tenantId, 'X-Alfa-Request-Id': requestId };
      if (supplied) headers['X-Alfa-Internal-Token'] = supplied;
      const response = await post(url, headers);
      assert.equal(response.status, 401);
      assert.equal(providerCalls, 0);
      assert.equal(toolCalls, 0);
      assert.equal(auditCalls, 0);
    });
  }
});

test('invalid trusted tenant/request UUID and conflicting body tenant stop before dispatch', async (t) => {
  const cases = [
    { name: 'missing tenant', headers: { 'X-Alfa-Request-Id': requestId }, body: { message: 'hello' } },
    { name: 'spoofed tenant', headers: { 'X-Alfa-Tenant-Id': otherTenantId, 'X-Alfa-Request-Id': requestId }, body: { message: 'hello' } },
    { name: 'invalid request ID', headers: { 'X-Alfa-Tenant-Id': tenantId, 'X-Alfa-Request-Id': 'not-uuid' }, body: { message: 'hello' } },
    { name: 'body tenant mismatch', headers: { 'X-Alfa-Tenant-Id': tenantId, 'X-Alfa-Request-Id': requestId }, body: { message: 'hello', tenant_id: otherTenantId } },
  ];
  for (const item of cases) {
    await t.test(item.name, async () => {
      const url = await startServer();
      const response = await post(url, { 'X-Alfa-Internal-Token': token, ...item.headers }, item.body);
      assert.ok(response.status >= 400);
      assert.equal(providerCalls, 0);
      assert.equal(toolCalls, 0);
      assert.equal(auditCalls, 0);
    });
  }
});

test('valid auth forwards only header-bound tenant and request ID into provider context', async () => {
  const url = await startServer();
  const response = await post(url, {
    'X-Alfa-Internal-Token': token,
    'X-Alfa-Tenant-Id': tenantId,
    'X-Alfa-Request-Id': requestId,
  }, { message: 'hello', tenant_id: tenantId });
  assert.equal(response.status, 200);
  assert.equal(providerCalls, 1);
  assert.equal(toolCalls, 0);
  assert.equal(auditCalls, 0);
  assert.equal(JSON.stringify(providerMessages).includes(token), false);
  assert.equal(JSON.stringify(providerMessages).includes(tenantId), false);
  assert.equal(JSON.stringify(providerMessages).includes(requestId), false);
});
}
