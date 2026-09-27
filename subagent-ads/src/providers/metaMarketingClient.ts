import axios from 'axios';

const GRAPH_BASE = 'https://graph.facebook.com/v20.0';
const client = axios.create({ timeout: 20000 });
const token = () => process.env.META_MARKETING_ACCESS_TOKEN;
const adAccountId = () => process.env.META_AD_ACCOUNT_ID; // formato act_XXXXXXXXX

export async function createMetaCampaign(params: { productName: string; objective: string }) {
  const { data } = await client.post(`${GRAPH_BASE}/${adAccountId()}/campaigns`, null, {
    params: {
      name: `ALFA - ${params.productName}`,
      objective: params.objective || 'OUTCOME_SALES',
      status: 'PAUSED', // arranca pausada, se activa recién al crear el ad set + ads
      special_ad_categories: JSON.stringify([]),
      access_token: token(),
    },
  });
  return data.id as string;
}

export async function createMetaAdSet(params: { campaignId: string; budgetCents: number; productName: string }) {
  const { data } = await client.post(`${GRAPH_BASE}/${adAccountId()}/adsets`, null, {
    params: {
      name: `ALFA AdSet - ${params.productName}`,
      campaign_id: params.campaignId,
      daily_budget: params.budgetCents,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      targeting: JSON.stringify({
        geo_locations: { countries: ['CL'] },
        age_min: 18,
        age_max: 45,
      }),
      status: 'PAUSED',
      access_token: token(),
    },
  });
  return data.id as string;
}

export async function createMetaAd(params: { adSetId: string; creativeImageUrl: string; message: string; productName: string }) {
  const creativeResp = await client.post(`${GRAPH_BASE}/${adAccountId()}/adcreatives`, null, {
    params: {
      name: `ALFA Creative - ${params.productName}`,
      object_story_spec: JSON.stringify({
        page_id: process.env.META_PAGE_ID,
        link_data: { image_hash: undefined, picture: params.creativeImageUrl, message: params.message },
      }),
      access_token: token(),
    },
  });
  const creativeId = creativeResp.data.id;

  const { data } = await client.post(`${GRAPH_BASE}/${adAccountId()}/ads`, null, {
    params: {
      name: `ALFA Ad - ${params.productName}`,
      adset_id: params.adSetId,
      creative: JSON.stringify({ creative_id: creativeId }),
      status: 'ACTIVE',
      access_token: token(),
    },
  });
  return data.id as string;
}

export async function setMetaCampaignBudget(campaignId: string, budgetCents: number) {
  await client.post(`${GRAPH_BASE}/${campaignId}`, null, {
    params: { daily_budget: budgetCents, access_token: token() },
  });
}

export async function setMetaCampaignStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED') {
  await client.post(`${GRAPH_BASE}/${campaignId}`, null, {
    params: { status, access_token: token() },
  });
}

export async function getMetaCampaignInsights(campaignId: string) {
  const { data } = await client.get(`${GRAPH_BASE}/${campaignId}/insights`, {
    params: { fields: 'spend,impressions,conversions', access_token: token() },
  });
  const row = data.data?.[0] ?? {};
  return {
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    conversions: Number(row.conversions?.[0]?.value ?? 0),
  };
}
