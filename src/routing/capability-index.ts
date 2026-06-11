import type { AgentConfig } from '../types/index.js';

export interface AgentCapability {
  agentName: string;
  sourceOfTruthConfidence: string;
  mcpApplySupport: string;
  skillCount: number;
  mcpServerCount: number;
  mcpServers: string[];
}

export function buildCapabilityIndex(
  agents: AgentConfig[],
  mcpServerCounts: Record<string, number>,
  skillCounts: Record<string, number>,
): AgentCapability[] {
  return agents.map(agent => ({
    agentName: agent.name,
    sourceOfTruthConfidence: agent.support?.sourceOfTruthConfidence ?? 'low',
    mcpApplySupport: agent.support?.mcpApplySupport ?? 'observe-only',
    skillCount: skillCounts[agent.name] ?? 0,
    mcpServerCount: mcpServerCounts[agent.name] ?? 0,
    mcpServers: [],
  }));
}
