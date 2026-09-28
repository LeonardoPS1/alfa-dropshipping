import type { Query, QueryResult } from './pipelineQuery';

export interface ProductDetailData {
  product: Record<string, unknown> | null;
  evaluations: Array<Record<string, unknown>>;
  creatives: Array<Record<string, unknown>>;
  saturation: Record<string, unknown> | null;
  compliance: Record<string, unknown> | null;
  campaign: Record<string, unknown> | null;
}

export async function queryProductDetail(
  productId: string,
  tenantId: string,
  query: Query = defaultQuery
): Promise<ProductDetailData> {
  const product = await query<Record<string, unknown>>(
    `SELECT id, tenant_id, name, category, source, external_id, raw_data, shopify_status, is_flagged_saturated, is_flagged_noncompliant, created_at FROM products WHERE id = $1 AND tenant_id = $2`,
    [productId, tenantId]
  );
  const evaluations = await query<Record<string, unknown>>(
    `SELECT id, tenant_id, total_score, justification, evidence, created_at FROM evaluations WHERE product_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
    [productId, tenantId]
  );
  const creatives = await query<Record<string, unknown>>(
    `SELECT id, tenant_id, type, content, created_at FROM creatives WHERE product_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
    [productId, tenantId]
  );
  const saturation = await query<Record<string, unknown>>(
    `SELECT id, tenant_id, is_saturated, active_ads_count, checked_at FROM saturation_checks WHERE product_id = $1 AND tenant_id = $2 ORDER BY checked_at DESC LIMIT 1`,
    [productId, tenantId]
  );
  const compliance = await query<Record<string, unknown>>(
    `SELECT id, tenant_id, is_compliant, restricted_reason, checked_at FROM compliance_flags WHERE product_id = $1 AND tenant_id = $2 ORDER BY checked_at DESC LIMIT 1`,
    [productId, tenantId]
  );
  const campaign = await query<Record<string, unknown>>(
    `SELECT id, tenant_id, platform, status, roas, spend, created_at FROM campaigns WHERE product_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [productId, tenantId]
  );

  return {
    product: product.rows[0] ?? null,
    evaluations: evaluations.rows,
    creatives: creatives.rows,
    saturation: saturation.rows[0] ?? null,
    compliance: compliance.rows[0] ?? null,
    campaign: campaign.rows[0] ?? null,
  };
}

async function defaultQuery<Row>(sql: string, values: unknown[]): Promise<QueryResult<Row>> {
  const { pool } = await import('./db');
  return pool.query(sql, values) as Promise<QueryResult<Row>>;
}
