import assert from 'node:assert/strict';
import { test } from 'node:test';

const registry = require('../src/mcp/registry') as Record<string, any>;
const transport = require('../src/mcp/client') as Record<string, any>;
const tenantId = '11111111-1111-4111-8111-111111111111';
const requestId = '33333333-3333-4333-8333-333333333333';
const productId = '44444444-4444-4444-8444-444444444444';

test('provider registry exposes only product search and scoring capabilities', () => {
  assert.deepEqual(registry.allToolSchemas().map((tool: any) => tool.name).sort(), ['score_product', 'search_dropi_catalog']);
  assert.deepEqual(registry.findSubagentForTool('score_product')?.key, 'producto');
  assert.equal(registry.findSubagentForTool('publish_product'), undefined);
});

test('product transport builds an authenticated request with trusted context outside the body', () => {
  assert.equal(typeof transport.buildProductToolRequest, 'function');
  if (typeof transport.buildProductToolRequest !== 'function') return;
  const request = transport.buildProductToolRequest(
    { key: 'producto', baseUrl: 'http://producto.test' },
    'search_dropi_catalog',
    { query: 'lamp', tenant_id: tenantId, request_id: requestId },
    'separate-product-token',
  );
  assert.equal(request.url, 'http://producto.test/tools/search_dropi_catalog');
  assert.equal(request.headers['X-Alfa-Internal-Token'], 'separate-product-token');
  assert.equal(request.headers['X-Alfa-Tenant-Id'], tenantId);
  assert.equal(request.headers['X-Alfa-Request-Id'], requestId);
  assert.deepEqual(request.body, { query: 'lamp' });
});

test('product transport rejects other services, tools, credentials, and invalid arguments', () => {
  assert.equal(typeof transport.buildProductToolRequest, 'function');
  if (typeof transport.buildProductToolRequest !== 'function') return;
  const build = (subagent: any, name: string, args: Record<string, unknown>, token = 'separate-product-token') =>
    transport.buildProductToolRequest(subagent, name, { ...args, tenant_id: tenantId, request_id: requestId }, token);
  assert.throws(() => build({ key: 'ads', baseUrl: 'http://ads.test' }, 'search_dropi_catalog', { query: 'lamp' }));
  assert.throws(() => build({ key: 'producto', baseUrl: 'http://producto.test' }, 'publish_product', {}));
  assert.throws(() => build({ key: 'producto', baseUrl: 'http://user:pass@producto.test' }, 'score_product', { product_id: productId }));
  assert.throws(() => build({ key: 'producto', baseUrl: 'http://producto.test' }, 'search_dropi_catalog', { query: 'lamp', extra: 'no' }));
  assert.throws(() => build({ key: 'producto', baseUrl: 'http://producto.test' }, 'score_product', { product_id: 'bad' }));
  assert.throws(() => build({ key: 'producto', baseUrl: 'http://producto.test' }, 'search_dropi_catalog', { query: 'lamp' }, ''));
});
