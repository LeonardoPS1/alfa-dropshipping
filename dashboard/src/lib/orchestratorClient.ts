import axios from 'axios';

const client = axios.create({
  baseURL: process.env.ALFA_ORCHESTRATOR_URL,
  timeout: 30000,
});

export interface ChatResponse {
  reply: string;
  attachments: string[];
}

export async function sendChatMessage(tenantId: string, message: string): Promise<ChatResponse> {
  const { data } = await client.post('/chat', { tenant_id: tenantId, message });
  return data;
}
