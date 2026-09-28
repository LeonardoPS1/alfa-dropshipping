export interface OrchestratorTransport {
  post: (url: string, body: unknown, headers: Record<string, string>) => Promise<{ data: unknown; status: number }>;
  internalToken: string | undefined;
}

export type OrchestratorResult = unknown | { status: number; body: unknown };

export async function sendChatMessage(
  tenantId: string,
  requestId: string,
  message: string,
  transport: OrchestratorTransport = defaultTransport()
): Promise<OrchestratorResult> {
  if (!transport.internalToken?.trim()) throw new Error('Orchestrator internal credential is not configured');
  if (/^REPLACE_WITH_/i.test(transport.internalToken.trim())) {
    throw new Error('Orchestrator internal credential must not be an example placeholder');
  }

  try {
    const response = await transport.post('/chat', { message }, {
      'X-Alfa-Internal-Token': transport.internalToken,
      'X-Alfa-Tenant-Id': tenantId,
      'X-Alfa-Request-Id': requestId,
    });
    if (response.status < 200 || response.status >= 300) return { status: response.status, body: response.data };
    return response.data;
  } catch (error) {
    const response = (error as { response?: { status?: number; data?: unknown } })?.response;
    if (response?.status && response.data !== undefined) return { status: response.status, body: response.data };
    throw error;
  }
}

function defaultTransport(): OrchestratorTransport {
  return {
    internalToken: process.env.DASHBOARD_ORCHESTRATOR_TOKEN,
    post: async (url, body, headers) => {
      const baseUrl = process.env.ALFA_ORCHESTRATOR_URL;
      if (!baseUrl) throw new Error('Orchestrator URL is not configured');
      const response = await fetch(new URL(url, baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json().catch(() => ({ status: 'failed', error: 'Invalid orchestrator response' }));
      return { data, status: response.status };
    },
  };
}
