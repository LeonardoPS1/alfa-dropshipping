import axios from 'axios';

export interface McpToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
}

export interface McpSubagent {
  key: string;       // 'producto' | 'copywriting' | 'imagen' | 'ecommerce' | 'rrss' | 'ads'
  baseUrl: string;
  tools: McpToolSchema[];
}

const SUBAGENT_URLS: Record<string, string | undefined> = {
  producto: process.env.MCP_PRODUCTO_URL,
  copywriting: process.env.MCP_COPYWRITING_URL,
  imagen: process.env.MCP_IMAGEN_URL,
  ecommerce: process.env.MCP_ECOMMERCE_URL,
  rrss: process.env.MCP_RRSS_URL,
  ads: process.env.MCP_ADS_URL,
};

const registry: McpSubagent[] = [];

export function getRegistry(): McpSubagent[] {
  return registry;
}

export function findSubagentForTool(toolName: string): McpSubagent | undefined {
  return registry.find((s) => s.tools.some((t) => t.name === toolName));
}

export function allToolSchemas(): McpToolSchema[] {
  return registry.flatMap((s) => s.tools);
}

/**
 * Descubre las tools de cada subagente vía GET /tools, con reintentos
 * porque los contenedores pueden arrancar en orden distinto.
 */
export async function discoverSubagents(): Promise<void> {
  const entries = Object.entries(SUBAGENT_URLS).filter(([, url]) => !!url) as [string, string][];

  await Promise.all(
    entries.map(async ([key, baseUrl]) => {
      const tools = await fetchToolsWithRetry(baseUrl, key);
      registry.push({ key, baseUrl, tools });
      console.log(`[registry] ${key} registrado con ${tools.length} tools desde ${baseUrl}`);
    })
  );
}

async function fetchToolsWithRetry(baseUrl: string, key: string, attempts = 10): Promise<McpToolSchema[]> {
  for (let i = 0; i < attempts; i++) {
    try {
      const { data } = await axios.get<{ tools: McpToolSchema[] }>(`${baseUrl}/tools`, { timeout: 5000 });
      return data.tools;
    } catch (err) {
      if (i === attempts - 1) {
        console.error(`[registry] no se pudo conectar a subagente '${key}' en ${baseUrl}, arranca sin sus tools`);
        return [];
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return [];
}
