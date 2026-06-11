import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { routeTask } from './router.js';
import type { AgentConfig } from '../types/index.js';

function makePolicyPath(tmpDir: string, policy: object): string {
  const configPath = join(tmpDir, 'routing-policy.json');
  writeFileSync(configPath, JSON.stringify(policy));
  return configPath;
}

const dummyAgents: AgentConfig[] = [
  { name: 'claude-code', configDir: '/tmp/cc', skillsDir: '/tmp/cc/s' },
  { name: 'opencode', configDir: '/tmp/oc', skillsDir: '/tmp/oc/s' },
  { name: 'codex', configDir: '/tmp/cx', skillsDir: '/tmp/cx/s' },
];

test('routeTask recommends preferred agent for matched category', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'route-test-'));
  const configPath = makePolicyPath(tmpDir, {
    version: '1',
    taskCategories: [
      { id: 'coding', keywords: ['code', 'fix', 'bug'], requiredCapabilities: [], eligibleAgents: ['claude-code', 'opencode'], preferredAgent: 'claude-code' },
    ],
    fallbackOrder: ['claude-code', 'opencode', 'codex'],
  });

  const result = await routeTask('fix this bug', configPath, dummyAgents);
  assert.equal(result.recommendedAgent, 'claude-code');
  assert.equal(result.category, 'coding');
  assert.ok(result.alternatives.includes('opencode'));
  rmSync(tmpDir, { recursive: true, force: true });
});

test('routeTask uses fallback when no category matches', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'route-test-'));
  const configPath = makePolicyPath(tmpDir, {
    version: '1',
    taskCategories: [
      { id: 'coding', keywords: ['code'], requiredCapabilities: [], eligibleAgents: ['claude-code'] },
    ],
    fallbackOrder: ['claude-code', 'opencode', 'codex'],
  });

  const result = await routeTask('random unrelated task', configPath, dummyAgents);
  assert.equal(result.recommendedAgent, 'claude-code');
  assert.equal(result.category, 'unclassified');
  assert.deepEqual(result.alternatives, ['opencode', 'codex']);
  rmSync(tmpDir, { recursive: true, force: true });
});

test('routeTask returns first eligible when no preferredAgent', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'route-test-'));
  const configPath = makePolicyPath(tmpDir, {
    version: '1',
    taskCategories: [
      { id: 'docs', keywords: ['readme'], requiredCapabilities: [], eligibleAgents: ['opencode', 'codex'] },
    ],
    fallbackOrder: ['claude-code'],
  });

  const result = await routeTask('update the readme', configPath, dummyAgents);
  assert.equal(result.recommendedAgent, 'opencode');
  assert.equal(result.category, 'docs');
  rmSync(tmpDir, { recursive: true, force: true });
});
