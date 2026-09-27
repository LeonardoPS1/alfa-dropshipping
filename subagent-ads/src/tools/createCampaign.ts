import { pool } from '../db/pool';
import { createMetaCampaign, createMetaAdSet, createMetaAd } from '../providers/metaMarketingClient';
import { createTikTokCampaign, createTikTokAdGroup, createTikTokAd } from '../providers/tiktokAdsClient';

export interface CreateCampaignInput {
  tenant_id: string;
  product_id: string;
  platform: 'meta' | 'tiktok';
  budget: number; // en la unidad monetaria local (CLP), no centavos
  creative_ids: string[];
  objective?: string;
}

export async function createCampaign(input: CreateCampaignInput) {
  const { tenant_id, product_id, platform, budget, creative_ids, objective } = input;

  const productRes = await pool.query(`SELECT name FROM products WHERE id = $1 AND tenant_id = $2`, [
    product_id,
    tenant_id,
  ]);
  if (productRes.rows.length === 0) throw new Error(`producto ${product_id} no encontrado`);
  const productName = productRes.rows[0].name;

  const creativesRes = await pool.query(`SELECT id, content FROM creatives WHERE id = ANY($1)`, [creative_ids]);
  if (creativesRes.rows.length === 0) throw new Error('ninguno de los creative_ids fue encontrado');

  const copyRes = await pool.query(
    `SELECT content FROM creatives WHERE product_id = $1 AND metadata->>'subtype' = 'ad_copy' ORDER BY created_at DESC LIMIT 1`,
    [product_id]
  );
  const message = copyRes.rows[0]?.content ?? productName;

  // CLP no tiene decimales; Meta espera centavos de la moneda de la cuenta,
  // TikTok espera la unidad base — cada cliente hace su propia conversión interna.
  const budgetCents = Math.round(budget * 100);

  let platformCampaignId: string;
  let adsCreated = 0;

  if (platform === 'meta') {
    platformCampaignId = await createMetaCampaign({ productName, objective: objective ?? 'OUTCOME_SALES' });
    const adSetId = await createMetaAdSet({ campaignId: platformCampaignId, budgetCents, productName });
    for (const creative of creativesRes.rows) {
      await createMetaAd({ adSetId, creativeImageUrl: creative.content, message, productName });
      adsCreated++;
    }
  } else {
    platformCampaignId = await createTikTokCampaign({ productName, objective: objective ?? 'CONVERSIONS' });
    const adGroupId = await createTikTokAdGroup({ campaignId: platformCampaignId, budgetCents, productName });
    for (const creative of creativesRes.rows) {
      await createTikTokAd({ adGroupId, videoUrl: creative.content, message, productName });
      adsCreated++;
    }
  }

  const inserted = await pool.query(
    `INSERT INTO campaigns (tenant_id, product_id, platform, status, budget, platform_campaign_id)
     VALUES ($1, $2, $3, 'active', $4, $5) RETURNING id`,
    [tenant_id, product_id, platform, budget, platformCampaignId]
  );

  return { campaign_id: inserted.rows[0].id, platform_campaign_id: platformCampaignId, ads_created: adsCreated };
}
