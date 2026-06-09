import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planMcpGovernance } from './planner.js';
import type { Inventory, MCPServer, MCPServerDefinition, McpScopePolicy } from '../types/index.js';

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
  assert.equal(plan.actions[0].envRiskPolicy, 'no-env-risk-detected');
  assert.deepEqual(plan.actions[0].canonicalProfileCandidate, {
    status: 'eligible',
    profileId: 'filesystem',
    mcpId: 'filesystem',
    sourceAgentName: 'claude-code',
    agentNames: ['claude-code', 'opencode'],
    definition: {
      transport: 'stdio',
      command: 'npx',
      host: undefined,
      isEnabled: true,
      canStart: null,
      hasSensitiveEnv: false,
      scope: undefined,
    },
    scope: undefined,
    envRiskPolicy: 'no-env-risk-detected',
    scopePolicy: 'no-scope-conflict-detected',
    blockers: [],
    blockedByEnvRisk: false,
    eligibilityReason: 'MCP server has equivalent duplicate definitions and can be represented as a canonical profile candidate',
  });
  assert.equal(plan.actions[0].requiresWrite, false);
  assert.match(plan.actions[0].reason, /equivalent duplicate/i);
});

test('planMcpGovernance keeps equivalent duplicate definitions with identical global scope as canonical candidates', () => {
  const inventory = makeInventory([
    makeMcp({
      id: 'filesystem',
      agentSources: ['claude-code', 'opencode'],
      definitions: [
        makeDefinition({ agentName: 'claude-code', command: 'npx', scope: { kind: 'global' } }),
        makeDefinition({ agentName: 'opencode', command: 'npx', scope: { kind: 'global' } }),
      ],
      isDuplicate: true,
    }),
  ]);

  const plan = planMcpGovernance(inventory);

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'canonical-candidate');
  assert.equal(plan.actions[0].mcpId, 'filesystem');
  assert.equal(plan.actions[0].requiresWrite, false);
  assert.equal(getScopePolicy(plan.actions[0]), 'no-scope-conflict-detected');
  assert.deepEqual(plan.actions[0].canonicalProfileCandidate, {
    status: 'eligible',
    profileId: 'filesystem',
    mcpId: 'filesystem',
    sourceAgentName: 'claude-code',
    agentNames: ['claude-code', 'opencode'],
    definition: {
      transport: 'stdio',
      command: 'npx',
      host: undefined,
      isEnabled: true,
      canStart: null,
      hasSensitiveEnv: false,
      scope: { kind: 'global' },
    },
    scope: { kind: 'global' },
    envRiskPolicy: 'no-env-risk-detected',
    scopePolicy: 'no-scope-conflict-detected',
    blockers: [],
    blockedByEnvRisk: false,
    eligibilityReason: 'MCP server has equivalent duplicate definitions and can be represented as a canonical profile candidate',
  });
});

test('planMcpGovernance sends equivalent duplicate definitions with different scopes to manual review', () => {
  const inventory = makeInventory([
    makeMcp({
      id: 'filesystem',
      agentSources: ['claude-code', 'opencode'],
      definitions: [
        makeDefinition({ agentName: 'claude-code', command: 'npx', scope: { kind: 'global' } }),
        makeDefinition({ agentName: 'opencode', command: 'npx', scope: { kind: 'project', id: 'project-one' } }),
      ],
      isDuplicate: true,
    }),
  ]);

  const plan = planMcpGovernance(inventory);

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'manual-review');
  assert.equal(plan.actions[0].mcpId, 'filesystem');
  assert.equal(getScopePolicy(plan.actions[0]), 'scope-conflict-requires-review');
  assert.equal(plan.actions[0].requiresWrite, false);
  assert.match(plan.actions[0].reason, /scope conflict/i);
});

test('planMcpGovernance calls out global and project duplicate scope conflicts explicitly', () => {
  const inventory = makeInventory([
    makeMcp({
      id: 'filesystem',
      agentSources: ['claude-code', 'opencode'],
      definitions: [
        makeDefinition({ agentName: 'claude-code', command: 'npx', scope: { kind: 'global' } }),
        makeDefinition({ agentName: 'opencode', command: 'npx', scope: { kind: 'project', id: 'project-one' } }),
      ],
      isDuplicate: true,
    }),
  ]);

  const plan = planMcpGovernance(inventory);

  assert.equal(plan.actions[0].type, 'manual-review');
  assert.equal(getScopePolicy(plan.actions[0]), 'scope-conflict-requires-review');
  assert.match(plan.actions[0].reason, /global/i);
  assert.match(plan.actions[0].reason, /project:project-one/i);
});

test('planMcpGovernance keeps same-project scoped duplicates canonical when otherwise equivalent', () => {
  const inventory = makeInventory([
    makeMcp({
      id: 'filesystem',
      agentSources: ['claude-code', 'opencode'],
      definitions: [
        makeDefinition({ agentName: 'claude-code', command: 'npx', scope: { kind: 'project', id: 'project-one' } }),
        makeDefinition({ agentName: 'opencode', command: 'npx', scope: { kind: 'project', id: 'project-one' } }),
      ],
      isDuplicate: true,
    }),
  ]);

  const plan = planMcpGovernance(inventory);

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'canonical-candidate');
  assert.equal(getScopePolicy(plan.actions[0]), 'no-scope-conflict-detected');
});

test('planMcpGovernance keeps env and transport review precedence over scope mismatch', () => {
  const inventory = makeInventory([
    makeMcp({
      id: 'secrets',
      agentSources: ['claude-code', 'opencode'],
      definitions: [
        makeDefinition({ agentName: 'claude-code', command: 'npx', hasSensitiveEnv: true, scope: { kind: 'global' } }),
        makeDefinition({
          agentName: 'opencode',
          command: 'npx',
          hasSensitiveEnv: true,
          scope: { kind: 'project', id: 'project-one' },
        }),
      ],
      isDuplicate: true,
      hasSensitiveEnv: true,
    }),
    makeMcp({
      id: 'unknown-server',
      agentSources: ['claude-code', 'opencode'],
      definitions: [
        makeDefinition({ agentName: 'claude-code', transport: 'unknown', command: undefined, scope: { kind: 'global' } }),
        makeDefinition({
          agentName: 'opencode',
          transport: 'unknown',
          command: undefined,
          scope: { kind: 'project', id: 'project-one' },
        }),
      ],
      transport: 'unknown',
      command: undefined,
      isDuplicate: true,
    }),
  ]);

  const plan = planMcpGovernance(inventory);

  assert.equal(plan.actions[0].type, 'manual-review');
  assert.equal(plan.actions[0].envRiskPolicy, 'sensitive-env-blocks-canonicalization');
  assert.equal(getScopePolicy(plan.actions[0]), 'scope-conflict-requires-review');
  assert.match(plan.actions[0].reason, /sensitive env risk/i);
  assert.doesNotMatch(plan.actions[0].reason, /scope conflict/i);
  assert.equal(plan.actions[1].type, 'manual-review');
  assert.equal(plan.actions[1].envRiskPolicy, 'unknown-transport-requires-review');
  assert.equal(getScopePolicy(plan.actions[1]), 'scope-conflict-requires-review');
  assert.match(plan.actions[1].reason, /unknown transport/i);
  assert.doesNotMatch(plan.actions[1].reason, /scope conflict/i);
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

test('planMcpGovernance sends sensitive env definitions to manual review with env-risk policy', () => {
  const inventory = makeInventory([
    makeMcp({
      id: 'secrets',
      agentSources: ['claude-code', 'opencode'],
      definitions: [
        makeDefinition({ agentName: 'claude-code', command: 'npx', hasSensitiveEnv: true }),
        makeDefinition({ agentName: 'opencode', command: 'npx', hasSensitiveEnv: true }),
      ],
      isDuplicate: true,
      hasSensitiveEnv: true,
    }),
  ]);

  const plan = planMcpGovernance(inventory);

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'manual-review');
  assert.equal(plan.actions[0].mcpId, 'secrets');
  assert.equal(plan.actions[0].envRiskPolicy, 'sensitive-env-blocks-canonicalization');
  assert.equal(plan.actions[0].requiresWrite, false);
  assert.match(plan.actions[0].reason, /sensitive env risk/i);
});

test('planMcpGovernance sends unknown transport definitions to manual review with env-risk policy', () => {
  const inventory = makeInventory([
    makeMcp({
      id: 'unknown-server',
      agentSources: ['claude-code', 'opencode'],
      definitions: [
        makeDefinition({ agentName: 'claude-code', transport: 'unknown', command: undefined }),
        makeDefinition({ agentName: 'opencode', transport: 'unknown', command: undefined }),
      ],
      transport: 'unknown',
      command: undefined,
      isDuplicate: true,
    }),
  ]);

  const plan = planMcpGovernance(inventory);

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'manual-review');
  assert.equal(plan.actions[0].mcpId, 'unknown-server');
  assert.equal(plan.actions[0].envRiskPolicy, 'unknown-transport-requires-review');
  assert.equal(plan.actions[0].requiresWrite, false);
  assert.match(plan.actions[0].reason, /unknown transport/i);
});

function getScopePolicy(action: { scopePolicy?: McpScopePolicy }): McpScopePolicy | undefined {
  return action.scopePolicy;
}
