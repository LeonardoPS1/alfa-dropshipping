import { timingSafeEqual } from 'node:crypto';
import { Request, Response, Router } from 'express';
import { OrchestratorConfig } from '../config';
import { ChatMessage, LlmResponse, callLlm } from '../llm/client';
import { allToolSchemas } from '../mcp/registry';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_USER_MESSAGE_LENGTH = 2000;
const SYSTEM_PROMPT = `Sos ALFA. Ayudás a evaluar productos con evidencia disponible. Para esta conversación solo podés buscar en el catálogo de Dropi y evaluar un producto ya guardado. No publiques, no escribas en Shopify, no crees campañas ni modifiques workflows. Si una operación falla o la evidencia no alcanza, explicalo sin inventar resultados.`;

export interface ChatDependencies {
  config: OrchestratorConfig;
  callLlm?: (messages: ChatMessage[], tools: ReturnType<typeof allToolSchemas>) => Promise<LlmResponse>;
}

export function createChatRouter(dependencies: ChatDependencies): Router {
  const router = Router();
  const invokeLlm = dependencies.callLlm ?? callLlm;
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
      return res.status(403).json({ error: 'tenant_context_mismatch' });
    }
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > MAX_USER_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'invalid_message' });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: body.message },
    ];
    try {
      const response = await invokeLlm(messages, allToolSchemas());
      if (response.toolCalls.length > 0) return res.status(422).json({ error: 'tool_calls_not_enabled' });
      return res.json({ reply: response.content ?? '', attachments: [] });
    } catch {
      return res.status(502).json({ error: 'provider_unavailable' });
    }
  });

  return router;
}

function equalSecret(expected: string, supplied: string): boolean {
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
