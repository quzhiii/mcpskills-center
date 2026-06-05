import type { CapabilityMatrix, CapabilityMatrixRow, Inventory } from '../types/index.js';

interface CapabilityMatrixOptions {
  caseInsensitivePaths?: boolean;
}

export function buildCapabilityMatrix(inventory: Inventory, options: CapabilityMatrixOptions = {}): CapabilityMatrix {
  const caseInsensitivePaths = options.caseInsensitivePaths ?? process.platform === 'win32';
  const agents = inventory.agents.map(agent => agent.name).sort((a, b) => a.localeCompare(b));
  const skills = inventory.skills
    .map(skill => buildMatrixRow(skill.id, 'skill', agents, inferSkillAgents(skill.agentInstallPaths, inventory.agents, caseInsensitivePaths)))
    .sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
  const mcpServers = inventory.mcpServers
    .map(mcp => buildMatrixRow(mcp.id, 'mcp-server', agents, mcp.agentSources))
    .sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));

  return {
    generatedAt: inventory.generatedAt,
    agents,
    skills,
    mcpServers,
    summary: {
      totalSkillCapabilities: skills.length,
      totalMcpCapabilities: mcpServers.length,
      sharedSkills: skills.filter(skill => skill.isShared).length,
      sharedMcps: mcpServers.filter(mcp => mcp.isShared).length,
    },
  };
}

function buildMatrixRow(
  capabilityId: string,
  capabilityType: CapabilityMatrixRow['capabilityType'],
  agents: string[],
  presentAgentsInput: string[]
): CapabilityMatrixRow {
  const knownAgents = new Set(agents);
  const presentAgents = [...new Set(presentAgentsInput.filter(agent => knownAgents.has(agent)))].sort((a, b) => a.localeCompare(b));
  const presentSet = new Set(presentAgents);
  const agentStates = Object.fromEntries(
    agents.map(agent => [agent, presentSet.has(agent) ? 'present' : 'missing'])
  ) as CapabilityMatrixRow['agentStates'];
  const missingAgents = agents.filter(agent => !presentSet.has(agent));

  return {
    capabilityId,
    capabilityType,
    presentAgents,
    missingAgents,
    agentStates,
    isShared: presentAgents.length > 1,
  };
}

function inferSkillAgents(paths: string[], agents: Inventory['agents'], caseInsensitivePaths: boolean): string[] {
  return paths
    .map(path => findOwningAgent(path, agents, caseInsensitivePaths))
    .filter((agentName): agentName is string => Boolean(agentName));
}

function findOwningAgent(path: string, agents: Inventory['agents'], caseInsensitivePaths: boolean): string | undefined {
  const normalizedPath = normalizePath(path, caseInsensitivePaths);
  const matchingAgents = agents.filter(agent => isPathInsideRoot(normalizedPath, normalizePath(agent.skillsDir, caseInsensitivePaths)));

  if (matchingAgents.length === 0) return undefined;

  matchingAgents.sort((left, right) => normalizePath(right.skillsDir, caseInsensitivePaths).length - normalizePath(left.skillsDir, caseInsensitivePaths).length);
  return matchingAgents[0].name;
}

function isPathInsideRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

function normalizePath(value: string, caseInsensitivePaths: boolean): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/g, '');
  return caseInsensitivePaths ? normalized.toLowerCase() : normalized;
}
