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
    [tenantId, subagent, toolName, JSON.stringify(sanitize(input)), JSON.stringify(sanitize(output)), JSON.stringify(sanitize(metadata ?? {}))]
  );
}

const SECRET_KEY_PATTERN = /(token|api_?key|secret|password|authorization|credential|connection.?string)/i;
const MAX_DEPTH = 5;
const MAX_KEYS = 24;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 512;

export function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value;
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [k, v] of entries.slice(0, MAX_KEYS)) {
      out[k] = SECRET_KEY_PATTERN.test(k) ? '[REDACTED]' : sanitize(v, depth + 1);
    }
    if (entries.length > MAX_KEYS) out.__truncated_keys = entries.length - MAX_KEYS;
    return out;
  }
  return String(value).slice(0, MAX_STRING_LENGTH);
}
