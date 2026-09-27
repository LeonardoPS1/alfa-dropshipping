import { pool } from '../db/pool';
import { ProductQuery } from './searchDropiCatalog';

export interface ScoreProductInput {
  tenant_id: string;
  product_id: string;
}

interface ScoreInputs {
  supplierPrice: number | null;
  salePrice: number | null;
  rawData: Record<string, unknown>;
  saturation: { active_ads_count: number | null; checked_at?: string; source?: string } | null;
}

const WEIGHTS = { demand: 0.35, competition: 0.25, margin: 0.3, shipping: 0.1 };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function buildEvaluationEvidence(input: {
  catalogPrice: number | null;
  catalogSourceUrl: string | null;
  salePrice: number | null;
  rawData: Record<string, unknown>;
  saturation: ScoreInputs['saturation'];
}) {
  const demand = finiteNumber(input.rawData.estimated_demand);
  const shippingDays = finiteNumber(input.rawData.shipping_days_estimate);
  const activeAds = finiteNumber(input.saturation?.active_ads_count);
  const marginAvailable = input.catalogPrice !== null && input.catalogPrice > 0 && input.salePrice !== null && input.salePrice > 0;

  return {
    catalog_price: input.catalogPrice === null
      ? { value: null, status: 'unavailable', source: null }
      : { value: input.catalogPrice, status: 'observed', source: 'dropi', source_url: input.catalogSourceUrl },
    sale_price: input.salePrice === null
      ? { value: null, status: 'unavailable', source: null }
      : { value: input.salePrice, status: 'observed', source: 'product record' },
    demand: demand === null
      ? { value: null, status: 'unavailable', source: null }
      : { value: demand, status: 'estimated', source: String(input.rawData.demand_source ?? 'legacy heuristic') },
    shipping_days: shippingDays === null
      ? { value: null, status: 'unavailable', source: null }
      : { value: shippingDays, status: 'estimated', source: String(input.rawData.shipping_source ?? 'Dropi estimate') },
    competition: activeAds === null
      ? { value: null, status: 'unavailable', source: null }
      : {
          value: activeAds,
          status: 'observed',
          source: input.saturation?.source ?? 'existing saturation check',
          observed_at: input.saturation?.checked_at ?? null,
        },
    margin: marginAvailable
      ? { value: Number((((input.salePrice! - input.catalogPrice!) / input.salePrice!) * 100).toFixed(2)), status: 'observed', source: 'catalog price and product sale price' }
      : { value: null, status: 'unavailable', source: null },
  };
}

export function evaluateProduct(input: ScoreInputs) {
  const demandValue = finiteNumber(input.rawData.estimated_demand);
  const demandScore = demandValue !== null && demandValue >= 0 && demandValue <= 100 ? demandValue : null;
  const activeAdsCount = finiteNumber(input.saturation?.active_ads_count);
  const competitionScore = activeAdsCount !== null && activeAdsCount >= 0
    ? Math.max(0, 100 - activeAdsCount * 5)
    : null;
  const salePrice = input.salePrice;
  const margin = input.supplierPrice !== null && input.supplierPrice > 0 && salePrice !== null && salePrice > 0
    ? (salePrice - input.supplierPrice) / salePrice
    : null;
  const marginScore = margin === null ? null : marginToScore(margin);
  const shippingDays = finiteNumber(input.rawData.shipping_days_estimate);
  const shippingScore = shippingDays === null
    ? null
    : shippingDays <= 3 ? 100 : shippingDays <= 7 ? 60 : 20;

  const values = [demandScore, competitionScore, marginScore, shippingScore];
  const totalScore = values.every((value): value is number => value !== null)
    ? demandScore! * WEIGHTS.demand + competitionScore! * WEIGHTS.competition + marginScore! * WEIGHTS.margin + shippingScore! * WEIGHTS.shipping
    : null;
  const justification = totalScore === null
    ? 'Evaluation is incomplete because one or more required inputs are unavailable or unsupported.'
    : `Evaluation uses demand ${demandScore}/100, competition ${competitionScore}/100, margin ${marginScore}/100, and shipping ${shippingScore}/100.`;

  return {
    total_score: totalScore === null ? null : Number(totalScore.toFixed(1)),
    breakdown: {
      demand_score: demandScore,
      competition_score: competitionScore,
      margin_score: marginScore,
      shipping_score: shippingScore,
    },
    justification,
  };
}

export async function scoreProduct(
  input: ScoreProductInput,
  dependencies: { query?: ProductQuery } = {},
) {
  const { tenant_id, product_id } = input;
  if (!UUID_PATTERN.test(tenant_id)) throw new Error('trusted tenant UUID is required');
  if (!UUID_PATTERN.test(product_id)) throw new Error('product ID must be a UUID');
  const query = dependencies.query ?? ((sql, values) => pool.query(sql, values));

  const productResult = await query(
    `SELECT id, tenant_id, source, external_id, supplier_price, suggested_sale_price, raw_data
     FROM products WHERE id = $1 AND tenant_id = $2`,
    [product_id, tenant_id],
  );
  const product = productResult.rows[0];
  if (!product) throw new Error(`product ${product_id} not found`);

  const saturationResult = await query(
    `SELECT active_ads_count, checked_at, 'saturation_checks' AS source
     FROM saturation_checks
     WHERE product_id = $1 AND tenant_id = $2 AND checked_at > now() - interval '24 hours'
     ORDER BY checked_at DESC LIMIT 1`,
    [product_id, tenant_id],
  );
  const rawData = product.raw_data && typeof product.raw_data === 'object' ? product.raw_data : {};
  const saturation = saturationResult.rows[0] ?? null;
  const supplierPrice = finiteNumber(product.supplier_price);
  const salePrice = finiteNumber(product.suggested_sale_price);
  const result = evaluateProduct({ supplierPrice, salePrice, rawData, saturation });
  const evidence = buildEvaluationEvidence({
    catalogPrice: supplierPrice,
    catalogSourceUrl: typeof rawData.source_url === 'string' ? rawData.source_url : null,
    salePrice,
    rawData,
    saturation,
  });

  await query(
    `INSERT INTO evaluations (tenant_id, product_id, demand_score, competition_score, margin_score, shipping_score, total_score, justification, evidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [tenant_id, product_id, result.breakdown.demand_score, result.breakdown.competition_score,
      result.breakdown.margin_score, result.breakdown.shipping_score, result.total_score,
      result.justification, JSON.stringify(evidence)],
  );

  return { product_id, ...result, evidence };
}

function marginToScore(margin: number): number {
  if (margin >= 0.4) return 100;
  if (margin <= 0.15) return 0;
  return ((margin - 0.15) / (0.4 - 0.15)) * 100;
}
