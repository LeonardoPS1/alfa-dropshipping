import { Pool } from 'pg';

// El dashboard SOLO lee de Postgres. Ninguna escritura ocurre desde acá —
// toda escritura pasa por el chat -> orquestador -> subagentes, para que
// agent_logs quede como registro completo de todo lo que pasó.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
