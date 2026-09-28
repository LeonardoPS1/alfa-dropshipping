import type { AuthenticatedSession } from './tenantContext';

export interface ChatProxyResponse {
  status: number;
  body: unknown;
}

export interface ChatProxyDependencies {
  getSession: () => Promise<AuthenticatedSession | null>;
  resolveTenant: (session: AuthenticatedSession | null) => string;
  createRequestId: () => string;
  sendMessage: (tenantId: string, requestId: string, message: string) => Promise<unknown | ChatProxyResponse>;
}

export function proxyChatRequest(dependencies: ChatProxyDependencies) {
  return async (input: unknown): Promise<ChatProxyResponse> => {
    const session = await dependencies.getSession();
    if (!session) return { status: 401, body: { error: 'Authentication required' } };
    if (!input || typeof input !== 'object' || typeof (input as { message?: unknown }).message !== 'string' || !(input as { message: string }).message.trim()) {
      return { status: 400, body: { error: 'Message is required' } };
    }

    try {
      const tenantId = dependencies.resolveTenant(session);
      const requestId = dependencies.createRequestId();
      const result = await dependencies.sendMessage(tenantId, requestId, (input as { message: string }).message);
      if (isProxyResponse(result)) return result;
      return { status: 200, body: result };
    } catch {
      return { status: 502, body: { status: 'failed', error: 'Orchestrator unavailable' } };
    }
  };
}

function isProxyResponse(value: unknown): value is ChatProxyResponse {
  return Boolean(value && typeof value === 'object' && 'status' in value && 'body' in value && typeof (value as ChatProxyResponse).status === 'number');
}
