import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCapabilityIndex } from './capability-index.js';
import type { AgentConfig } from '../types/index.js';

test('buildCapabilityIndex maps agents to capabilities', () => {
  const agents: AgentConfig[] = [
    {
      name: 'claude-code',
      configDir: '/tmp/cc',
      skillsDir: '/tmp/cc/skills',
      support: { sourceOfTruthConfidence: 'high', mcpApplySupport: 'write-ready' } as any,
    },
    {
      name: 'opencode',
      configDir: '/tmp/oc',
      skillsDir: '/tmp/oc/skills',
    },
  ];
  const mcpServerCounts = { 'claude-code': 5, 'opencode': 2 };
  const skillCounts = { 'claude-code': 10 };

  const index = buildCapabilityIndex(agents, mcpServerCounts, skillCounts);
  assert.equal(index.length, 2);

  assert.equal(index[0].agentName, 'claude-code');
  assert.equal(index[0].sourceOfTruthConfidence, 'high');
  assert.equal(index[0].mcpApplySupport, 'write-ready');
  assert.equal(index[0].skillCount, 10);
  assert.equal(index[0].mcpServerCount, 5);

  assert.equal(index[1].agentName, 'opencode');
  assert.equal(index[1].sourceOfTruthConfidence, 'low');
  assert.equal(index[1].mcpApplySupport, 'observe-only');
  assert.equal(index[1].skillCount, 0);
  assert.equal(index[1].mcpServerCount, 2);
});

test('buildCapabilityIndex handles empty inputs', () => {
  const index = buildCapabilityIndex([], {}, {});
  assert.equal(index.length, 0);
});

test('buildCapabilityIndex defaults mcpServers to empty array', () => {
  const agents: AgentConfig[] = [
    { name: 'test-agent', configDir: '/tmp', skillsDir: '/tmp/skills' },
  ];
  const index = buildCapabilityIndex(agents, {}, {});
  assert.deepEqual(index[0].mcpServers, []);
});
