import { parseJsonConfig } from '../../config/parse.js';
import type { ParsedMcpConfigServer } from './base.js';

export function parseClaudeCodeMcpConfig(content: string): ParsedMcpConfigServer[] {
  const config = parseJsonConfig<Record<string, unknown>>(content);
  const servers: ParsedMcpConfigServer[] = [];

  const projects = asRecord(config.projects);
  for (const [projectId, projectConfig] of Object.entries(projects)) {
    const projectServers = asRecord(asRecord(projectConfig).mcpServers);
    for (const [name, serverConfig] of Object.entries(projectServers)) {
      const cfg = asRecord(serverConfig);
      servers.push({
        id: `${projectId}:${name}`,
        transport: detectTransport(cfg),
        command: typeof cfg.command === 'string' ? cfg.command : undefined,
        host: typeof cfg.url === 'string' ? cfg.url : undefined,
        isEnabled: true,
        hasSensitiveEnv: checkSensitiveEnv(cfg),
        scope: { kind: 'project', id: projectId },
      });
    }
  }

  const globalServers = asRecord(config.mcpServers);
  for (const [name, serverConfig] of Object.entries(globalServers)) {
    const cfg = asRecord(serverConfig);
    servers.push({
      id: `global:${name}`,
      transport: detectTransport(cfg),
      command: typeof cfg.command === 'string' ? cfg.command : undefined,
      host: typeof cfg.url === 'string' ? cfg.url : undefined,
      isEnabled: true,
      hasSensitiveEnv: checkSensitiveEnv(cfg),
      scope: { kind: 'global' },
    });
  }

  return servers;
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
