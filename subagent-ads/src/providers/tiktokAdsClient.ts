import axios from 'axios';

const TIKTOK_ADS_BASE = 'https://business-api.tiktok.com/open_api/v1.3';
const client = axios.create({ timeout: 20000 });
const headers = () => ({ 'Access-Token': process.env.TIKTOK_ACCESS_TOKEN ?? '' });
const advertiserId = () => process.env.TIKTOK_ADVERTISER_ID;

export async function createTikTokCampaign(params: { productName: string; objective: string }) {
  const { data } = await client.post(
    `${TIKTOK_ADS_BASE}/campaign/create/`,
    {
      advertiser_id: advertiserId(),
      campaign_name: `ALFA - ${params.productName}`,
      objective_type: params.objective || 'CONVERSIONS',
      budget_mode: 'BUDGET_MODE_INFINITE',
    },
    { headers: headers() }
  );
  return data.data.campaign_id as string;
}

export async function createTikTokAdGroup(params: { campaignId: string; budgetCents: number; productName: string }) {
  const { data } = await client.post(
    `${TIKTOK_ADS_BASE}/adgroup/create/`,
    {
      advertiser_id: advertiserId(),
      campaign_id: params.campaignId,
      adgroup_name: `ALFA AdGroup - ${params.productName}`,
      budget: params.budgetCents / 100,
      budget_mode: 'BUDGET_MODE_DAY',
      billing_event: 'CPM',
      optimization_goal: 'CONVERT',
      location_ids: ['6252001'], // Chile — placeholder documentado, ajustar por catálogo real de location_ids de TikTok Ads
    },
    { headers: headers() }
  );
  return data.data.adgroup_id as string;
}

export async function createTikTokAd(params: { adGroupId: string; videoUrl: string; message: string; productName: string }) {
  const { data } = await client.post(
    `${TIKTOK_ADS_BASE}/ad/create/`,
    {
      advertiser_id: advertiserId(),
      adgroup_id: params.adGroupId,
      creatives: [{ ad_name: `ALFA Ad - ${params.productName}`, ad_text: params.message, video_url: params.videoUrl }],
    },
    { headers: headers() }
  );
  return data.data.ad_ids?.[0] as string;
}

export async function setTikTokAdGroupBudget(adGroupId: string, budgetCents: number) {
  await client.post(
    `${TIKTOK_ADS_BASE}/adgroup/update/`,
    { advertiser_id: advertiserId(), adgroup_id: adGroupId, budget: budgetCents / 100 },
    { headers: headers() }
  );
}

export async function setTikTokCampaignStatus(campaignId: string, status: 'ENABLE' | 'DISABLE') {
  await client.post(
    `${TIKTOK_ADS_BASE}/campaign/update/status/`,
    { advertiser_id: advertiserId(), campaign_ids: [campaignId], operation_status: status },
    { headers: headers() }
  );
}

export async function getTikTokCampaignInsights(campaignId: string) {
  const { data } = await client.get(`${TIKTOK_ADS_BASE}/report/integrated/get/`, {
    params: {
      advertiser_id: advertiserId(),
      report_type: 'BASIC',
      dimensions: JSON.stringify(['campaign_id']),
      metrics: JSON.stringify(['spend', 'impressions', 'conversion']),
      filters: JSON.stringify([{ field_name: 'campaign_ids', filter_type: 'IN', filter_value: JSON.stringify([campaignId]) }]),
    },
    headers: headers(),
  });
  const row = data.data?.list?.[0]?.metrics ?? {};
  return {
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    conversions: Number(row.conversion ?? 0),
  };
}
