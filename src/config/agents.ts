import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parseJsonConfig } from './parse.js';
import type { AgentConfig, AgentRegistry } from '../types/index.js';

interface RawAgentConfig {
  id?: unknown;
  name?: unknown;
  displayName?: unknown;
  vendor?: unknown;
  scannerType?: unknown;
  enabled?: unknown;
  readOnly?: unknown;
  configDir?: unknown;
  skillsDir?: unknown;
  mcpConfigFile?: unknown;
  pluginsDir?: unknown;
}

interface RawAgentRegistry {
  agents?: unknown;
}

export interface AgentConfigPathOptions {
  baseDir?: string;
  homeDir?: string;
}

export async function loadAgentRegistry(
  configPath: string,
  defaultAgents: AgentConfig[],
  options: AgentConfigPathOptions = {},
): Promise<AgentRegistry> {
  try {
    const parsed = parseJsonConfig<RawAgentRegistry>(await readFile(configPath, 'utf-8'));
    const baseDir = options.baseDir ?? dirname(dirname(configPath));
    return validateAgentRegistry(parsed, baseDir, options.homeDir ?? homedir());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { agents: defaultAgents };
    }

    throw err;
  }
}

function validateAgentRegistry(value: RawAgentRegistry, baseDir: string, homeDir: string): AgentRegistry {
  if (!Array.isArray(value.agents)) {
    throw new Error('Agent registry agents must be an array');
  }

  const agents = value.agents.map(agent => validateAgentConfig(agent as RawAgentConfig, baseDir, homeDir));
  const ids = new Set<string>();
  for (const agent of agents) {
    if (ids.has(agent.id ?? agent.name)) {
      throw new Error(`Agent registry contains duplicate agent id: ${agent.id ?? agent.name}`);
    }
    ids.add(agent.id ?? agent.name);
  }

  return { agents: agents.filter(agent => agent.enabled !== false) };
}

function validateAgentConfig(value: RawAgentConfig, baseDir: string, homeDir: string): AgentConfig {
  if (
    typeof value.id !== 'string' ||
    value.id.trim().length === 0 ||
    typeof value.scannerType !== 'string' ||
    value.scannerType.trim().length === 0 ||
    typeof value.configDir !== 'string' ||
    typeof value.skillsDir !== 'string'
  ) {
    throw new Error('Agent registry entry must include id, scannerType, configDir, and skillsDir');
  }

  return {
    name: value.id,
    id: value.id,
    displayName: typeof value.displayName === 'string' ? value.displayName : value.id,
    vendor: typeof value.vendor === 'string' ? value.vendor : undefined,
    scannerType: value.scannerType,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    readOnly: typeof value.readOnly === 'boolean' ? value.readOnly : true,
    configDir: resolveConfigPath(value.configDir, baseDir, homeDir),
    skillsDir: resolveConfigPath(value.skillsDir, baseDir, homeDir),
    mcpConfigFile: typeof value.mcpConfigFile === 'string' ? resolveConfigPath(value.mcpConfigFile, baseDir, homeDir) : undefined,
    pluginsDir: typeof value.pluginsDir === 'string' ? resolveConfigPath(value.pluginsDir, baseDir, homeDir) : undefined,
  };
}

function resolveConfigPath(value: string, baseDir: string, homeDir: string): string {
  if (value === '~') return homeDir;
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return resolve(homeDir, value.slice(2));
  }

  return isAbsolute(value) ? value : resolve(baseDir, value);
}
