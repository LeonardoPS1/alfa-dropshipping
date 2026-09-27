import { Router } from 'express';
import { callLlm, ChatMessage } from '../llm/client';
import { allToolSchemas, findSubagentForTool } from '../mcp/registry';
import { callTool } from '../mcp/client';
import { logAgentCall } from '../db/pool';

export const chatRouter = Router();

const SYSTEM_PROMPT = `Sos ALFA, el agente orquestador de un sistema de dropshipping.
Respondés siempre en español, de forma directa y profesional.
Coordinás subagentes especializados (producto, copywriting, imagen, ecommerce, rrss, ads) llamando a sus tools.
Reglas importantes:
- Antes de generar creativos para un producto, verificá que exista una evaluación (evaluations). Si no existe, avisá y ofrecé correrla primero.
- Antes de publicar en Shopify, verificá que existan copy e imágenes generadas para ese producto.
- Nunca ejecutes pause_underperformer sin antes mostrar el ROAS actual que lo justifica (llamá get_roas primero).
- Si te llega un mensaje marcado como automatización (source: 'automation'), ejecutá la acción pedida directamente, sin pedir confirmación conversacional.
- Justificá siempre tus recomendaciones de producto o de campaña con los datos concretos que obtuviste de las tools.`;

const MAX_TOOL_HOPS = 6;

chatRouter.post('/', async (req, res) => {
  const { tenant_id, message, source } = req.body as {
    tenant_id: string;
    message: string;
    source?: 'chat' | 'automation';
  };

  if (!tenant_id || !message) {
    return res.status(400).json({ error: 'tenant_id y message son requeridos' });
  }

  const tools = allToolSchemas();
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: message },
  ];

  const attachments: string[] = [];

  try {
    let hops = 0;
    while (hops < MAX_TOOL_HOPS) {
      hops++;
      const response = await callLlm(messages, tools);

      if (response.toolCalls.length === 0) {
        return res.json({ reply: response.content ?? '', attachments });
      }

      messages.push({
        role: 'assistant',
        content: response.content ?? '',
      });

      for (const call of response.toolCalls) {
        const subagent = findSubagentForTool(call.name);
        if (!subagent) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.name,
            content: JSON.stringify({ error: `tool '${call.name}' no está registrada en ningún subagente` }),
          });
          continue;
        }

        let output: unknown;
        try {
          output = await callTool(subagent, call.name, { ...call.arguments, tenant_id });
        } catch (err: any) {
          output = { error: err.message };
        }

        await logAgentCall({
          tenantId: tenant_id,
          subagent: subagent.key,
          toolName: call.name,
          input: call.arguments,
          output,
          metadata: { triggered_by: source === 'automation' ? 'n8n' : 'chat' },
        });

        collectAttachments(output, attachments);

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.name,
          content: JSON.stringify(output),
        });
      }
    }

    return res.json({
      reply: 'Se alcanzó el límite de pasos de razonamiento para este mensaje. Pedime la siguiente acción por separado.',
      attachments,
    });
  } catch (err: any) {
    console.error('[chat] error', err);
    return res.status(500).json({ error: err.message ?? 'error interno' });
  }
});

function collectAttachments(output: unknown, attachments: string[]) {
  if (!output || typeof output !== 'object') return;
  const obj = output as Record<string, unknown>;
  if (Array.isArray((obj as any).variants)) {
    for (const v of (obj as any).variants) {
      if (v?.url) attachments.push(v.url);
    }
  }
  if (typeof (obj as any).content === 'string' && /^https?:\/\//.test((obj as any).content)) {
    attachments.push((obj as any).content as string);
  }
}
