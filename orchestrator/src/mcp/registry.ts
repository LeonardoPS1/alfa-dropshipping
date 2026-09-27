export interface McpToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface McpSubagent {
  key: 'producto';
  baseUrl: string;
  tools: McpToolSchema[];
}

export const PRODUCT_TOOL_SCHEMAS: McpToolSchema[] = [
  {
    name: 'search_dropi_catalog',
    description: 'Search the read-only Dropi product catalog for products to evaluate.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 120 },
        category: { type: 'string', maxLength: 80 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'score_product',
    description: 'Evaluate a previously discovered product by its internal UUID.',
    parameters: {
      type: 'object',
      properties: { product_id: { type: 'string', format: 'uuid' } },
      required: ['product_id'],
      additionalProperties: false,
    },
  },
];

const toolNames = new Set(PRODUCT_TOOL_SCHEMAS.map((tool) => tool.name));

export function getRegistry(): McpSubagent[] {
  return [{ key: 'producto', baseUrl: process.env.MCP_PRODUCTO_URL ?? '', tools: allToolSchemas() }];
}

export function findSubagentForTool(toolName: string): McpSubagent | undefined {
  if (!toolNames.has(toolName)) return undefined;
  return getRegistry()[0];
}

export function allToolSchemas(): McpToolSchema[] {
  return PRODUCT_TOOL_SCHEMAS.map((schema) => ({ ...schema, parameters: { ...schema.parameters } }));
}
