import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function logAgentCall(params: {
  tenantId: string;
  subagent: string;
  toolName: string;
  input: unknown;
  output: unknown;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { tenantId, subagent, toolName, input, output, metadata } = params;
  await pool.query(
    `INSERT INTO agent_logs (tenant_id, subagent, tool_name, input, output, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, subagent, toolName, JSON.stringify(sanitize(input)), JSON.stringify(sanitize(output)), JSON.stringify(metadata ?? {})]
  );
}

// Nunca persistir tokens/keys en agent_logs, aunque vengan embebidos en el payload.
const SECRET_KEY_PATTERN = /(token|api_?key|secret|password|authorization)/i;

export function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_PATTERN.test(k) ? '[REDACTED]' : sanitize(v);
    }
    return out;
  }
  return value;
}
