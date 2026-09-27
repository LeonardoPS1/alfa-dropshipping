import { sendMetaDirectMessage } from '../providers/metaGraphClient';
import { sendTikTokDirectMessage } from '../providers/tiktokClient';

export interface ReplyDmInput {
  platform: 'instagram' | 'tiktok';
  conversation_id: string;
  message: string;
}

// Tool simple de envío — el LLM orquestador ya decidió y redactó el mensaje
// antes de llamar esta tool; acá no hay lógica de IA, solo el envío.
export async function replyDm(input: ReplyDmInput) {
  const { platform, conversation_id, message } = input;

  if (platform === 'instagram') {
    await sendMetaDirectMessage(conversation_id, message);
  } else {
    await sendTikTokDirectMessage(conversation_id, message);
  }

  return { platform, conversation_id, sent: true };
}
