import axios from 'axios';
import { McpToolSchema } from '../mcp/registry';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmResponse {
  content: string | null;
  toolCalls: ToolCall[];
}

const client = axios.create({
  baseURL: process.env.LLM_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

function toOpenAiFunctionSchema(tools: McpToolSchema[]) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export async function callLlm(messages: ChatMessage[], tools: McpToolSchema[]): Promise<LlmResponse> {
  const { data } = await client.post('/chat/completions', {
    model: process.env.LLM_MODEL,
    messages,
    tools: tools.length ? toOpenAiFunctionSchema(tools) : undefined,
    tool_choice: tools.length ? 'auto' : undefined,
  });

  const choice = data.choices[0];
  const msg = choice.message;

  const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map((tc: any) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: safeParseJson(tc.function.arguments),
  }));

  return { content: msg.content ?? null, toolCalls };
}

function safeParseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
