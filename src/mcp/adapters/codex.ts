import { parseTomlConfig } from '../../config/parse.js';
import type { ParsedMcpConfigServer } from './base.js';

export function parseCodexMcpConfig(content: string): ParsedMcpConfigServer[] {
  const config = parseTomlConfig<Record<string, unknown>>(content);
  const mcpServers = asRecord(config.mcp_servers);

  return Object.entries(mcpServers).map(([name, serverConfig]) => {
    const cfg = asRecord(serverConfig);
    return {
      id: name,
      transport: detectTransport(cfg),
      command: typeof cfg.command === 'string' ? cfg.command : undefined,
      host: typeof cfg.url === 'string' ? cfg.url : undefined,
      isEnabled: true,
      hasSensitiveEnv: checkSensitiveEnv(cfg),
      scope: { kind: 'global' },
    } satisfies ParsedMcpConfigServer;
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function detectTransport(cfg: Record<string, unknown>): ParsedMcpConfigServer['transport'] {
  if (typeof cfg.command === 'string') return 'stdio';
  if (typeof cfg.url === 'string') {
    return cfg.url.includes('/sse') ? 'sse' : 'http';
  }
  return 'unknown';
}

function checkSensitiveEnv(cfg: Record<string, unknown>): boolean {
  const env = asRecord(cfg.env);
  const sensitiveKeys = ['api_key', 'apikey', 'token', 'secret', 'password', 'auth'];
  return Object.keys(env).some(key => sensitiveKeys.some(s => key.toLowerCase().includes(s)));
}
