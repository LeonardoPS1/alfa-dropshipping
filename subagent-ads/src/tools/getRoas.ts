import { pool } from '../db/pool';
import { getMetaCampaignInsights } from '../providers/metaMarketingClient';
import { getTikTokCampaignInsights } from '../providers/tiktokAdsClient';

const ROAS_PAUSE_THRESHOLD = Number(process.env.ROAS_PAUSE_THRESHOLD ?? 1.2);

export interface GetRoasInput {
  tenant_id: string;
  campaign_id?: string;
}

async function refreshCampaignMetrics(campaign: any) {
  const insights =
    campaign.platform === 'meta'
      ? await getMetaCampaignInsights(campaign.platform_campaign_id)
      : await getTikTokCampaignInsights(campaign.platform_campaign_id);

  const revenueRes = await pool.query(
    `SELECT COALESCE(SUM(revenue), 0) AS revenue FROM orders WHERE product_id = $1`,
    [campaign.product_id]
  );
  const revenue = Number(revenueRes.rows[0].revenue);
  const roas = insights.spend > 0 ? revenue / insights.spend : 0;

  await pool.query(
    `UPDATE campaigns SET spend = $1, impressions = $2, conversions = $3, roas = $4, last_checked_at = now() WHERE id = $5`,
    [insights.spend, insights.impressions, insights.conversions, roas, campaign.id]
  );

  const recommendation = roas >= ROAS_PAUSE_THRESHOLD * 2 ? 'scale' : roas >= ROAS_PAUSE_THRESHOLD ? 'maintain' : 'pause';

  return {
    campaign_id: campaign.id,
    spend: insights.spend,
    revenue,
    roas: Number(roas.toFixed(2)),
    recommendation,
  };
}

export async function getRoas(input: GetRoasInput) {
  const { tenant_id, campaign_id } = input;

  if (campaign_id) {
    const campaignRes = await pool.query(`SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2`, [
      campaign_id,
      tenant_id,
    ]);
    if (campaignRes.rows.length === 0) throw new Error(`campaña ${campaign_id} no encontrada`);
    return refreshCampaignMetrics(campaignRes.rows[0]);
  }

  const activeRes = await pool.query(`SELECT * FROM campaigns WHERE tenant_id = $1 AND status = 'active'`, [
    tenant_id,
  ]);
  const results = [];
  for (const campaign of activeRes.rows) {
    results.push(await refreshCampaignMetrics(campaign));
  }
  return { campaigns: results };
}
