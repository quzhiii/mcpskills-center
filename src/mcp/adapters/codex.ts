import { parseTomlConfig } from '../../config/parse.js';
import { stringify } from 'smol-toml';
import type { McpConfigAdapter, ParsedMcpConfigServer } from './base.js';
import { asRecord, detectTransport, extractCommand, checkSensitiveEnv } from './shared.js';

export const parseCodexMcpConfig: McpConfigAdapter['parse'] = (content: string) => {
  const config = parseTomlConfig<Record<string, unknown>>(content);
  const mcpServers = asRecord(config.mcp_servers);

  return Object.entries(mcpServers).map(([name, serverConfig]) => {
    const cfg = asRecord(serverConfig);
    return {
      id: name,
      transport: detectTransport(cfg),
      command: extractCommand(cfg),
      host: typeof cfg.url === 'string' ? cfg.url : undefined,
      isEnabled: true,
      hasSensitiveEnv: checkSensitiveEnv(cfg),
      scope: { kind: 'global' },
    } satisfies ParsedMcpConfigServer;
  });
};

export const serializeCodexMcpConfig: McpConfigAdapter['serialize'] = (servers: ParsedMcpConfigServer[], _existingContent?: string): string => {
  const mcpServers: Record<string, Record<string, unknown>> = {};

  for (const server of servers) {
    const entry: Record<string, unknown> = {};
    if (server.command) {
      entry.command = server.command;
    }
    if (server.host) {
      entry.url = server.host;
    }
    mcpServers[server.id] = entry;
  }

  return stringify({ mcp_servers: mcpServers });
};
