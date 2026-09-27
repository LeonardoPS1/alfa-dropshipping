import { pool } from '../db/pool';
import { countActiveAds } from '../scrapers/metaAdLibrary';

const SATURATION_THRESHOLD = Number(process.env.SATURATION_THRESHOLD ?? 15);

export interface CheckSaturationInput {
  tenant_id: string;
  product_id: string;
}

export async function checkAdSaturation(input: CheckSaturationInput) {
  const { tenant_id, product_id } = input;

  const productRes = await pool.query(`SELECT name FROM products WHERE id = $1 AND tenant_id = $2`, [
    product_id,
    tenant_id,
  ]);
  if (productRes.rows.length === 0) {
    throw new Error(`producto ${product_id} no encontrado`);
  }
  const productName: string = productRes.rows[0].name;

  const activeAdsCount = await countActiveAds(productName);
  const isSaturated = activeAdsCount > SATURATION_THRESHOLD;

  await pool.query(
    `INSERT INTO saturation_checks (tenant_id, product_id, active_ads_count, is_saturated)
     VALUES ($1, $2, $3, $4)`,
    [tenant_id, product_id, activeAdsCount, isSaturated]
  );

  await pool.query(`UPDATE products SET is_flagged_saturated = $1 WHERE id = $2`, [isSaturated, product_id]);

  return { product_id, active_ads_count: activeAdsCount, is_saturated: isSaturated, threshold: SATURATION_THRESHOLD };
}
