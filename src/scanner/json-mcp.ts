import { readFile } from 'node:fs/promises';
import { parseJsonConfig } from '../config/parse.js';
import type { MCPServer } from '../types/index.js';

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
    console.warn(`Warning: Could not read ${warningLabel} MCP config: ${mcpConfigFile}`, (err as Error).message);
    return [];
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function detectTransport(cfg: Record<string, unknown>): 'stdio' | 'http' | 'sse' | 'unknown' {
  if (extractCommand(cfg)) return 'stdio';
  if (typeof cfg.url === 'string') {
    return cfg.url.includes('/sse') ? 'sse' : 'http';
  }
  return 'unknown';
}

function extractCommand(cfg: Record<string, unknown>): string | undefined {
  if (typeof cfg.command === 'string') {
    return cfg.command;
  }

  if (Array.isArray(cfg.command) && typeof cfg.command[0] === 'string') {
    return cfg.command[0];
  }

  return undefined;
}

function checkSensitiveEnv(cfg: Record<string, unknown>): boolean {
  const env = asRecord(cfg.env);
  const sensitiveKeys = ['api_key', 'apikey', 'token', 'secret', 'password', 'auth'];
  return Object.keys(env).some(key => sensitiveKeys.some(s => key.toLowerCase().includes(s)));
}
