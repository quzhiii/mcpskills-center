import type { McpGovernancePlan, McpApplyPlan, McpApplyAction } from '../types/index.js';
import { assertMcpWriteBoundaryAllowed } from './safety.js';

export function buildMcpApplyPlan(
  governancePlan: McpGovernancePlan,
  approvedRoots: string[],
): McpApplyPlan {
  const writeActions: McpApplyAction[] = [];

  for (const action of governancePlan.actions) {
    if (action.type !== 'canonical-candidate') continue;
    if (!action.canonicalAgentName) continue;
    if (!action.definitions) continue;

    assertMcpWriteBoundaryAllowed(action.canonicalAgentName);

    const canonicalDef = action.definitions.find(d => d.agentName === action.canonicalAgentName);
    if (!canonicalDef) continue;

    const { agentName: _agentName, ...definitionWithoutAgent } = canonicalDef;

    writeActions.push({
      id: `apply-${action.id}`,
      type: 'add-server',
      mcpId: action.mcpId,
      targetAgentName: action.canonicalAgentName,
      canonicalDefinition: definitionWithoutAgent,
      reason: `promote canonical MCP from governance action ${action.id}`,
      requiresWrite: true,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    confirm: false,
    actions: writeActions,
    approvedRoots,
  };
}
