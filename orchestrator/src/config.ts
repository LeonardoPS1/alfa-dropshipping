export interface OrchestratorConfig {
  internalToken: string;
  tenantId: string;
  productToken: string;
  productUrl: string;
}

export class OrchestratorConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrchestratorConfigurationError';
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function loadOrchestratorConfig(env: Record<string, string | undefined> = process.env): OrchestratorConfig {
  const internalToken = env.ORCHESTRATOR_INTERNAL_TOKEN?.trim() ?? '';
  const tenantId = env.ORCHESTRATOR_TENANT_ID?.trim() ?? '';
  const productToken = env.ORCHESTRATOR_PRODUCT_TOKEN?.trim() ?? '';
  const productUrl = env.MCP_PRODUCTO_URL?.trim() ?? '';

  if (!internalToken) throw new OrchestratorConfigurationError('ORCHESTRATOR_INTERNAL_TOKEN is required');
  if (!UUID_PATTERN.test(tenantId)) throw new OrchestratorConfigurationError('ORCHESTRATOR_TENANT_ID must be a UUID');
  if (!productToken || productToken === internalToken) {
    throw new OrchestratorConfigurationError('ORCHESTRATOR_PRODUCT_TOKEN must be distinct and nonempty');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(productUrl);
  } catch {
    throw new OrchestratorConfigurationError('MCP_PRODUCTO_URL must be a valid HTTP URL');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new OrchestratorConfigurationError('MCP_PRODUCTO_URL must not include credentials and must use HTTP or HTTPS');
  }

  return { internalToken, tenantId, productToken, productUrl: parsedUrl.origin };
}
