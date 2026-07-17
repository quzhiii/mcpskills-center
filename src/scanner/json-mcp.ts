import { readFile } from 'node:fs/promises';
import { parseJsonConfig } from '../config/parse.js';
import { asRecord, detectTransport, extractCommand, checkSensitiveEnv } from '../mcp/adapters/shared.js';
import type { MCPServer } from '../types/index.js';
import { isMissingPathError } from './errors.js';

export async function scanJsonMcpServers(
  agentName: string,
  mcpConfigFile: string | undefined,
  warningLabel: string
): Promise<MCPServer[]> {
  if (!mcpConfigFile) {
    return [];
  }

  try {
    const content = await readFile(mcpConfigFile, 'utf-8');
    const config = parseJsonConfig<Record<string, unknown>>(content);
    const mcpServers = asRecord(config.mcpServers);

    return Object.entries(mcpServers).map(([name, serverConfig]) => {
      const cfg = asRecord(serverConfig);
      return {
        id: name,
        agentSources: [agentName],
        transport: detectTransport(cfg),
        command: extractCommand(cfg),
        host: typeof cfg.url === 'string' ? cfg.url : undefined,
        isDuplicate: false,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: checkSensitiveEnv(cfg),
      } satisfies MCPServer;
    });
  } catch (err) {
    if (!isMissingPathError(err)) {
      console.warn(`Warning: Could not read ${warningLabel} MCP config: ${mcpConfigFile}`, (err as Error).message);
    }
    return [];
  }
}


