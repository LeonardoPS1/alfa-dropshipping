import axios from 'axios';
import { McpToolSchema } from '../mcp/registry';

export interface ProviderToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ProviderToolCall[];
}

export interface ToolCall {
  id: string;
  type: string;
  name: string;
  arguments: string;
}

export interface LlmResponse {
  content: string | null;
  toolCalls: ToolCall[];
  assistantMessage?: ChatMessage;
}

export interface ValidatedToolCall extends ToolCall {
  parsedArguments: Record<string, unknown>;
  wireCall: ProviderToolCall;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TOOL_ARGUMENT_LENGTH = 4096;
const client = axios.create({
  baseURL: process.env.LLM_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

function toOpenAiFunctionSchema(tools: McpToolSchema[]) {
  return tools.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

export async function callLlm(messages: ChatMessage[], tools: McpToolSchema[]): Promise<LlmResponse> {
  const { data } = await client.post('/chat/completions', {
    model: process.env.LLM_MODEL,
    messages,
    tools: tools.length ? toOpenAiFunctionSchema(tools) : undefined,
    tool_choice: tools.length ? 'auto' : undefined,
  });
  return normalizeLlmResponse(data);
}

export function normalizeLlmResponse(data: unknown): LlmResponse {
  const message = (data as any)?.choices?.[0]?.message;
  if (!message || (message.content !== null && typeof message.content !== 'string')) {
    throw new Error('LLM returned a malformed assistant message');
  }
  const wireCalls = message.tool_calls ?? [];
  if (!Array.isArray(wireCalls)) throw new Error('LLM returned malformed tool calls');

  const assistantMessage: ChatMessage = {
    role: 'assistant',
    content: message.content ?? null,
    ...(wireCalls.length ? { tool_calls: wireCalls } : {}),
  };
  const toolCalls: ToolCall[] = wireCalls.map((call: any) => ({
    id: call?.id,
    type: call?.type,
    name: call?.function?.name,
    arguments: call?.function?.arguments,
  }));
  return { content: message.content ?? null, toolCalls, assistantMessage };
}

export function validateProviderToolBatch(response: LlmResponse): ValidatedToolCall[] {
  const calls = response.toolCalls;
  const assistant = response.assistantMessage;
  if (!assistant || assistant.role !== 'assistant' || !Array.isArray(assistant.tool_calls) ||
      assistant.tool_calls.length !== calls.length || assistant.content !== response.content) {
    throw new Error('invalid assistant tool message');
  }

  const ids = new Set<string>();
  return calls.map((call, index) => {
    const wireCall = assistant.tool_calls![index];
    if (call.type !== 'function' || wireCall?.type !== 'function' ||
        typeof call.id !== 'string' || !call.id.trim() || call.id.length > 100 || ids.has(call.id) ||
        call.id !== wireCall.id || call.name !== wireCall.function?.name ||
        call.arguments !== wireCall.function?.arguments || typeof call.arguments !== 'string' ||
        call.arguments.length > MAX_TOOL_ARGUMENT_LENGTH) {
      throw new Error('invalid tool call linkage');
    }
    ids.add(call.id);
    if (call.name !== 'search_dropi_catalog' && call.name !== 'score_product') {
      throw new Error('tool is not allowlisted');
    }

    let parsed: unknown;
    try { parsed = JSON.parse(call.arguments); } catch { throw new Error('tool arguments are malformed JSON'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('tool arguments must be an object');
    const args = parsed as Record<string, unknown>;
    const allowedFields = call.name === 'search_dropi_catalog' ? ['query', 'category'] : ['product_id'];
    if (Object.keys(args).some((key) => !allowedFields.includes(key))) throw new Error('tool arguments contain an unsupported field');

    if (call.name === 'search_dropi_catalog') {
      if (args.query !== undefined && (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 120)) {
        throw new Error('search query is invalid');
      }
      if (args.category !== undefined && (typeof args.category !== 'string' || !args.category.trim() || args.category.length > 80)) {
        throw new Error('search category is invalid');
      }
      if (args.query === undefined && args.category === undefined) throw new Error('search term is required');
    } else if (typeof args.product_id !== 'string' || !UUID_PATTERN.test(args.product_id)) {
      throw new Error('product ID is invalid');
    }

    return { ...call, parsedArguments: args, wireCall };
  });
}

export function validateToolTranscript(messages: ChatMessage[]): true {
  const pending = new Map<string, string>();
  for (const message of messages) {
    if (message.role === 'tool') {
      const expectedName = message.tool_call_id ? pending.get(message.tool_call_id) : undefined;
      if (!expectedName || expectedName !== message.name) throw new Error('tool transcript contains an unmatched result');
      pending.delete(message.tool_call_id!);
      continue;
    }
    if (pending.size > 0) throw new Error('tool transcript is missing results before the next provider message');
    if (message.role !== 'assistant' || !message.tool_calls?.length) continue;

    const ids = message.tool_calls.map((call) => call.id);
    if (ids.some((id) => typeof id !== 'string' || id.length === 0) || new Set(ids).size !== ids.length) {
      throw new Error('tool transcript contains duplicate or empty call IDs');
    }
    message.tool_calls.forEach((call) => pending.set(call.id, call.function.name));
  }
  if (pending.size > 0) throw new Error('tool transcript does not contain a result for every call');
  return true;
}
