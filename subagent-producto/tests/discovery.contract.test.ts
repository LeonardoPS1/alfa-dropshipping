import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDropiProduct } from '../src/scrapers/dropiCatalog';
import { buildProductEvidence } from '../src/tools/searchDropiCatalog';
import { buildEvaluationEvidence, evaluateProduct } from '../src/tools/scoreProduct';

test('Dropi results require a stable source-native id and a canonical source URL', () => {
  assert.equal(parseDropiProduct({
    id: 'DP-123',
    href: '/dashboard/products/DP-123?campaign=ignored',
    name: 'Lamp',
    priceText: '$ 12.990',
    category: 'Home',
  })?.external_id, 'DP-123');
  assert.equal(parseDropiProduct({
    id: '', href: '', name: 'Lamp', priceText: '$ 12.990', category: 'Home',
  }), null);
  assert.equal(parseDropiProduct({
    id: 'DP-123', href: '/dashboard/products/DP-999', name: 'Lamp', priceText: '$ 12.990', category: 'Home',
  }), null);
  assert.equal(parseDropiProduct({
    id: 'DP-123', href: '/dashboard/products/DP-123', name: '', priceText: '$ 12.990', category: 'Home',
  }), null);
});

test('product source price is valid observed evidence or explicitly unavailable, never zero-defaulted', () => {
  const observed = parseDropiProduct({
    id: 'DP-123', href: '/dashboard/products/DP-123', name: 'Lamp', priceText: '$ 12.990', category: 'Home',
  });
  assert.equal(observed?.supplier_price, 12990);
  assert.deepEqual(buildProductEvidence(observed!), {
    catalog_price: { value: 12990, status: 'observed', source: 'dropi', source_url: 'https://app.dropi.cl/dashboard/products/DP-123' },
    shipping: { value: null, status: 'unavailable', source: null },
  });

  const missing = parseDropiProduct({
    id: 'DP-123', href: '/dashboard/products/DP-123', name: 'Lamp', priceText: '', category: 'Home',
  });
  assert.equal(missing?.supplier_price, null);
  assert.equal(parseDropiProduct({
    id: 'DP-123', href: '/dashboard/products/DP-123', name: 'Lamp', priceText: '$ 0', category: 'Home',
  })?.supplier_price, null);
  assert.equal(parseDropiProduct({
    id: 'DP-123', href: '/dashboard/products/DP-123', name: 'Lamp', priceText: '$ 12.990 estimated', category: 'Home',
  })?.supplier_price, null);
});

test('evaluation evidence marks unsupported inputs unavailable and leaves incomplete scores null', () => {
  const result = evaluateProduct({
    supplierPrice: 12990,
    salePrice: null,
    rawData: {},
    saturation: null,
  });
  assert.equal(result.total_score, null);
  assert.deepEqual(result.breakdown, {
    demand_score: null,
    competition_score: null,
    margin_score: null,
    shipping_score: null,
  });
  assert.deepEqual(buildEvaluationEvidence({
    catalogPrice: 12990,
    catalogSourceUrl: 'https://app.dropi.cl/dashboard/products/DP-123',
    salePrice: null,
    rawData: {},
    saturation: null,
  }), {
    catalog_price: { value: 12990, status: 'observed', source: 'dropi', source_url: 'https://app.dropi.cl/dashboard/products/DP-123' },
    sale_price: { value: null, status: 'unavailable', source: null },
    demand: { value: null, status: 'unavailable', source: null },
    shipping_days: { value: null, status: 'unavailable', source: null },
    competition: { value: null, status: 'unavailable', source: null },
    margin: { value: null, status: 'unavailable', source: null },
  });
});

test('estimated demand remains labelled estimated and is not confused with measured demand', () => {
  const evidence = buildEvaluationEvidence({
    catalogPrice: 12990,
    catalogSourceUrl: 'https://app.dropi.cl/dashboard/products/DP-123',
    salePrice: null,
    rawData: { estimated_demand: 72 },
    saturation: null,
  });
  assert.deepEqual(evidence.demand, { value: 72, status: 'estimated', source: 'legacy heuristic' });
});

test('tenant context and product UUID are required before discovery or scoring access', () => {
  const query = async () => { throw new Error('query must not run for invalid input'); };
  return Promise.all([
    assert.rejects(() => import('../src/tools/searchDropiCatalog').then(({ searchDropiCatalog }) =>
      searchDropiCatalog({ tenant_id: '', request_id: 'request-1' }, { query })), /tenant/i),
    assert.rejects(() => import('../src/tools/scoreProduct').then(({ scoreProduct }) =>
      scoreProduct({ tenant_id: '00000000-0000-0000-0000-000000000001', product_id: 'not-a-uuid' }, { query })), /UUID/i),
  ]);
});

test('scoring checks product ownership and never starts an external Ads lookup', async () => {
  const statements: string[] = [];
  const query = async (sql: string) => {
    statements.push(sql);
    if (/FROM products/i.test(sql)) return { rows: [] };
    throw new Error(`unexpected external or persistence query: ${sql}`);
  };
  const { scoreProduct } = await import('../src/tools/scoreProduct');
  await assert.rejects(() => scoreProduct({
    tenant_id: '00000000-0000-0000-0000-000000000001',
    product_id: '00000000-0000-0000-0000-000000000099',
  }, { query }), /not found/i);
  assert.equal(statements.length, 1);
  assert.match(statements[0], /tenant_id = \$2/i);
});

test('same source identity can be upserted safely for multiple tenants without cross-tenant match', async () => {
  const rows = new Map<string, string>();
  const query = async (sql: string, params: unknown[] = []) => {
    assert.match(sql, /ON CONFLICT\s*\(tenant_id,\s*source,\s*external_id\)/i);
    assert.match(sql, /RETURNING id/i);
    const [tenant, source, externalId] = params as string[];
    const key = `${tenant}:${source}:${externalId}`;
    if (!rows.has(key)) rows.set(key, `internal-${rows.size + 1}`);
    return { rows: [{ id: rows.get(key) }] };
  };
  const { upsertDiscoveredProduct } = await import('../src/tools/searchDropiCatalog');
  const first = await upsertDiscoveredProduct('00000000-0000-0000-0000-000000000001', {
    external_id: 'DP-123', source_url: 'https://app.dropi.cl/dashboard/products/DP-123', name: 'Lamp',
    supplier_price: 12990, category: 'Home', shipping_days_estimate: null,
  }, query);
  const repeat = await upsertDiscoveredProduct('00000000-0000-0000-0000-000000000001', {
    external_id: 'DP-123', source_url: 'https://app.dropi.cl/dashboard/products/DP-123', name: 'Lamp',
    supplier_price: 12990, category: 'Home', shipping_days_estimate: null,
  }, query);
  const otherTenant = await upsertDiscoveredProduct('00000000-0000-0000-0000-000000000002', {
    external_id: 'DP-123', source_url: 'https://app.dropi.cl/dashboard/products/DP-123', name: 'Lamp',
    supplier_price: 12990, category: 'Home', shipping_days_estimate: null,
  }, query);
  assert.equal(first.id, repeat.id);
  assert.notEqual(first.id, otherTenant.id);
});

test('PostgreSQL partial unique index race is exercised only with an explicit local test database', {
  skip: !process.env.LOCAL_TEST_DATABASE_URL,
}, async () => {
  const { runDiscoveryConcurrencyIntegration } = await import('./helpers/postgres-discovery.integration');
  await runDiscoveryConcurrencyIntegration(process.env.LOCAL_TEST_DATABASE_URL!);
});
