import axios from 'axios';
import { McpSubagent } from './registry';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_TOOLS = new Set(['search_dropi_catalog', 'score_product']);

export class McpToolError extends Error {
  constructor(message: string, public readonly toolName: string) {
    super(message);
  }
}

/**
 * Ejecuta una tool MCP contra el subagente correspondiente.
 * Timeout de 10s: si el subagente no responde, ALFA debe poder seguir
 * razonando en vez de colgarse.
 */
export async function callTool(
  subagent: McpSubagent,
  toolName: string,
  params: Record<string, unknown>,
  productToken = process.env.ORCHESTRATOR_PRODUCT_TOKEN ?? '',
): Promise<unknown> {
  const request = buildProductToolRequest(subagent, toolName, params, productToken);
  try {
    const { data } = await axios.post(request.url, request.body, {
      timeout: 10000,
      headers: request.headers,
    });
    return data;
  } catch {
    throw new McpToolError('Product service request failed', toolName);
  }
}

export function buildProductToolRequest(
  subagent: McpSubagent,
  toolName: string,
  params: Record<string, unknown>,
  productToken: string,
) {
  if (subagent.key !== 'producto' || !ALLOWED_TOOLS.has(toolName)) {
    throw new McpToolError('Tool is not in the product discovery capability allowlist', toolName);
  }
  if (!productToken.trim()) throw new McpToolError('Product service credential is not configured', toolName);
  const tenantId = params.tenant_id;
  const requestId = params.request_id;
  if (typeof tenantId !== 'string' || !UUID_PATTERN.test(tenantId) ||
      typeof requestId !== 'string' || !UUID_PATTERN.test(requestId)) {
    throw new McpToolError('Trusted request context is invalid', toolName);
  }
  const base = new URL(subagent.baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new McpToolError('Product service URL is invalid', toolName);
  }
  const allowedFields = toolName === 'search_dropi_catalog'
    ? new Set(['query', 'category'])
    : new Set(['product_id']);
  if (Object.keys(params).some((key) => !allowedFields.has(key) && key !== 'tenant_id' && key !== 'request_id')) {
    throw new McpToolError('Tool arguments contain an unsupported field', toolName);
  }
  if (toolName === 'search_dropi_catalog') {
    const query = params.query;
    const category = params.category;
    if ((query !== undefined && (typeof query !== 'string' || query.length > 120)) ||
        (category !== undefined && (typeof category !== 'string' || category.length > 80)) ||
        (typeof query !== 'string' && typeof category !== 'string')) {
      throw new McpToolError('Search arguments are invalid', toolName);
    }
  } else if (typeof params.product_id !== 'string' || !UUID_PATTERN.test(params.product_id)) {
    throw new McpToolError('Product scoring arguments are invalid', toolName);
  }
  const body = { ...params };
  delete body.tenant_id;
  delete body.request_id;
  return {
    url: `${base.origin}/tools/${toolName}`,
    headers: {
      'X-Alfa-Internal-Token': productToken,
      'X-Alfa-Tenant-Id': tenantId,
      'X-Alfa-Request-Id': requestId,
    },
    body,
  };
}
