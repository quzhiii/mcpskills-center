import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planMcpGovernance } from './planner.js';
import type { Inventory, MCPServer, MCPServerDefinition } from '../types/index.js';

function makeDefinition(overrides: Partial<MCPServerDefinition>): MCPServerDefinition {
  return {
    agentName: 'claude-code',
    transport: 'stdio',
    command: 'npx',
    isEnabled: true,
    canStart: null,
    hasSensitiveEnv: false,
    ...overrides,
  };
}

function makeMcp(overrides: Partial<MCPServer>): MCPServer {
  return {
    id: 'filesystem',
    agentSources: ['claude-code'],
    definitions: [makeDefinition({ agentName: 'claude-code' })],
    transport: 'stdio',
    command: 'npx',
    isDuplicate: false,
    isEnabled: true,
    canStart: null,
    hasSensitiveEnv: false,
    ...overrides,
  };
}

function makeInventory(mcpServers: MCPServer[]): Inventory {
  return {
    generatedAt: '2026-06-08T00:00:00.000Z',
    agents: [],
    skills: [],
    mcpServers,
    profiles: [],
  };
}

test('planMcpGovernance marks equivalent duplicate definitions as canonical candidates without writes', () => {
  const inventory = makeInventory([
    makeMcp({
      id: 'filesystem',
      agentSources: ['claude-code', 'opencode'],
      definitions: [
        makeDefinition({ agentName: 'claude-code', command: 'npx' }),
        makeDefinition({ agentName: 'opencode', command: 'npx' }),
      ],
      isDuplicate: true,
    }),
  ]);

  const plan = planMcpGovernance(inventory);

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'canonical-candidate');
  assert.equal(plan.actions[0].mcpId, 'filesystem');
  assert.deepEqual(plan.actions[0].agentNames, ['claude-code', 'opencode']);
  assert.equal(plan.actions[0].canonicalAgentName, 'claude-code');
  assert.equal(plan.actions[0].requiresWrite, false);
  assert.match(plan.actions[0].reason, /equivalent duplicate/i);
});

test('planMcpGovernance skips single-agent definitions with an explicit reason', () => {
  const inventory = makeInventory([
    makeMcp({
      id: 'memory',
      agentSources: ['claude-code'],
      definitions: [makeDefinition({ agentName: 'claude-code' })],
      isDuplicate: false,
    }),
  ]);

  const plan = planMcpGovernance(inventory);

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'skip');
  assert.equal(plan.actions[0].mcpId, 'memory');
  assert.deepEqual(plan.actions[0].agentNames, ['claude-code']);
  assert.equal(plan.actions[0].requiresWrite, false);
  assert.match(plan.actions[0].reason, /one agent/i);
});

test('planMcpGovernance sends drifted duplicate definitions to manual review without writes', () => {
  const inventory = makeInventory([
    makeMcp({
      id: 'filesystem',
      agentSources: ['claude-code', 'opencode'],
      definitions: [
        makeDefinition({ agentName: 'claude-code', command: 'npx' }),
        makeDefinition({ agentName: 'opencode', command: 'node' }),
      ],
      isDuplicate: true,
    }),
  ]);

  const plan = planMcpGovernance(inventory);

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'manual-review');
  assert.equal(plan.actions[0].mcpId, 'filesystem');
  assert.deepEqual(plan.actions[0].agentNames, ['claude-code', 'opencode']);
  assert.deepEqual(plan.actions[0].definitions?.map(definition => definition.command), ['npx', 'node']);
  assert.equal(plan.actions[0].requiresWrite, false);
  assert.match(plan.actions[0].reason, /drift/i);
});
