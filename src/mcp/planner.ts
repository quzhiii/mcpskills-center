import { describeAgentSupport } from '../agents/support.js';
import type { AgentSupportConfidence, McpApplySupport, McpRestoreSupport } from '../agents/support.js';
import type {
  Inventory,
  MCPServer,
  MCPServerDefinition,
  McpCanonicalTargetPolicy,
  McpGovernanceAction,
  McpGovernancePlan,
} from '../types/index.js';

export function planMcpGovernance(inventory: Inventory): McpGovernancePlan {
  const actions: McpGovernanceAction[] = [];

  for (const mcp of inventory.mcpServers) {
    const definitions = getDefinitions(mcp);
    const agentNames = [...new Set(definitions.map(definition => definition.agentName))];

    if (agentNames.length <= 1) {
      actions.push(createAction({
        index: actions.length,
        type: 'skip',
        mcp,
        definitions,
        agentNames,
        canonicalProfileBlockers: ['single-agent'],
        envRiskPolicy: classifyEnvRiskPolicy(definitions),
        scopePolicy: classifyScopePolicy(definitions),
        reason: 'MCP server is configured in only one agent; no governance action is needed',
      }));
      continue;
    }

    if (hasUnknownTransport(definitions)) {
      actions.push(createAction({
        index: actions.length,
        type: 'manual-review',
        mcp,
        definitions,
        agentNames,
        canonicalProfileBlockers: ['unknown-transport'],
        envRiskPolicy: 'unknown-transport-requires-review',
        scopePolicy: classifyScopePolicy(definitions),
        reason: 'MCP server has unknown transport and must be reviewed before canonicalization',
      }));
      continue;
    }

    if (hasSensitiveEnvDriftRisk(definitions)) {
      actions.push(createAction({
        index: actions.length,
        type: 'manual-review',
        mcp,
        definitions,
        agentNames,
        canonicalProfileBlockers: ['sensitive-env'],
        envRiskPolicy: 'sensitive-env-blocks-canonicalization',
        scopePolicy: classifyScopePolicy(definitions),
        reason: 'MCP server has sensitive env risk and must be reviewed before canonicalization',
      }));
      continue;
    }

    if (hasScopeConflict(definitions)) {
      actions.push(createAction({
        index: actions.length,
        type: 'manual-review',
        mcp,
        definitions,
        agentNames,
        canonicalProfileBlockers: ['scope-conflict'],
        envRiskPolicy: classifyEnvRiskPolicy(definitions),
        scopePolicy: 'scope-conflict-requires-review',
        reason: `MCP duplicate definitions have a scope conflict (${describeScopes(definitions)}) and require manual review`,
      }));
      continue;
    }

    if (!areDefinitionsEquivalent(definitions)) {
      actions.push(createAction({
        index: actions.length,
        type: 'manual-review',
        mcp,
        definitions,
        agentNames,
        canonicalProfileBlockers: ['definition-drift'],
        envRiskPolicy: classifyEnvRiskPolicy(definitions),
        scopePolicy: classifyScopePolicy(definitions),
        reason: 'MCP duplicate definitions drift across agents and require manual review',
      }));
      continue;
    }

    const canonicalTarget = selectCanonicalTarget(definitions);

    actions.push(createAction({
      index: actions.length,
      type: 'canonical-candidate',
      mcp,
      definitions,
      agentNames,
      canonicalAgentName: canonicalTarget.definition.agentName,
      canonicalTargetPolicy: canonicalTarget.policy,
      canonicalTargetReason: canonicalTarget.reason,
      canonicalProfileCandidate: createCanonicalProfileCandidate(mcp, canonicalTarget.definition, agentNames, canonicalTarget),
      canonicalProfileBlockers: [],
      envRiskPolicy: 'no-env-risk-detected',
      scopePolicy: 'no-scope-conflict-detected',
      reason: 'MCP server has equivalent duplicate definitions and is a canonical profile candidate',
    }));
  }

  return {
    generatedAt: new Date().toISOString(),
    actions,
  };
}

function createAction(args: {
  index: number;
  type: McpGovernanceAction['type'];
  mcp: MCPServer;
  definitions: MCPServerDefinition[];
  agentNames: string[];
  canonicalAgentName?: string;
  canonicalTargetPolicy?: McpGovernanceAction['canonicalTargetPolicy'];
  canonicalTargetReason?: McpGovernanceAction['canonicalTargetReason'];
  canonicalProfileCandidate?: McpGovernanceAction['canonicalProfileCandidate'];
  canonicalProfileBlockers?: McpGovernanceAction['canonicalProfileBlockers'];
  envRiskPolicy: McpGovernanceAction['envRiskPolicy'];
  scopePolicy: McpGovernanceAction['scopePolicy'];
  reason: string;
}): McpGovernanceAction {
  return {
    id: `${args.type}:${args.mcp.id}:${args.index}`,
    type: args.type,
    mcpId: args.mcp.id,
    agentNames: args.agentNames,
    canonicalAgentName: args.canonicalAgentName,
    canonicalTargetPolicy: args.canonicalTargetPolicy,
    canonicalTargetReason: args.canonicalTargetReason,
    canonicalProfileCandidate: args.canonicalProfileCandidate,
    canonicalProfileBlockers: args.canonicalProfileBlockers,
    envRiskPolicy: args.envRiskPolicy,
    scopePolicy: args.scopePolicy,
    definitions: args.definitions,
    reason: args.reason,
    requiresWrite: false,
  };
}

function getDefinitions(mcp: MCPServer): MCPServerDefinition[] {
  if (mcp.definitions) return mcp.definitions;

  return mcp.agentSources.map(agentName => ({
    agentName,
    transport: mcp.transport,
    command: mcp.command,
    host: mcp.host,
    isEnabled: mcp.isEnabled,
    canStart: mcp.canStart,
    hasSensitiveEnv: mcp.hasSensitiveEnv,
  }));
}

function areDefinitionsEquivalent(definitions: MCPServerDefinition[]): boolean {
  const [first, ...rest] = definitions.map(normalizeDefinition);
  if (!first) return true;
  return rest.every(definition => definition === first);
}

function normalizeDefinition(definition: MCPServerDefinition): string {
  return JSON.stringify({
    transport: definition.transport,
    command: definition.command,
    host: definition.host,
    isEnabled: definition.isEnabled,
    canStart: definition.canStart,
    hasSensitiveEnv: definition.hasSensitiveEnv,
  });
}

function hasSensitiveEnvDriftRisk(definitions: MCPServerDefinition[]): boolean {
  return definitions.some(definition => definition.hasSensitiveEnv);
}

function hasUnknownTransport(definitions: MCPServerDefinition[]): boolean {
  return definitions.some(definition => definition.transport === 'unknown');
}

function classifyEnvRiskPolicy(definitions: MCPServerDefinition[]): McpGovernanceAction['envRiskPolicy'] {
  if (hasUnknownTransport(definitions)) return 'unknown-transport-requires-review';
  if (hasSensitiveEnvDriftRisk(definitions)) return 'sensitive-env-blocks-canonicalization';
  return 'no-env-risk-detected';
}

function classifyScopePolicy(definitions: MCPServerDefinition[]): McpGovernanceAction['scopePolicy'] {
  return hasScopeConflict(definitions) ? 'scope-conflict-requires-review' : 'no-scope-conflict-detected';
}

function hasScopeConflict(definitions: MCPServerDefinition[]): boolean {
  return new Set(definitions.map(definition => normalizeScope(definition))).size > 1;
}

function normalizeScope(definition: MCPServerDefinition): string {
  const scope = definition.scope;
  if (!scope) return 'unknown';
  return scope.id ? `${scope.kind}:${scope.id}` : scope.kind;
}

function describeScopes(definitions: MCPServerDefinition[]): string {
  return [...new Set(definitions.map(definition => normalizeScope(definition)))].join(', ');
}

function createCanonicalProfileCandidate(
  mcp: MCPServer,
  sourceDefinition: MCPServerDefinition,
  agentNames: string[],
  canonicalTarget: { policy: McpCanonicalTargetPolicy; reason: string }
): NonNullable<McpGovernanceAction['canonicalProfileCandidate']> {
  return {
    status: 'eligible',
    profileId: mcp.id,
    mcpId: mcp.id,
    sourceAgentName: sourceDefinition.agentName,
    agentNames,
    definition: {
      transport: sourceDefinition.transport,
      command: sourceDefinition.command,
      host: sourceDefinition.host,
      isEnabled: sourceDefinition.isEnabled,
      canStart: sourceDefinition.canStart,
      hasSensitiveEnv: sourceDefinition.hasSensitiveEnv,
      scope: sourceDefinition.scope,
    },
    scope: sourceDefinition.scope,
    canonicalTargetPolicy: canonicalTarget.policy,
    canonicalTargetReason: canonicalTarget.reason,
    envRiskPolicy: 'no-env-risk-detected',
    scopePolicy: 'no-scope-conflict-detected',
    blockers: [],
    blockedByEnvRisk: false,
    eligibilityReason: 'MCP server has equivalent duplicate definitions and can be represented as a canonical profile candidate',
  };
}

function selectCanonicalTarget(definitions: MCPServerDefinition[]): {
  definition: MCPServerDefinition;
  policy: McpCanonicalTargetPolicy;
  reason: string;
} {
  const ranked = [...definitions].sort(compareCanonicalTargetDefinitions);
  const best = ranked[0];
  const next = ranked[1];

  if (!best) {
    throw new Error('canonical target selection requires at least one definition');
  }

  const bestSupport = describeAgentSupport(best.agentName);
  const nextSupport = next ? describeAgentSupport(next.agentName) : undefined;
  const tiedOnSupport = next
    ? bestSupport.mcpApplySupport === nextSupport?.mcpApplySupport
      && bestSupport.mcpRestoreSupport === nextSupport?.mcpRestoreSupport
      && bestSupport.mcpConfigOwnershipConfidence === nextSupport?.mcpConfigOwnershipConfidence
      && bestSupport.sourceOfTruthConfidence === nextSupport?.sourceOfTruthConfidence
    : false;

  return {
    definition: best,
    policy: tiedOnSupport ? 'alphabetical-write-ready-tiebreak' : 'highest-ownership-write-ready',
    reason: tiedOnSupport
      ? `Canonical target selected by alphabetical tie-break among equally write-ready agents (${best.agentName})`
      : `Canonical target selected from highest-confidence write-ready agent (${best.agentName})`,
  };
}

function compareCanonicalTargetDefinitions(left: MCPServerDefinition, right: MCPServerDefinition): number {
  const leftSupport = describeAgentSupport(left.agentName);
  const rightSupport = describeAgentSupport(right.agentName);

  return (
    compareSupportFlag(leftSupport.mcpApplySupport, rightSupport.mcpApplySupport, { 'write-ready': 1, 'observe-only': 0 })
    || compareSupportFlag(leftSupport.mcpRestoreSupport, rightSupport.mcpRestoreSupport, { 'write-ready': 1, unproven: 0 })
    || compareSupportFlag(leftSupport.mcpConfigOwnershipConfidence, rightSupport.mcpConfigOwnershipConfidence, { high: 2, medium: 1, low: 0 })
    || compareSupportFlag(leftSupport.sourceOfTruthConfidence, rightSupport.sourceOfTruthConfidence, { high: 2, medium: 1, low: 0 })
    || left.agentName.localeCompare(right.agentName)
  );
}

function compareSupportFlag<T extends string>(
  left: T,
  right: T,
  weights: Record<T, number>
): number {
  return weights[right] - weights[left];
}
