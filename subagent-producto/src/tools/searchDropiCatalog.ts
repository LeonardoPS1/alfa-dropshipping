import { pool } from '../db/pool';
import { DropiProduct, scrapeDropiCatalog } from '../scrapers/dropiCatalog';

export interface SearchDropiInput {
  tenant_id: string;
  request_id?: string;
  query?: string;
  category?: string;
}

export type ProductQuery = (sql: string, values?: unknown[]) => Promise<{ rows: any[] }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildProductEvidence(product: DropiProduct) {
  return {
    catalog_price: product.supplier_price === null
      ? { value: null, status: 'unavailable', source: null }
      : { value: product.supplier_price, status: 'observed', source: 'dropi', source_url: product.source_url },
    shipping: { value: null, status: 'unavailable', source: null },
  };
}

export async function upsertDiscoveredProduct(
  tenantId: string,
  product: DropiProduct,
  query: ProductQuery = (sql, values) => pool.query(sql, values),
) {
  if (!UUID_PATTERN.test(tenantId)) throw new Error('trusted tenant UUID is required');
  if (!product.external_id || !product.source_url || product.supplier_price !== null && product.supplier_price <= 0) {
    throw new Error('invalid Dropi product identity or observed attributes');
  }

  const result = await query(
    `INSERT INTO products (tenant_id, source, external_id, name, supplier_price, category, raw_data)
     VALUES ($1, 'dropi', $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (tenant_id, source, external_id) WHERE external_id IS NOT NULL
     DO UPDATE SET name = EXCLUDED.name,
                   supplier_price = EXCLUDED.supplier_price,
                   category = EXCLUDED.category,
                   raw_data = COALESCE(products.raw_data, '{}'::jsonb) || EXCLUDED.raw_data
     RETURNING id`,
    [tenantId, product.external_id, product.name, product.supplier_price, product.category, JSON.stringify({
      discovery_evidence: buildProductEvidence(product),
      source_url: product.source_url,
    })],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error('product upsert returned no identity');
  return { id };
}

export async function searchDropiCatalog(
  input: SearchDropiInput,
  dependencies: { query?: ProductQuery; scrape?: typeof scrapeDropiCatalog } = {},
) {
  const { tenant_id, request_id, query, category } = input;
  if (!UUID_PATTERN.test(tenant_id)) throw new Error('trusted tenant UUID is required');
  if (request_id !== undefined && !UUID_PATTERN.test(request_id)) throw new Error('valid request ID is required');

  const products = await (dependencies.scrape ?? scrapeDropiCatalog)(query, category);
  const saved = [];
  for (const product of products) {
    const { id } = await upsertDiscoveredProduct(tenant_id, product, dependencies.query);
    saved.push({ id, name: product.name, is_new: false });
  }
  return { count: saved.length, products: saved };
}
