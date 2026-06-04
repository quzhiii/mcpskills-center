import { homedir } from 'node:os';
import { join } from 'node:path';
import { ClaudeCodeScanner } from './claude-code.js';
import { OpenCodeScanner } from './opencode.js';
import { CodexScanner } from './codex.js';
import type { AgentConfig, Inventory, Skill, MCPServer } from '../types/index.js';

const HOME = homedir();

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    name: 'claude-code',
    configDir: join(HOME, '.claude'),
    skillsDir: join(HOME, '.claude', 'skills'),
    mcpConfigFile: join(HOME, '.claude.json'),
  },
  {
    name: 'opencode',
    configDir: join(HOME, '.opencode'),
    skillsDir: join(HOME, '.opencode', 'skills'),
    mcpConfigFile: join(HOME, '.opencode', 'opencode.json'),
  },
  {
    name: 'codex',
    configDir: join(HOME, '.codex'),
    skillsDir: join(HOME, '.codex', 'skills'),
    mcpConfigFile: join(HOME, '.codex', 'config.toml'),
  },
];

export async function runInventory(agents: AgentConfig[] = DEFAULT_AGENTS): Promise<Inventory> {
  const allSkills: Skill[] = [];
  const allMcps: MCPServer[] = [];

  for (const agent of agents) {
    let scanner;
    switch (agent.name) {
      case 'claude-code':
        scanner = new ClaudeCodeScanner(agent);
        break;
      case 'opencode':
        scanner = new OpenCodeScanner(agent);
        break;
      case 'codex':
        scanner = new CodexScanner(agent);
        break;
      default:
        console.warn(`Unknown agent: ${agent.name}`);
        continue;
    }

    const skills = await scanner.scanSkills();
    const mcps = await scanner.scanMCP();

    allSkills.push(...skills);
    allMcps.push(...mcps);
  }

  // Deduplicate and mark duplicates
  const skillMap = new Map<string, Skill>();
  for (const skill of allSkills) {
    const existing = skillMap.get(skill.id);
    if (existing) {
      existing.agentInstallPaths.push(...skill.agentInstallPaths);
      existing.isDuplicate = true;
    } else {
      skillMap.set(skill.id, { ...skill, isDuplicate: false });
    }
  }

  const mcpMap = new Map<string, MCPServer>();
  for (const mcp of allMcps) {
    const existing = mcpMap.get(mcp.id);
    if (existing) {
      existing.agentSources.push(...mcp.agentSources);
      existing.isDuplicate = true;
    } else {
      mcpMap.set(mcp.id, { ...mcp, isDuplicate: false });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    agents,
    skills: Array.from(skillMap.values()),
    mcpServers: Array.from(mcpMap.values()),
    profiles: [],
  };
}

export { ClaudeCodeScanner, OpenCodeScanner, CodexScanner };
