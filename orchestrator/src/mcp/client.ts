import axios from 'axios';
import { McpSubagent } from './registry';

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
  params: Record<string, unknown>
): Promise<unknown> {
  try {
    const { data } = await axios.post(`${subagent.baseUrl}/tools/${toolName}`, params, {
      timeout: 10000,
    });
    return data;
  } catch (err: any) {
    const message = err.response?.data?.error ?? err.message ?? 'error desconocido';
    throw new McpToolError(`Fallo al llamar ${toolName} en ${subagent.key}: ${message}`, toolName);
  }
}
