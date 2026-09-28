import { selectCatalogPriceEvidence } from './evidenceDisplay';
import type { Evidence } from './evidenceDisplay';

export interface QueryResult<Row> {
  rows: Row[];
}

export type Query = <Row = Record<string, unknown>>(
  sql: string,
  values: unknown[]
) => Promise<QueryResult<Row>>;

export interface PipelineRow {
  id: string;
  name: string;
  category: string | null;
  source: string;
  source_id: string | null;
  evaluation_id: string | null;
  evaluation_status: 'discovered' | 'incomplete' | 'evaluated';
  evaluation_score: number | null;
  evaluation_evidence: Record<string, unknown> | null;
  discovery_evidence: Record<string, unknown> | null;
  catalog_price_evidence: unknown;
  shopify_status: string | null;
  is_flagged_saturated: boolean;
  is_flagged_noncompliant: boolean;
  thumbnail: string | null;
  has_copy: boolean;
  has_image: boolean;
  campaign_id: string | null;
  campaign_status: string | null;
  roas: number | null;
}

export async function queryPipeline(tenantId: string, query: Query = defaultQuery): Promise<PipelineRow[]> {
  const { rows } = await query<PipelineRow>(
    `
    SELECT
      p.id,
      p.name,
      p.category,
      p.source,
      p.external_id AS source_id,
      p.shopify_status,
      p.is_flagged_saturated,
      p.is_flagged_noncompliant,
      p.raw_data #> '{discovery_evidence,catalog_price}' AS discovery_evidence,
      e.id AS evaluation_id,
      CASE
        WHEN e.id IS NULL THEN 'discovered'
        WHEN e.total_score IS NULL THEN 'incomplete'
        ELSE 'evaluated'
      END AS evaluation_status,
      e.total_score AS evaluation_score,
      e.evidence AS evaluation_evidence,
      COALESCE(e.evidence -> 'catalog_price', p.raw_data #> '{discovery_evidence,catalog_price}') AS catalog_price_evidence,
      cr.thumbnail,
      cr.has_copy,
      cr.has_image,
      c.id AS campaign_id,
      c.status AS campaign_status,
      c.roas
    FROM products p
    LEFT JOIN LATERAL (
      SELECT e.id, e.total_score, e.evidence
      FROM evaluations e
      WHERE e.product_id = p.id AND e.tenant_id = p.tenant_id
      ORDER BY e.created_at DESC
      LIMIT 1
    ) e ON true
    LEFT JOIN LATERAL (
      SELECT
        (SELECT content FROM creatives image WHERE image.product_id = p.id AND image.tenant_id = p.tenant_id AND image.type = 'image' ORDER BY image.created_at ASC LIMIT 1) AS thumbnail,
        EXISTS(SELECT 1 FROM creatives copy WHERE copy.product_id = p.id AND copy.tenant_id = p.tenant_id AND copy.type = 'copy') AS has_copy,
        EXISTS(SELECT 1 FROM creatives image WHERE image.product_id = p.id AND image.tenant_id = p.tenant_id AND image.type = 'image') AS has_image
    ) cr ON true
    LEFT JOIN LATERAL (
      SELECT campaign.id, campaign.status, campaign.roas
      FROM campaigns campaign
      WHERE campaign.product_id = p.id AND campaign.tenant_id = p.tenant_id
      ORDER BY campaign.created_at DESC
      LIMIT 1
    ) c ON true
    WHERE p.tenant_id = $1
    ORDER BY p.created_at DESC
    LIMIT 200
    `,
    [tenantId]
  );

  return rows.map((row) => ({
    ...row,
    catalog_price_evidence: selectCatalogPriceEvidence(
      row.evaluation_evidence?.catalog_price as Evidence | undefined,
      row.discovery_evidence as Evidence | undefined
    ),
  }));
}

async function defaultQuery<Row>(sql: string, values: unknown[]): Promise<QueryResult<Row>> {
  const { pool } = await import('./db');
  return pool.query(sql, values) as unknown as Promise<QueryResult<Row>>;
}
