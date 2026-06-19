import inputSchemas from './mcp-tool-input-schemas.json';

export const MCP_TOOL_TOKEN_ESTIMATE_METHOD =
  'chars/4 on compact JSON of MCP list_tools payload (name, description, inputSchema)';

type JsonSchema = Record<string, unknown>;

const schemasByKey = inputSchemas as Record<string, JsonSchema>;

export function getMcpToolInputSchema(key: string): JsonSchema {
  const schema = schemasByKey[key];
  if (!schema) {
    throw new Error(`Missing MCP input schema for tool '${key}'`);
  }
  return schema;
}

export function estimateMcpToolDefinitionTokens(
  name: string,
  description: string,
  inputSchema: JsonSchema,
): number {
  const payload = JSON.stringify({
    name,
    description,
    inputSchema,
  });
  return Math.ceil(payload.length / 4);
}

export function estimateMcpToolTokens(
  key: string,
  description: string,
): number {
  return estimateMcpToolDefinitionTokens(
    key,
    description,
    getMcpToolInputSchema(key),
  );
}
