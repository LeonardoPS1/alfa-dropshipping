import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { upsertDiscoveredProduct } from '../../src/tools/searchDropiCatalog';
import { scoreProduct } from '../../src/tools/scoreProduct';

const tenantA = '00000000-0000-0000-0000-000000000001';
const tenantB = '00000000-0000-0000-0000-000000000002';

function assertLocalDisposableDatabase(connectionString: string): URL {
  const url = new URL(connectionString);
  const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!localHosts.has(url.hostname) || !/(test|disposable)/i.test(databaseName)) {
    throw new Error('PostgreSQL integration only accepts a loopback database whose name includes test or disposable');
  }
  return url;
}

export async function runDiscoveryConcurrencyIntegration(connectionString: string): Promise<void> {
  assertLocalDisposableDatabase(connectionString);
  const client = new Client({ connectionString });
  const schema = `contract_${randomUUID().replace(/-/g, '')}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    const root = path.resolve(__dirname, '../../../db/migrations');
    await client.query(await readFile(path.join(root, '001_init.sql'), 'utf8'));
    const duplicates = await client.query(`
      SELECT tenant_id, source, external_id, count(*)::int AS count
      FROM products WHERE external_id IS NOT NULL
      GROUP BY tenant_id, source, external_id HAVING count(*) > 1
    `);
    assert.equal(duplicates.rowCount, 0, 'fresh disposable schema must have no pre-migration identity duplicates');
    await client.query(await readFile(path.join(root, '002_discovery_evidence.sql'), 'utf8'));
    await client.query("INSERT INTO tenants (id, name) VALUES ($1, 'contract-b')", [tenantB]);

    const product = {
      external_id: 'DROPi-0001',
      source_url: 'https://app.dropi.cl/dashboard/products/DROPi-0001',
      name: 'Contract lamp',
      supplier_price: 12990,
      category: 'Home',
      shipping_days_estimate: null,
    };
    const query = (sql: string, values?: unknown[]) => client.query(sql, values);
    const [first, repeated, otherTenant] = await Promise.all([
      upsertDiscoveredProduct(tenantA, product, query),
      upsertDiscoveredProduct(tenantA, product, query),
      upsertDiscoveredProduct(tenantB, product, query),
    ]);
    assert.equal(first.id, repeated.id);
    assert.notEqual(first.id, otherTenant.id);

    await scoreProduct({ tenant_id: tenantA, product_id: first.id }, { query });
    const persisted = await client.query(
      'SELECT evidence FROM evaluations WHERE tenant_id = $1 AND product_id = $2',
      [tenantA, first.id],
    );
    assert.equal(persisted.rowCount, 1);
    assert.equal(persisted.rows[0].evidence.catalog_price.status, 'observed');
    assert.equal(persisted.rows[0].evidence.shipping_days.status, 'unavailable');
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.end();
  }
}
