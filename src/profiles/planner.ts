import type { Inventory, Profile, ProfilePlan, ProfilePlanAction } from '../types/index.js';

export function planProfile(profile: Profile, inventory: Inventory): ProfilePlan {
  const actions: ProfilePlanAction[] = [];
  const skillIds = new Set(inventory.skills.map(skill => skill.id));
  const mcpIds = createMcpIdLookup(inventory);

  for (const mcpId of profile.mcpServers) {
    const exists = mcpIds.has(mcpId);
    actions.push(createAction({
      index: actions.length,
      type: exists ? 'already-present' : 'missing',
      targetType: 'mcp-server',
      targetId: mcpId,
      reason: exists ? 'MCP server already exists in current inventory' : 'MCP server requested by profile is not in current inventory',
      requiresWrite: !exists,
    }));
  }

  for (const mcpId of profile.disabledMcpServers ?? []) {
    actions.push(createAction({
      index: actions.length,
      type: mcpIds.has(mcpId) ? 'disable' : 'missing',
      targetType: 'mcp-server',
      targetId: mcpId,
      reason: mcpIds.has(mcpId) ? 'MCP server exists and profile requests it disabled' : 'Disabled MCP server target is not in current inventory',
      requiresWrite: mcpIds.has(mcpId),
    }));
  }

  for (const skillId of profile.skills) {
    const exists = skillIds.has(skillId);
    actions.push(createAction({
      index: actions.length,
      type: exists ? 'already-present' : 'missing',
      targetType: 'skill',
      targetId: skillId,
      reason: exists ? 'Skill already exists in current inventory' : 'Skill requested by profile is not in current inventory',
      requiresWrite: !exists,
    }));
  }

  return {
    generatedAt: new Date().toISOString(),
    profileName: profile.name,
    actions,
  };
}

function createAction(args: Omit<ProfilePlanAction, 'id'> & { index: number }): ProfilePlanAction {
  return {
    id: `${args.type}:${args.targetType}:${args.targetId}:${args.index}`,
    type: args.type,
    targetType: args.targetType,
    targetId: args.targetId,
    reason: args.reason,
    requiresWrite: args.requiresWrite,
  };
}

function createMcpIdLookup(inventory: Inventory): Set<string> {
  const lookup = new Set<string>();

  for (const mcp of inventory.mcpServers) {
    lookup.add(mcp.id);
    lookup.add(normalizeMcpProfileId(mcp.id));
  }

  return lookup;
}

function normalizeMcpProfileId(id: string): string {
  const colonIndex = id.lastIndexOf(':');
  if (colonIndex === -1) {
    return id;
  }

  return id.slice(colonIndex + 1);
}
