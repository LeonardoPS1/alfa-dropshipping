import { timingSafeEqual } from 'node:crypto';
import { Request, Response, Router } from 'express';
import { OrchestratorConfig } from '../config';
import { logAgentCall, sanitize } from '../db/pool';
import { ChatMessage, LlmResponse, ValidatedToolCall, callLlm, validateProviderToolBatch, validateToolTranscript } from '../llm/client';
import { allToolSchemas, findSubagentForTool, McpSubagent } from '../mcp/registry';
import { callTool } from '../mcp/client';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PROVIDER_TURNS = 6;
const MAX_TOOL_CALLS = 8;
const MAX_USER_MESSAGE_LENGTH = 2000;
const SYSTEM_PROMPT = `Sos ALFA. Ayudás a evaluar productos con evidencia disponible. Para esta conversación solo podés buscar en el catálogo de Dropi y evaluar un producto ya guardado. No publiques, no escribas en Shopify, no crees campañas ni modifiques workflows. Si una operación falla o la evidencia no alcanza, explicalo sin inventar resultados.`;

export interface ChatDependencies {
  config: OrchestratorConfig;
  callLlm?: (messages: ChatMessage[], tools: ReturnType<typeof allToolSchemas>) => Promise<LlmResponse>;
  callTool?: (subagent: McpSubagent, toolName: string, params: Record<string, unknown>, productToken: string) => Promise<unknown>;
  logAgentCall?: typeof logAgentCall;
}

class RequestContractError extends Error {
  constructor(readonly code: string) { super(code); }
}

export function createChatRouter(dependencies: ChatDependencies): Router {
  const router = Router();
  const invokeLlm = dependencies.callLlm ?? callLlm;
  const invokeTool = dependencies.callTool ?? callTool;
  const writeAudit = dependencies.logAgentCall ?? logAgentCall;
  const { config } = dependencies;

  router.post('/', async (req: Request, res: Response) => {
    if (!equalSecret(config.internalToken, req.header('X-Alfa-Internal-Token') ?? '')) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const tenantId = req.header('X-Alfa-Tenant-Id') ?? '';
    const requestId = req.header('X-Alfa-Request-Id') ?? '';
    if (!UUID_PATTERN.test(tenantId) || tenantId !== config.tenantId) {
      return res.status(403).json({ error: 'untrusted_tenant' });
    }
    if (!UUID_PATTERN.test(requestId)) return res.status(400).json({ error: 'invalid_request_id' });

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body as Record<string, unknown>
      : {};
    if (body.tenant_id !== undefined && body.tenant_id !== tenantId) {
      const recorded = await recordFailure(writeAudit, tenantId, requestId, 'protocol_failure');
      if (!recorded) return res.status(500).json({ error: 'audit_failure', request_id: requestId });
      return res.status(403).json({ error: 'tenant_context_mismatch' });
    }
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > MAX_USER_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'invalid_message' });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: body.message },
    ];
    let dispatched = 0;

    for (let turn = 1; turn <= MAX_PROVIDER_TURNS; turn += 1) {
      let response: LlmResponse;
      try {
        response = await invokeLlm(messages, allToolSchemas());
      } catch {
        const recorded = await recordFailure(writeAudit, tenantId, requestId, 'provider_failure', turn);
        return respond(res, recorded ? 502 : 500, recorded ? 'provider_failure' : 'audit_failure', requestId, dispatched > 0);
      }

      if (!response || !Array.isArray(response.toolCalls)) {
        const recorded = await recordFailure(writeAudit, tenantId, requestId, 'protocol_failure', turn);
        return respond(res, recorded ? 422 : 500, recorded ? 'malformed_provider_response' : 'audit_failure', requestId, dispatched > 0);
      }
      if (response.toolCalls.length === 0) {
        return res.json({ reply: boundedReply(response.content), attachments: [] });
      }
      if (response.toolCalls.length > MAX_TOOL_CALLS - dispatched) {
        const recorded = await recordFailure(writeAudit, tenantId, requestId, 'budget_failure', turn);
        return respond(res, recorded ? 422 : 500, recorded ? 'tool_call_budget_exceeded' : 'audit_failure', requestId, dispatched > 0);
      }

      let calls: ValidatedToolCall[];
      try {
        calls = validateProviderToolBatch(response);
      } catch {
        const recorded = await recordFailure(writeAudit, tenantId, requestId, 'protocol_failure', turn);
        return respond(res, recorded ? 422 : 500, recorded ? 'invalid_tool_call_batch' : 'audit_failure', requestId, dispatched > 0);
      }

      messages.push(response.assistantMessage!);
      for (const call of calls) {
        const subagent = findSubagentForTool(call.name);
        if (!subagent || subagent.key !== 'producto') {
          const recorded = await recordToolAudit(writeAudit, tenantId, 'producto', call, requestId, 'protocol_failure', { code: 'tool_not_allowed' });
          return respond(res, recorded ? 422 : 500, recorded ? 'tool_not_allowed' : 'audit_failure', requestId, dispatched > 0);
        }

        let output: unknown;
        try {
          output = await invokeTool(subagent, call.name, {
            ...call.parsedArguments,
            tenant_id: tenantId,
            request_id: requestId,
          }, config.productToken);
        } catch {
          const recorded = await recordToolAudit(writeAudit, tenantId, subagent.key, call, requestId, 'tool_failure', { code: 'product_tool_failed' });
          return respond(res, recorded ? 502 : 500, recorded ? 'product_tool_failed' : 'audit_failure', requestId, dispatched > 0);
        }

        const summary = sanitize(output);
        if (isFailedOutcome(output)) {
          const partial = isPartialOutcome(output);
          const outcome = partial ? 'partial' : 'tool_failure';
          const recorded = await recordToolAudit(writeAudit, tenantId, subagent.key, call, requestId, outcome, summary);
          return respond(res, recorded ? 502 : 500, recorded ? 'product_tool_failed' : 'audit_failure', requestId, partial || dispatched > 0);
        }

        const recorded = await recordToolAudit(writeAudit, tenantId, subagent.key, call, requestId, 'success', summary);
        if (!recorded) return respond(res, 500, 'audit_failure', requestId, true);
        dispatched += 1;
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: JSON.stringify(summary),
        });
      }

      try {
        validateToolTranscript(messages);
      } catch {
        const recorded = await recordFailure(writeAudit, tenantId, requestId, 'protocol_failure', turn);
        return respond(res, recorded ? 422 : 500, recorded ? 'invalid_tool_transcript' : 'audit_failure', requestId, true);
      }
    }

    const recorded = await recordFailure(writeAudit, tenantId, requestId, 'budget_failure', MAX_PROVIDER_TURNS);
    return respond(res, recorded ? 422 : 500, recorded ? 'provider_turn_budget_exceeded' : 'audit_failure', requestId, true);
  });

  return router;
}

function equalSecret(expected: string, supplied: string): boolean {
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

async function recordFailure(
  log: typeof logAgentCall,
  tenantId: string,
  requestId: string,
  outcome: string,
  turn?: number,
): Promise<boolean> {
  try {
    await log({
      tenantId,
      subagent: 'orchestrator',
      toolName: 'chat',
      input: { request_id: requestId },
      output: { code: outcome },
      metadata: { request_id: requestId, ...(turn ? { provider_turn: turn } : {}), trigger: 'chat', outcome },
    });
    return true;
  } catch {
    return false;
  }
}

async function recordToolAudit(
  log: typeof logAgentCall,
  tenantId: string,
  subagent: string,
  call: ValidatedToolCall,
  requestId: string,
  outcome: string,
  output: unknown,
): Promise<boolean> {
  try {
    await log({
      tenantId,
      subagent,
      toolName: call.name,
      input: sanitize(call.parsedArguments),
      output: sanitize(output),
      metadata: {
        request_id: requestId,
        tool_call_id: call.id,
        trigger: 'chat',
        outcome,
        ...extractResultIds(output),
      },
    });
    return true;
  } catch {
    return false;
  }
}

function extractResultIds(value: unknown): { product_ids: string[]; evaluation_ids: string[] } {
  const productIds = new Set<string>();
  const evaluationIds = new Set<string>();
  if (!value || typeof value !== 'object') return { product_ids: [], evaluation_ids: [] };
  const result = value as Record<string, any>;
  const candidates = [result.product_id, ...(Array.isArray(result.products) ? result.products.map((item: any) => item?.id) : [])];
  for (const candidate of candidates) if (typeof candidate === 'string' && UUID_PATTERN.test(candidate)) productIds.add(candidate);
  for (const candidate of [result.evaluation_id, ...(Array.isArray(result.evaluation_ids) ? result.evaluation_ids : [])]) {
    if (typeof candidate === 'string' && UUID_PATTERN.test(candidate)) evaluationIds.add(candidate);
  }
  return { product_ids: [...productIds], evaluation_ids: [...evaluationIds] };
}

function isFailedOutcome(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return Boolean(result.error) || result.status === 'failed' || result.status === 'partial';
}

function isPartialOutcome(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).status === 'partial');
}

function boundedReply(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.length > MAX_USER_MESSAGE_LENGTH ? `${value.slice(0, MAX_USER_MESSAGE_LENGTH)}…` : value;
}

function respond(res: Response, status: number, code: string, requestId?: string, partial = false) {
  return res.status(status).json({ status: partial ? 'partial' : 'failed', code, ...(requestId ? { request_id: requestId } : {}) });
}
