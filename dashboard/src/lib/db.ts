import { Pool } from 'pg';
import { DEFAULT_TENANT_ID, getConfiguredTenantId as resolveConfiguredTenantId } from './tenantContext';

export { DEFAULT_TENANT_ID };

export function getConfiguredTenantId() {
  return resolveConfiguredTenantId();
}

// El dashboard SOLO lee de Postgres. Ninguna escritura ocurre desde acá —
// toda escritura pasa por el chat -> orquestador -> subagentes, para que
// agent_logs quede como registro completo de todo lo que pasó.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});
