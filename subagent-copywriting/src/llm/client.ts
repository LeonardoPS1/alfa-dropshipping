import axios from 'axios';

const client = axios.create({
  baseURL: process.env.LLM_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 45000,
});

export async function generateText(systemPrompt: string, userPrompt: string): Promise<string> {
  const { data } = await client.post('/chat/completions', {
    model: process.env.LLM_MODEL_COPY,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });
  return data.choices[0].message.content as string;
}
