import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMcpApplyPlan } from './apply-plan.js';
import type { McpGovernancePlan } from '../types/index.js';

test('buildMcpApplyPlan converts eligible canonical-candidate actions to write actions', () => {
  const governancePlan: McpGovernancePlan = {
    generatedAt: '2026-06-10T00:00:00Z',
    actions: [
      {
        id: 'gov-1',
        type: 'canonical-candidate',
        mcpId: 'filesystem',
        agentNames: ['claude-code', 'opencode'],
        canonicalAgentName: 'claude-code',
        envRiskPolicy: 'no-env-risk-detected',
        scopePolicy: 'no-scope-conflict-detected',
        definitions: [
          { agentName: 'claude-code', transport: 'stdio', command: 'npx', isEnabled: true, canStart: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
          { agentName: 'opencode', transport: 'stdio', command: 'npx', isEnabled: true, canStart: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
        ],
        reason: 'eligible canonical candidate',
        requiresWrite: false,
      },
    ],
  };

  const applyPlan = buildMcpApplyPlan(governancePlan, ['C:/Users/quzhi/.claude.json', 'C:/Users/quzhi/.opencode/opencode.json']);
  assert.equal(applyPlan.actions.length, 1);
  assert.equal(applyPlan.actions[0].type, 'add-server');
  assert.equal(applyPlan.actions[0].targetAgentName, 'claude-code');
  assert.equal(applyPlan.actions[0].requiresWrite, true);
  assert.equal(applyPlan.actions[0].mcpId, 'filesystem');
});

test('buildMcpApplyPlan skips manual-review and skip actions', () => {
  const governancePlan: McpGovernancePlan = {
    generatedAt: '2026-06-10T00:00:00Z',
    actions: [
      {
        id: 'gov-skip',
        type: 'skip',
        mcpId: 'solo-server',
        agentNames: ['claude-code'],
        envRiskPolicy: 'no-env-risk-detected',
        reason: 'single agent',
        requiresWrite: false,
      },
      {
        id: 'gov-review',
        type: 'manual-review',
        mcpId: 'conflict-server',
        agentNames: ['claude-code', 'opencode'],
        envRiskPolicy: 'sensitive-env-blocks-canonicalization',
        reason: 'sensitive env',
        requiresWrite: false,
      },
    ],
  };

  const applyPlan = buildMcpApplyPlan(governancePlan, []);
  assert.equal(applyPlan.actions.length, 0);
});

test('buildMcpApplyPlan throws when canonical agent is not write-ready', () => {
  const governancePlan: McpGovernancePlan = {
    generatedAt: '2026-06-10T00:00:00Z',
    actions: [
      {
        id: 'gov-1',
        type: 'canonical-candidate',
        mcpId: 'filesystem',
        agentNames: ['trae', 'claude-code'],
        canonicalAgentName: 'trae',
        envRiskPolicy: 'no-env-risk-detected',
        definitions: [
          { agentName: 'trae', transport: 'stdio', command: 'npx', isEnabled: true, canStart: true, hasSensitiveEnv: false },
          { agentName: 'claude-code', transport: 'stdio', command: 'npx', isEnabled: true, canStart: true, hasSensitiveEnv: false },
        ],
        reason: 'eligible canonical candidate',
        requiresWrite: false,
      },
    ],
  };

  assert.throws(
    () => buildMcpApplyPlan(governancePlan, []),
    /not eligible for MCP writes/
  );
});

test('buildMcpApplyPlan preserves approvedRoots in plan', () => {
  const governancePlan: McpGovernancePlan = {
    generatedAt: '2026-06-10T00:00:00Z',
    actions: [],
  };

  const roots = ['C:/Users/quzhi/.claude.json', 'C:/Users/quzhi/.opencode/opencode.json'];
  const applyPlan = buildMcpApplyPlan(governancePlan, roots);
  assert.deepEqual(applyPlan.approvedRoots, roots);
});
