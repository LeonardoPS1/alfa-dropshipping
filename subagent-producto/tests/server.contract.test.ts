import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import test, { after, before } from 'node:test';

type SearchFunction = (input: Record<string, unknown>) => Promise<unknown>;
type ScoreFunction = (input: Record<string, unknown>) => Promise<unknown>;
type ProductAppFactory = (dependencies?: {
  discoveryToken?: string;
  searchDropiCatalog?: SearchFunction;
  scoreProduct?: ScoreFunction;
}) => express.Express;

const tenantId = '00000000-0000-0000-0000-000000000001';
const requestId = '00000000-0000-0000-0000-000000000002';
const expectedToken = 'test-product-service-token';
let createProductApp: ProductAppFactory | undefined;
let importListenServer: ReturnType<typeof express.application.listen> | undefined;
const originalPort = process.env.PORT;
const originalListen = express.application.listen;

before(async () => {
  process.env.PORT = '0';
  (express.application as any).listen = function (...args: any[]) {
    importListenServer = originalListen.apply(this, args as any);
    return importListenServer;
  };
  try {
    const serverModule = await import('../src/server');
    createProductApp = (serverModule as any).createProductApp;
  } finally {
    (express.application as any).listen = originalListen;
  }
});

after(async () => {
  if (importListenServer) {
    if (!importListenServer.listening) await once(importListenServer, 'listening');
    await new Promise<void>((resolve, reject) => {
      importListenServer!.close((error) => error ? reject(error) : resolve());
    });
  }
  if (originalPort === undefined) delete process.env.PORT;
  else process.env.PORT = originalPort;
});

async function withProductApp<T>(
  searchDropiCatalog: SearchFunction,
  run: (url: string) => Promise<T>,
  scoreProduct?: ScoreFunction,
) {
  assert.equal(typeof createProductApp, 'function', 'server must export an injectable Express app factory');
  const app = createProductApp!({ discoveryToken: expectedToken, searchDropiCatalog, scoreProduct });
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

async function postDiscovery(
  url: string,
  options: { token?: string; tenant?: string; request?: string; body?: Record<string, unknown> } = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.token !== undefined) headers['X-Alfa-Internal-Token'] = options.token;
  if (options.tenant !== undefined) headers['X-Alfa-Tenant-Id'] = options.tenant;
  if (options.request !== undefined) headers['X-Alfa-Request-Id'] = options.request;
  return fetch(`${url}/tools/search_dropi_catalog`, {
    method: 'POST',
    headers,
    body: JSON.stringify(options.body ?? { query: 'lamp' }),
  });
}

test('importing the product server does not bind a port', () => {
  assert.equal(importListenServer, undefined);
});

test('product discovery rejects a missing token before calling the injected search function', async () => {
  let calls = 0;
  await withProductApp(async () => { calls++; return { count: 0, products: [] }; }, async (url) => {
    const response = await postDiscovery(url, { tenant: tenantId, request: requestId });
    assert.equal(response.status, 401);
  });
  assert.equal(calls, 0);
});

test('product discovery rejects a wrong token before calling the injected search function', async () => {
  let calls = 0;
  await withProductApp(async () => { calls++; return { count: 0, products: [] }; }, async (url) => {
    const response = await postDiscovery(url, {
      token: 'wrong-token', tenant: tenantId, request: requestId,
    });
    assert.equal(response.status, 401);
  });
  assert.equal(calls, 0);
});

test('valid product discovery receives only the trusted tenant and request context', async () => {
  const calls: Record<string, unknown>[] = [];
  const result = { count: 1, products: [{ id: 'internal-1', name: 'Lamp', is_new: false }] };
  await withProductApp(async (input) => { calls.push(input); return result; }, async (url) => {
    const response = await postDiscovery(url, {
      token: expectedToken, tenant: tenantId, request: requestId, body: { query: 'lamp' },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), result);
  });
  assert.deepEqual(calls, [{ query: 'lamp', tenant_id: tenantId, request_id: requestId }]);
});

test('product discovery rejects invalid tenant or request UUID context before injected search', async () => {
  for (const context of [
    { tenant: 'not-a-uuid', request: requestId },
    { tenant: tenantId, request: 'not-a-uuid' },
  ]) {
    let calls = 0;
    await withProductApp(async () => { calls++; return { count: 0, products: [] }; }, async (url) => {
      const response = await postDiscovery(url, { token: expectedToken, ...context });
      assert.equal(response.status, 400);
    });
    assert.equal(calls, 0);
  }
});

test('product discovery rejects a body tenant that conflicts with trusted context before injected search', async () => {
  let calls = 0;
  await withProductApp(async () => { calls++; return { count: 0, products: [] }; }, async (url) => {
    const response = await postDiscovery(url, {
      token: expectedToken,
      tenant: tenantId,
      request: requestId,
      body: { query: 'lamp', tenant_id: '00000000-0000-0000-0000-000000000099' },
    });
    assert.equal(response.status, 400);
  });
  assert.equal(calls, 0);
});

test('product scoring calls the injected evaluator with only trusted tenant context', async () => {
  const calls: Record<string, unknown>[] = [];
  await withProductApp(async () => ({ count: 0, products: [] }), async (url) => {
    const response = await fetch(`${url}/tools/score_product`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Alfa-Internal-Token': expectedToken,
        'X-Alfa-Tenant-Id': tenantId,
        'X-Alfa-Request-Id': requestId,
      },
      body: JSON.stringify({ product_id: '00000000-0000-0000-0000-000000000003' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { result: 'fixture-evaluation' });
  }, async (input) => {
    calls.push(input);
    return { result: 'fixture-evaluation' };
  });
  assert.deepEqual(calls, [{ product_id: '00000000-0000-0000-0000-000000000003', tenant_id: tenantId }]);
});
