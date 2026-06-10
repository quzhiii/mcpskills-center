import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  McpApplyAction,
  McpApplyPlan,
} from './index.js';

test('McpApplyAction requires write and carries target agent info', () => {
  const action: McpApplyAction = {
    id: 'apply-1',
    type: 'add-server',
    mcpId: 'filesystem',
    targetAgentName: 'claude-code',
    canonicalDefinition: {
      transport: 'stdio',
      command: 'npx',
      isEnabled: true,
      canStart: true,
      hasSensitiveEnv: false,
      scope: { kind: 'global' },
    },
    reason: 'add canonical MCP server to target agent config',
    requiresWrite: true,
  };
  assert.equal(action.requiresWrite, true);
  assert.equal(action.type, 'add-server');
  assert.equal(action.targetAgentName, 'claude-code');
});

test('McpApplyPlan contains write actions and confirm flag shape', () => {
  const plan: McpApplyPlan = {
    generatedAt: '2026-06-10T00:00:00Z',
    confirm: true,
    actions: [],
    approvedRoots: ['C:/Users/quzhi/.claude.json'],
  };
  assert.equal(plan.confirm, true);
  assert.ok(Array.isArray(plan.actions));
  assert.ok(Array.isArray(plan.approvedRoots));
});
