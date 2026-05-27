import type { Inventory, Skill, MCPServer } from '../types/index.js';

export function normalizeInventory(inventory: Inventory): Inventory {
  return {
    ...inventory,
    skills: inventory.skills.map(normalizeSkill),
    mcpServers: inventory.mcpServers.map(normalizeMCP),
  };
}

function normalizeSkill(skill: Skill): Skill {
  return {
    ...skill,
    displayName: skill.displayName || skill.id,
    isCanonical: skill.agentInstallPaths.length === 1 && !skill.isSymlink,
  };
}

function normalizeMCP(mcp: MCPServer): MCPServer {
  return {
    ...mcp,
    isDuplicate: mcp.agentSources.length > 1,
  };
}
