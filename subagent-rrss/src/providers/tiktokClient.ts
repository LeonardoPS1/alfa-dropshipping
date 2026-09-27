import axios from 'axios';

const TIKTOK_BASE = 'https://open.tiktokapis.com/v2';

/**
 * Publica contenido vía TikTok Content Posting API. El flujo real de TikTok
 * requiere iniciar el post con PULL_FROM_URL (video/imagen ya alojado
 * públicamente) y luego consultar el status hasta que quede publicado.
 */
export async function publishTikTokPost(params: { mediaUrl: string; caption: string }): Promise<string> {
  const token = process.env.TIKTOK_ACCESS_TOKEN;

  const { data } = await axios.post(
    `${TIKTOK_BASE}/post/publish/content/init/`,
    {
      post_info: { title: params.caption, privacy_level: 'PUBLIC_TO_EVERYONE' },
      source_info: { source: 'PULL_FROM_URL', video_url: params.mediaUrl },
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 20000 }
  );

  return data.data.publish_id as string;
}

export async function getTikTokPostInsights(publishId: string) {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  const { data } = await axios.post(
    `${TIKTOK_BASE}/post/publish/status/fetch/`,
    { publish_id: publishId },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
  );

  return {
    likes: data.data?.like_count ?? 0,
    comments: data.data?.comment_count ?? 0,
    shares: data.data?.share_count ?? 0,
    reach: data.data?.view_count ?? 0,
  };
}

export async function sendTikTokDirectMessage(conversationId: string, message: string): Promise<void> {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  await axios.post(
    `${TIKTOK_BASE}/message/send/`,
    { conversation_id: conversationId, content: message },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
  );
}
