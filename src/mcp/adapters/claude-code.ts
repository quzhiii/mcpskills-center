import { parseJsonConfig } from '../../config/parse.js';
import type { McpConfigAdapter, ParsedMcpConfigServer } from './base.js';
import { asRecord, detectTransport, extractCommand, checkSensitiveEnv } from './shared.js';

export const parseClaudeCodeMcpConfig: McpConfigAdapter['parse'] = (content: string) => {
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
        command: extractCommand(cfg),
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
      command: extractCommand(cfg),
      host: typeof cfg.url === 'string' ? cfg.url : undefined,
      isEnabled: true,
      hasSensitiveEnv: checkSensitiveEnv(cfg),
      scope: { kind: 'global' },
    });
  }

  return servers;
};

export const serializeClaudeCodeMcpConfig: McpConfigAdapter['serialize'] = (servers: ParsedMcpConfigServer[], existingContent?: string): string => {
  const existing: Record<string, unknown> = existingContent
    ? JSON.parse(existingContent)
    : {};

  const existingGlobalServers = asRecord(existing.mcpServers);
  const existingProjects = asRecord(existing.projects);

  const globalServers: Record<string, unknown> = {};
  const projectServers: Record<string, Record<string, unknown>> = {};

  for (const server of servers) {
    const serverObj: Record<string, unknown> = {};
    if (server.command !== undefined) serverObj.command = server.command;
    if (server.host !== undefined) serverObj.url = server.host;

    if (server.scope.kind === 'global') {
      const name = server.id.startsWith('global:')
        ? server.id.slice('global:'.length)
        : server.id;
      const existingServer = asRecord(existingGlobalServers[name]);
      if (existingServer.env) serverObj.env = existingServer.env;
      if (existingServer.environment) serverObj.environment = existingServer.environment;
      globalServers[name] = serverObj;
    } else if (server.scope.kind === 'project' && server.scope.id) {
      const projectId = server.scope.id;
      const name = server.id.slice(projectId.length + 1);
      if (!projectServers[projectId]) projectServers[projectId] = {};
      const existingProject = asRecord(existingProjects[projectId]);
      const existingProjectServers = asRecord(existingProject.mcpServers);
      const existingServer = asRecord(existingProjectServers[name]);
      if (existingServer.env) serverObj.env = existingServer.env;
      if (existingServer.environment) serverObj.environment = existingServer.environment;
      projectServers[projectId][name] = serverObj;
    }
  }

  const result: Record<string, unknown> = { ...existing };
  result.mcpServers = globalServers;

  if (Object.keys(projectServers).length > 0) {
    const mergedProjects = { ...existingProjects };
    for (const [pid, serversMap] of Object.entries(projectServers)) {
      const existingProject = asRecord(mergedProjects[pid]);
      mergedProjects[pid] = { ...existingProject, mcpServers: serversMap };
    }
    result.projects = mergedProjects;
  }

  return JSON.stringify(result, null, 2);
};
