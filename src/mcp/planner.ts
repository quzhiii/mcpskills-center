import type { Inventory, MCPServer, MCPServerDefinition, McpGovernanceAction, McpGovernancePlan } from '../types/index.js';

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
        envRiskPolicy: classifyEnvRiskPolicy(definitions),
        scopePolicy: classifyScopePolicy(definitions),
        reason: 'MCP duplicate definitions drift across agents and require manual review',
      }));
      continue;
    }

    actions.push(createAction({
      index: actions.length,
      type: 'canonical-candidate',
      mcp,
      definitions,
      agentNames,
      canonicalAgentName: agentNames[0],
      canonicalProfileCandidate: createCanonicalProfileCandidate(mcp, definitions, agentNames),
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
  canonicalProfileCandidate?: McpGovernanceAction['canonicalProfileCandidate'];
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
    canonicalProfileCandidate: args.canonicalProfileCandidate,
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
  definitions: MCPServerDefinition[],
  agentNames: string[]
): NonNullable<McpGovernanceAction['canonicalProfileCandidate']> {
  const sourceDefinition = definitions[0];
  return {
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
    },
    blockedByEnvRisk: false,
  };
}
