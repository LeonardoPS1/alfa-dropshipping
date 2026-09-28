export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export interface AuthenticatedSession {
  user?: { id?: string | null; email?: string | null } | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getConfiguredTenantId(configuredTenantId = process.env.ALFA_TENANT_ID ?? DEFAULT_TENANT_ID): string {
  if (!UUID_PATTERN.test(configuredTenantId)) throw new Error('Configured tenant ID is invalid');
  return configuredTenantId;
}

export function resolveTenantId(
  session: AuthenticatedSession | null,
  configuredTenantId = process.env.ALFA_TENANT_ID ?? DEFAULT_TENANT_ID
): string {
  if (!session?.user) throw new Error('Authenticated session is required');
  return getConfiguredTenantId(configuredTenantId);
}
