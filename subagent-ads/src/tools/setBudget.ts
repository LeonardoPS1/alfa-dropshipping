import { pool } from '../db/pool';
import { setMetaCampaignBudget } from '../providers/metaMarketingClient';
import { setTikTokAdGroupBudget } from '../providers/tiktokAdsClient';

export interface SetBudgetInput {
  tenant_id: string;
  campaign_id: string;
  new_budget: number;
}

export async function setBudget(input: SetBudgetInput) {
  const { tenant_id, campaign_id, new_budget } = input;

  const campaignRes = await pool.query(`SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2`, [
    campaign_id,
    tenant_id,
  ]);
  if (campaignRes.rows.length === 0) throw new Error(`campaña ${campaign_id} no encontrada`);
  const campaign = campaignRes.rows[0];

  const budgetCents = Math.round(new_budget * 100);

  if (campaign.platform === 'meta') {
    await setMetaCampaignBudget(campaign.platform_campaign_id, budgetCents);
  } else {
    await setTikTokAdGroupBudget(campaign.platform_campaign_id, budgetCents);
  }

  await pool.query(`UPDATE campaigns SET budget = $1 WHERE id = $2`, [new_budget, campaign_id]);

  return { campaign_id, new_budget };
}
