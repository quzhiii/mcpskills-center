export type AgentSupportConfidence = 'high' | 'medium' | 'low';

export interface AgentSupportMetadata {
  currentLevel: string;
  sourceOfTruthConfidence: AgentSupportConfidence;
}

const AGENT_SUPPORT_MAP = new Map<string, Readonly<AgentSupportMetadata>>([
  ['claude-code', Object.freeze({ currentLevel: 'dedicated read-only plus write-ready workflow support', sourceOfTruthConfidence: 'high' })],
  ['opencode', Object.freeze({ currentLevel: 'dedicated read-only plus write-ready workflow support', sourceOfTruthConfidence: 'high' })],
  ['codex', Object.freeze({ currentLevel: 'dedicated read-only plus write-ready workflow support', sourceOfTruthConfidence: 'high' })],
  ['codebuddy', Object.freeze({ currentLevel: 'dedicated read-only', sourceOfTruthConfidence: 'medium' })],
  ['workbuddy', Object.freeze({ currentLevel: 'dedicated read-only', sourceOfTruthConfidence: 'medium' })],
  ['trae', Object.freeze({ currentLevel: 'dedicated read-only', sourceOfTruthConfidence: 'low' })],
  ['qoder', Object.freeze({ currentLevel: 'generic read-only placeholder', sourceOfTruthConfidence: 'low' })],
  ['qoder-work', Object.freeze({ currentLevel: 'generic read-only placeholder', sourceOfTruthConfidence: 'low' })],
]);

const DEFAULT_SUPPORT = Object.freeze<AgentSupportMetadata>({
  currentLevel: 'undocumented/unknown',
  sourceOfTruthConfidence: 'low',
});

export function getAgentSupportMap(): ReadonlyMap<string, AgentSupportMetadata> {
  return new Map(Array.from(AGENT_SUPPORT_MAP.entries(), ([agentId, metadata]) => [agentId, { ...metadata }]));
}

export function describeAgentSupport(agentId: string): AgentSupportMetadata {
  const metadata = AGENT_SUPPORT_MAP.get(agentId) ?? DEFAULT_SUPPORT;
  return { ...metadata };
}
