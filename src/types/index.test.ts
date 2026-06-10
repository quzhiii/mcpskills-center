import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  McpApplyAction,
  McpApplyActionType,
  McpApplyPlan,
  McpApplyReceipt,
  McpApplyResult,
  McpBackupEntry,
  McpBackupManifest,
} from './index.js';

test('McpApplyAction requiresWrite is literally true, not just boolean', () => {
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

  function checkLiteralTrue(v: true) {
    return v;
  }
  assert.equal(checkLiteralTrue(action.requiresWrite), true);
  assert.equal(action.type, 'add-server');
  assert.equal(action.targetAgentName, 'claude-code');
});

test('McpApplyAction remove-server has no canonicalDefinition', () => {
  const action: McpApplyAction = {
    id: 'apply-remove',
    type: 'remove-server',
    mcpId: 'old-server',
    targetAgentName: 'claude-code',
    reason: 'remove unused MCP server',
    requiresWrite: true,
  };
  assert.equal(action.type, 'remove-server');
  assert.equal(action.canonicalDefinition, undefined);
});

test('McpApplyActionType covers all five action variants', () => {
  const types: McpApplyActionType[] = [
    'add-server',
    'update-server',
    'remove-server',
    'enable-server',
    'disable-server',
  ];
  assert.equal(types.length, 5);
  for (const t of types) {
    const action: McpApplyAction = {
      id: `action-${t}`,
      type: t,
      mcpId: 'test-mcp',
      targetAgentName: 'agent',
      reason: `test ${t}`,
      requiresWrite: true,
    };
    assert.equal(action.type, t);
  }
});

test('McpApplyPlan holds multiple actions of different types', () => {
  const plan: McpApplyPlan = {
    generatedAt: '2026-06-10T00:00:00Z',
    confirm: true,
    actions: [
      {
        id: 'a1',
        type: 'add-server',
        mcpId: 'filesystem',
        targetAgentName: 'claude-code',
        canonicalDefinition: { transport: 'stdio', command: 'npx', isEnabled: true, canStart: true, hasSensitiveEnv: false },
        reason: 'add server',
        requiresWrite: true,
      },
      {
        id: 'a2',
        type: 'remove-server',
        mcpId: 'old-server',
        targetAgentName: 'claude-code',
        reason: 'remove server',
        requiresWrite: true,
      },
    ],
    approvedRoots: ['C:/Users/quzhi/.claude.json'],
  };
  assert.equal(plan.actions.length, 2);
  assert.equal(plan.actions[0].type, 'add-server');
  assert.equal(plan.actions[1].type, 'remove-server');
  assert.equal(plan.approvedRoots.length, 1);
});

test('McpApplyReceipt captures action result metadata', () => {
  const receipt: McpApplyReceipt = {
    actionId: 'apply-1',
    type: 'add-server',
    mcpId: 'filesystem',
    targetAgentName: 'claude-code',
    targetConfigPath: 'C:/Users/quzhi/.claude.json',
    backupPath: '/backups/claude-code-2026-06-10.json',
    appliedAt: '2026-06-10T00:01:00Z',
  };
  assert.equal(receipt.actionId, 'apply-1');
  assert.equal(receipt.type, 'add-server');
  assert.ok(receipt.backupPath);
});

test('McpApplyReceipt allows optional backupPath', () => {
  const receipt: McpApplyReceipt = {
    actionId: 'apply-2',
    type: 'enable-server',
    mcpId: 'filesystem',
    targetAgentName: 'claude-code',
    targetConfigPath: 'C:/Users/quzhi/.claude.json',
    appliedAt: '2026-06-10T00:01:00Z',
  };
  assert.equal(receipt.backupPath, undefined);
});

test('McpBackupEntry records a single config backup', () => {
  const entry: McpBackupEntry = {
    mcpId: 'filesystem',
    targetAgentName: 'claude-code',
    targetConfigPath: 'C:/Users/quzhi/.claude.json',
    backupPath: '/backups/claude-code-2026-06-10.json',
    backedUpAt: '2026-06-10T00:00:30Z',
  };
  assert.equal(entry.mcpId, 'filesystem');
  assert.equal(entry.targetAgentName, 'claude-code');
  assert.ok(entry.backupPath.endsWith('.json'));
});

test('McpBackupManifest aggregates entries with source plan timestamp', () => {
  const manifest: McpBackupManifest = {
    generatedAt: '2026-06-10T00:00:30Z',
    entries: [
      {
        mcpId: 'filesystem',
        targetAgentName: 'claude-code',
        targetConfigPath: 'C:/Users/quzhi/.claude.json',
        backupPath: '/backups/claude-code.json',
        backedUpAt: '2026-06-10T00:00:30Z',
      },
    ],
    sourcePlanGeneratedAt: '2026-06-10T00:00:00Z',
  };
  assert.equal(manifest.entries.length, 1);
  assert.equal(manifest.sourcePlanGeneratedAt, '2026-06-10T00:00:00Z');
});

test('McpApplyResult aggregates applied actions, backups, and receipts', () => {
  const result: McpApplyResult = {
    manifestPath: '/manifests/apply-2026-06-10.json',
    appliedActions: [
      {
        id: 'a1',
        type: 'add-server',
        mcpId: 'filesystem',
        targetAgentName: 'claude-code',
        reason: 'add',
        requiresWrite: true,
      },
    ],
    backupEntries: [
      {
        mcpId: 'filesystem',
        targetAgentName: 'claude-code',
        targetConfigPath: 'C:/Users/quzhi/.claude.json',
        backupPath: '/backups/claude-code.json',
        backedUpAt: '2026-06-10T00:00:30Z',
      },
    ],
    receipts: [
      {
        actionId: 'a1',
        type: 'add-server',
        mcpId: 'filesystem',
        targetAgentName: 'claude-code',
        targetConfigPath: 'C:/Users/quzhi/.claude.json',
        appliedAt: '2026-06-10T00:01:00Z',
      },
    ],
  };
  assert.equal(result.appliedActions.length, 1);
  assert.equal(result.backupEntries.length, 1);
  assert.equal(result.receipts.length, 1);
  assert.ok(result.manifestPath.endsWith('.json'));
});
