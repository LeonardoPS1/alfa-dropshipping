import { pool } from '../db/pool';
import { setMetaCampaignStatus } from '../providers/metaMarketingClient';
import { setTikTokCampaignStatus } from '../providers/tiktokAdsClient';

export interface PauseCampaignInput {
  tenant_id?: string; // opcional: la llamada interna de automatización no siempre tiene tenant_id a mano
  campaign_id: string;
  reason?: string;
}

/**
 * Lógica de servicio compartida entre la tool MCP (uso manual desde el chat)
 * y el endpoint interno /internal/campaigns/:id/auto-pause (uso desde n8n).
 */
export async function pauseCampaignService(campaignId: string, reason: string, source: 'manual' | 'auto_pause_cron') {
  const campaignRes = await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [campaignId]);
  if (campaignRes.rows.length === 0) throw new Error(`campaña ${campaignId} no encontrada`);
  const campaign = campaignRes.rows[0];

  if (campaign.platform === 'meta') {
    await setMetaCampaignStatus(campaign.platform_campaign_id, 'PAUSED');
  } else {
    await setTikTokCampaignStatus(campaign.platform_campaign_id, 'DISABLE');
  }

  await pool.query(
    `UPDATE campaigns SET status = 'paused', auto_paused_at = now(), auto_pause_reason = $1 WHERE id = $2`,
    [reason, campaignId]
  );

  return { campaign_id: campaignId, status: 'paused', reason, source };
}

export async function pauseUnderperformer(input: PauseCampaignInput) {
  return pauseCampaignService(input.campaign_id, input.reason ?? 'pausado manualmente', 'manual');
}
