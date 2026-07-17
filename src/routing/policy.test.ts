import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadRoutingPolicy, matchTaskCategory } from './policy.js';
import type { RoutingPolicy } from './policy.js';

test('loadRoutingPolicy reads and validates config', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'policy-test-'));
  const configPath = join(tmpDir, 'routing-policy.json');
  await writeFile(configPath, JSON.stringify({
    version: '1',
    taskCategories: [{ id: 'test', keywords: ['test'], requiredCapabilities: [], eligibleAgents: ['claude-code'] }],
    fallbackOrder: ['claude-code'],
  }));
  const policy = await loadRoutingPolicy(configPath);
  assert.equal(policy.version, '1');
  assert.equal(policy.taskCategories.length, 1);
  rmSync(tmpDir, { recursive: true, force: true });
});

test('loadRoutingPolicy rejects missing version', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'policy-test-'));
  const configPath = join(tmpDir, 'routing-policy.json');
  await writeFile(configPath, JSON.stringify({
    taskCategories: [],
    fallbackOrder: [],
  }));
  await assert.rejects(() => loadRoutingPolicy(configPath), /missing required fields/);
  rmSync(tmpDir, { recursive: true, force: true });
});

test('loadRoutingPolicy rejects malformed task categories', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'policy-test-'));
  const configPath = join(tmpDir, 'routing-policy.json');
  await writeFile(configPath, JSON.stringify({
    version: '1',
    taskCategories: [{ id: '', keywords: 'test', requiredCapabilities: [], eligibleAgents: [] }],
    fallbackOrder: ['claude-code'],
  }));
  await assert.rejects(() => loadRoutingPolicy(configPath), /task category/i);
  rmSync(tmpDir, { recursive: true, force: true });
});

test('matchTaskCategory finds matching category', () => {
  const policy: RoutingPolicy = {
    version: '1',
    taskCategories: [
      { id: 'coding', keywords: ['code', 'fix', 'bug'], requiredCapabilities: [], eligibleAgents: ['claude-code'] },
      { id: 'research', keywords: ['search', 'analyze'], requiredCapabilities: [], eligibleAgents: ['opencode'] },
    ],
    fallbackOrder: ['claude-code', 'opencode'],
  };
  assert.equal(matchTaskCategory(policy, 'fix this bug')?.id, 'coding');
  assert.equal(matchTaskCategory(policy, 'search for info')?.id, 'research');
  assert.equal(matchTaskCategory(policy, 'random task')?.id, undefined);
});

test('matchTaskCategory is case-insensitive', () => {
  const policy: RoutingPolicy = {
    version: '1',
    taskCategories: [
      { id: 'coding', keywords: ['CODE'], requiredCapabilities: [], eligibleAgents: ['claude-code'] },
    ],
    fallbackOrder: ['claude-code'],
  };
  assert.equal(matchTaskCategory(policy, 'write some CODE')?.id, 'coding');
});

test('matchTaskCategory returns first match', () => {
  const policy: RoutingPolicy = {
    version: '1',
    taskCategories: [
      { id: 'first', keywords: ['fix'], requiredCapabilities: [], eligibleAgents: ['a'] },
      { id: 'second', keywords: ['fix'], requiredCapabilities: [], eligibleAgents: ['b'] },
    ],
    fallbackOrder: ['a'],
  };
  assert.equal(matchTaskCategory(policy, 'fix it')?.id, 'first');
});
