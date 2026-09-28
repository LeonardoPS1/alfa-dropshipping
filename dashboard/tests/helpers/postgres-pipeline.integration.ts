import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { queryPipeline, type Query } from '../../src/lib/pipelineQuery';
import { queryProductDetail } from '../../src/lib/productDetail';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export async function runPostgresTenantIsolationScenario(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('Dashboard PostgreSQL integration requires a loopback-only test database URL');
  }
  if (!url.pathname || url.pathname === '/' || !/test|disposable|contract/i.test(url.pathname)) {
    throw new Error('Dashboard PostgreSQL integration requires an explicitly named test-only database');
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 1 });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const productA = randomUUID();
  const productB = randomUUID();
  const evaluationB = randomUUID();
  const sourceId = `dashboard-contract-${randomUUID()}`;
  const testQuery: Query = async <Row>(sql: string, values: unknown[]) => {
    const result = await pool.query(sql, values);
    return { rows: result.rows as unknown as Row[] };
  };

  try {
    await pool.query('BEGIN');
    await pool.query('INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)', [tenantA, 'dashboard-test-a', tenantB, 'dashboard-test-b']);
    await pool.query(
      `INSERT INTO products (id, tenant_id, name, source, external_id, raw_data) VALUES ($1, $2, 'Tenant A product', 'contract', $3, $4), ($5, $6, 'Tenant B secret product', 'contract', $3, $7)`,
      [productA, tenantA, sourceId, { discovery_evidence: { catalog_price: { status: 'observed', value: 14, source: 'contract', source_id: sourceId } } }, productB, tenantB, { discovery_evidence: { catalog_price: { status: 'observed', value: 99, source: 'contract', source_id: sourceId } } }]
    );
    await pool.query(
      `INSERT INTO evaluations (id, tenant_id, product_id, total_score, evidence) VALUES ($1, $2, $3, NULL, $4)`,
      [evaluationB, tenantB, productB, { catalog_price: { status: 'observed', value: 99, source: 'contract', source_id: sourceId } }]
    );

    const pipeline = await queryPipeline(tenantA, testQuery);
    assert.equal(pipeline.length, 1);
    assert.equal(pipeline[0].id, productA);
    assert.equal(pipeline[0].catalog_price_evidence && (pipeline[0].catalog_price_evidence as { value: number }).value, 14);

    const detail = await queryProductDetail(productB, tenantA, testQuery);
    assert.equal(detail.product, null);
    assert.deepEqual(detail.evaluations, []);
    assert.deepEqual(detail.creatives, []);
  } finally {
    await pool.query('ROLLBACK').catch(() => undefined);
    await pool.end();
  }
}
