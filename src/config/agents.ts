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

export async function loadAgentRegistry(configPath: string, defaultAgents: AgentConfig[]): Promise<AgentRegistry> {
  try {
    const parsed = parseJsonConfig<RawAgentRegistry>(await readFile(configPath, 'utf-8'));
    const projectRoot = dirname(dirname(configPath));
    return validateAgentRegistry(parsed, projectRoot);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { agents: defaultAgents };
    }

    throw err;
  }
}

function validateAgentRegistry(value: RawAgentRegistry, projectRoot: string): AgentRegistry {
  if (!Array.isArray(value.agents)) {
    throw new Error('Agent registry agents must be an array');
  }

  return {
    agents: value.agents
      .map(agent => validateAgentConfig(agent as RawAgentConfig, projectRoot))
      .filter(agent => agent.enabled !== false),
  };
}

function validateAgentConfig(value: RawAgentConfig, projectRoot: string): AgentConfig {
  if (
    typeof value.id !== 'string' ||
    typeof value.scannerType !== 'string' ||
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
    configDir: resolveConfigPath(value.configDir, projectRoot),
    skillsDir: resolveConfigPath(value.skillsDir, projectRoot),
    mcpConfigFile: typeof value.mcpConfigFile === 'string' ? resolveConfigPath(value.mcpConfigFile, projectRoot) : undefined,
    pluginsDir: typeof value.pluginsDir === 'string' ? resolveConfigPath(value.pluginsDir, projectRoot) : undefined,
  };
}

function resolveConfigPath(value: string, projectRoot: string): string {
  if (value === '~') return homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return resolve(homedir(), value.slice(2));
  }

  return isAbsolute(value) ? value : resolve(projectRoot, value);
}
