import inputSchemas from './mcp-tool-input-schemas.json';

export const MCP_TOOL_STARTUP_ESTIMATE_METHOD =
  'chars/4 on compact JSON of name + description (typical IDE session start)';

export const MCP_TOOL_EXECUTION_ESTIMATE_METHOD =
  'chars/4 on compact JSON of full list_tools payload (name, description, inputSchema)';

type JsonSchema = Record<string, unknown>;

const schemasByKey = inputSchemas as Record<string, JsonSchema>;

export interface McpToolTokenEstimate {
  startupTokens: number;
  executionTokens: number;
}

export function getMcpToolInputSchema(key: string): JsonSchema {
  const schema = schemasByKey[key];
  if (!schema) {
    throw new Error(`Missing MCP input schema for tool '${key}'`);
  }
  return schema;
}

function estimateTokensFromPayload(payload: string): number {
  return Math.ceil(payload.length / 4);
}

export function estimateMcpToolStartupTokens(
  name: string,
  description: string,
): number {
  const payload = JSON.stringify({ name, description });
  return estimateTokensFromPayload(payload);
}

export function estimateMcpToolExecutionTokens(
  name: string,
  description: string,
  inputSchema: JsonSchema,
): number {
  const payload = JSON.stringify({
    name,
    description,
    inputSchema,
  });
  return estimateTokensFromPayload(payload);
}

export function estimateMcpToolTokens(
  key: string,
  description: string,
): McpToolTokenEstimate {
  return {
    startupTokens: estimateMcpToolStartupTokens(key, description),
    executionTokens: estimateMcpToolExecutionTokens(
      key,
      description,
      getMcpToolInputSchema(key),
    ),
  };
}
