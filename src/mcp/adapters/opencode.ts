import { parseJsonConfig } from '../../config/parse.js';
import type { McpConfigAdapter, ParsedMcpConfigServer } from './base.js';

export const parseOpenCodeMcpConfig: McpConfigAdapter['parse'] = (content: string) => {
  const config = parseJsonConfig<Record<string, unknown>>(content);
  const mcpServers = asRecord(config.mcp);

  return Object.entries(mcpServers).map(([name, serverConfig]) => {
    const cfg = asRecord(serverConfig);
    return {
      id: name,
      transport: detectTransport(cfg),
      command: extractCommand(cfg),
      host: typeof cfg.url === 'string' ? cfg.url : undefined,
      isEnabled: cfg.enabled !== false,
      hasSensitiveEnv: checkSensitiveEnv(cfg),
      scope: { kind: 'global' },
    } satisfies ParsedMcpConfigServer;
  });
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function detectTransport(cfg: Record<string, unknown>): ParsedMcpConfigServer['transport'] {
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
  const env = {
    ...asRecord(cfg.env),
    ...asRecord(cfg.environment),
  };
  const sensitiveKeys = ['api_key', 'apikey', 'token', 'secret', 'password', 'auth'];
  return Object.keys(env).some(key => sensitiveKeys.some(s => key.toLowerCase().includes(s)));
}

export const serializeOpenCodeMcpConfig: McpConfigAdapter['serialize'] = (servers: ParsedMcpConfigServer[], existingContent?: string): string => {
  const existing: Record<string, unknown> = existingContent
    ? JSON.parse(existingContent)
    : {};

  const mcp: Record<string, unknown> = {};
  for (const server of servers) {
    const entry: Record<string, unknown> = {};
    if (server.command) {
      entry.command = server.command;
    }
    if (server.host) {
      entry.url = server.host;
    }
    entry.enabled = server.isEnabled;
    mcp[server.id] = entry;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (key !== 'mcp') {
      result[key] = value;
    }
  }
  result.mcp = mcp;

  return JSON.stringify(result, null, 2);
};
