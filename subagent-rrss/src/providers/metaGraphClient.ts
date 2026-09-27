import axios from 'axios';

const GRAPH_BASE = 'https://graph.facebook.com/v20.0';

/**
 * Publica en Instagram vía Meta Graph API: crea un media container y luego
 * lo publica. El "creative" (imagen/video) debe ser una URL pública
 * (la que produce el subagente de Imagen vía ASSET_PUBLIC_BASE_URL).
 */
export async function publishInstagramPost(params: { imageUrl: string; caption: string }): Promise<string> {
  const igBusinessId = process.env.META_IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.META_PAGE_ACCESS_TOKEN;

  const containerResp = await axios.post(`${GRAPH_BASE}/${igBusinessId}/media`, null, {
    params: { image_url: params.imageUrl, caption: params.caption, access_token: token },
    timeout: 20000,
  });
  const creationId = containerResp.data.id;

  const publishResp = await axios.post(`${GRAPH_BASE}/${igBusinessId}/media_publish`, null, {
    params: { creation_id: creationId, access_token: token },
    timeout: 20000,
  });

  return publishResp.data.id as string;
}

export async function getInstagramMediaInsights(mediaId: string) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const { data } = await axios.get(`${GRAPH_BASE}/${mediaId}/insights`, {
    params: { metric: 'likes,comments,shares,reach', access_token: token },
    timeout: 15000,
  });

  const values: Record<string, number> = {};
  for (const item of data.data ?? []) {
    values[item.name] = item.values?.[0]?.value ?? 0;
  }
  return values;
}

export async function sendMetaDirectMessage(conversationId: string, message: string): Promise<void> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  await axios.post(
    `${GRAPH_BASE}/me/messages`,
    { recipient: { id: conversationId }, message: { text: message } },
    { params: { access_token: token }, timeout: 15000 }
  );
}
