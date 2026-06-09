import type { AgentConfig } from '../types/index.js';

export type AgentSupportConfidence = 'high' | 'medium' | 'low';
export type McpGovernanceSupport = 'native' | 'observe-only';
export type McpApplySupport = 'write-ready' | 'observe-only';
export type McpRestoreSupport = 'write-ready' | 'unproven';

export interface AgentSupportMetadata {
  currentLevel: string;
  sourceOfTruthConfidence: AgentSupportConfidence;
  mcpReadSupport: McpGovernanceSupport;
  mcpPlanSupport: McpGovernanceSupport;
  mcpApplySupport: McpApplySupport;
  mcpRestoreSupport: McpRestoreSupport;
  mcpConfigOwnershipConfidence: AgentSupportConfidence;
}

const AGENT_SUPPORT_MAP = new Map<string, Readonly<AgentSupportMetadata>>([
  ['claude-code', Object.freeze({ currentLevel: 'dedicated read-only plus write-ready workflow support', sourceOfTruthConfidence: 'high', mcpReadSupport: 'native', mcpPlanSupport: 'native', mcpApplySupport: 'write-ready', mcpRestoreSupport: 'write-ready', mcpConfigOwnershipConfidence: 'high' })],
  ['opencode', Object.freeze({ currentLevel: 'dedicated read-only plus write-ready workflow support', sourceOfTruthConfidence: 'high', mcpReadSupport: 'native', mcpPlanSupport: 'native', mcpApplySupport: 'write-ready', mcpRestoreSupport: 'write-ready', mcpConfigOwnershipConfidence: 'high' })],
  ['codex', Object.freeze({ currentLevel: 'dedicated read-only plus write-ready workflow support', sourceOfTruthConfidence: 'high', mcpReadSupport: 'native', mcpPlanSupport: 'native', mcpApplySupport: 'write-ready', mcpRestoreSupport: 'write-ready', mcpConfigOwnershipConfidence: 'high' })],
  ['codebuddy', Object.freeze({ currentLevel: 'dedicated read-only', sourceOfTruthConfidence: 'medium', mcpReadSupport: 'native', mcpPlanSupport: 'observe-only', mcpApplySupport: 'observe-only', mcpRestoreSupport: 'unproven', mcpConfigOwnershipConfidence: 'medium' })],
  ['workbuddy', Object.freeze({ currentLevel: 'dedicated read-only', sourceOfTruthConfidence: 'medium', mcpReadSupport: 'native', mcpPlanSupport: 'observe-only', mcpApplySupport: 'observe-only', mcpRestoreSupport: 'unproven', mcpConfigOwnershipConfidence: 'medium' })],
  ['trae', Object.freeze({ currentLevel: 'dedicated read-only', sourceOfTruthConfidence: 'low', mcpReadSupport: 'native', mcpPlanSupport: 'observe-only', mcpApplySupport: 'observe-only', mcpRestoreSupport: 'unproven', mcpConfigOwnershipConfidence: 'low' })],
  ['qoder', Object.freeze({ currentLevel: 'generic read-only placeholder', sourceOfTruthConfidence: 'low', mcpReadSupport: 'native', mcpPlanSupport: 'observe-only', mcpApplySupport: 'observe-only', mcpRestoreSupport: 'unproven', mcpConfigOwnershipConfidence: 'low' })],
  ['qoder-work', Object.freeze({ currentLevel: 'generic read-only placeholder', sourceOfTruthConfidence: 'low', mcpReadSupport: 'native', mcpPlanSupport: 'observe-only', mcpApplySupport: 'observe-only', mcpRestoreSupport: 'unproven', mcpConfigOwnershipConfidence: 'low' })],
]);

const DEFAULT_SUPPORT = Object.freeze<AgentSupportMetadata>({
  currentLevel: 'undocumented/unknown',
  sourceOfTruthConfidence: 'low',
  mcpReadSupport: 'observe-only',
  mcpPlanSupport: 'observe-only',
  mcpApplySupport: 'observe-only',
  mcpRestoreSupport: 'unproven',
  mcpConfigOwnershipConfidence: 'low',
});

export function getAgentSupportMap(): ReadonlyMap<string, AgentSupportMetadata> {
  return new Map(Array.from(AGENT_SUPPORT_MAP.entries(), ([agentId, metadata]) => [agentId, { ...metadata }]));
}

export function describeAgentSupport(agentId: string): AgentSupportMetadata {
  const metadata = AGENT_SUPPORT_MAP.get(agentId) ?? DEFAULT_SUPPORT;
  return { ...metadata };
}

export function resolveAgentSupport(agent: Pick<AgentConfig, 'id' | 'scannerType' | 'name'>): AgentSupportMetadata {
  const supportKey =
    (agent.scannerType && AGENT_SUPPORT_MAP.has(agent.scannerType) ? agent.scannerType : undefined)
    ?? (agent.id && AGENT_SUPPORT_MAP.has(agent.id) ? agent.id : undefined)
    ?? agent.name;

  return describeAgentSupport(supportKey);
}
