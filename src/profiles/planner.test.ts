import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planProfile } from './planner.js';
import type { Inventory, Profile } from '../types/index.js';

function makeInventory(): Inventory {
  return {
    generatedAt: '2026-06-03T00:00:00.000Z',
    agents: [],
    skills: [
      {
        id: 'existing-skill',
        displayName: 'existing-skill',
        sourcePath: 'C:/skills/existing-skill',
        agentInstallPaths: ['C:/Users/quzhi/.claude/skills/existing-skill'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: false,
      },
    ],
    mcpServers: [
      {
        id: 'existing-mcp',
        agentSources: ['claude-code'],
        transport: 'stdio',
        command: 'npx',
        isDuplicate: false,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
      {
        id: 'disabled-mcp',
        agentSources: ['claude-code'],
        transport: 'stdio',
        command: 'npx',
        isDuplicate: false,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
    ],
    profiles: [],
  };
}

test('planProfile reports already-present, missing, and disabled items', () => {
  const profile: Profile = {
    name: 'coding',
    description: 'Coding profile',
    agents: ['claude-code'],
    mcpServers: ['existing-mcp', 'missing-mcp'],
    disabledMcpServers: ['disabled-mcp'],
    skills: ['existing-skill', 'missing-skill'],
  };

  const plan = planProfile(profile, makeInventory());

  assert.equal(plan.profileName, 'coding');
  assert.equal(plan.actions.some(action => action.type === 'already-present' && action.targetType === 'mcp-server' && action.targetId === 'existing-mcp'), true);
  assert.equal(plan.actions.some(action => action.type === 'missing' && action.targetType === 'mcp-server' && action.targetId === 'missing-mcp'), true);
  assert.equal(plan.actions.some(action => action.type === 'disable' && action.targetType === 'mcp-server' && action.targetId === 'disabled-mcp'), true);
  assert.equal(plan.actions.some(action => action.type === 'already-present' && action.targetType === 'skill' && action.targetId === 'existing-skill'), true);
  assert.equal(plan.actions.some(action => action.type === 'missing' && action.targetType === 'skill' && action.targetId === 'missing-skill'), true);
});

test('planProfile matches short MCP ids against project-scoped inventory ids', () => {
  const profile: Profile = {
    name: 'coding',
    description: 'Coding profile',
    agents: ['claude-code'],
    mcpServers: ['playwright'],
    disabledMcpServers: ['chrome-devtools'],
    skills: [],
  };

  const inventory = makeInventory();
  inventory.mcpServers = [
    {
      id: 'C:/Users/quzhi:playwright',
      agentSources: ['claude-code'],
      transport: 'stdio',
      command: 'npx',
      isDuplicate: false,
      isEnabled: true,
      canStart: null,
      hasSensitiveEnv: false,
    },
    {
      id: 'C:/Users/quzhi:chrome-devtools',
      agentSources: ['claude-code'],
      transport: 'stdio',
      command: 'npx',
      isDuplicate: false,
      isEnabled: true,
      canStart: null,
      hasSensitiveEnv: false,
    },
  ];

  const plan = planProfile(profile, inventory);

  assert.equal(plan.actions.some(action => action.type === 'already-present' && action.targetType === 'mcp-server' && action.targetId === 'playwright'), true);
  assert.equal(plan.actions.some(action => action.type === 'disable' && action.targetType === 'mcp-server' && action.targetId === 'chrome-devtools'), true);
  assert.equal(plan.actions.some(action => action.type === 'missing' && action.targetType === 'mcp-server' && action.targetId === 'playwright'), false);
  assert.equal(plan.actions.some(action => action.type === 'missing' && action.targetType === 'mcp-server' && action.targetId === 'chrome-devtools'), false);
});
