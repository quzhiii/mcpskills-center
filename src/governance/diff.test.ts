import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffGovernancePlans, formatPlanDiff } from './diff.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('diffGovernancePlans returns empty diff when no plans exist', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'diff-test-'));
  const diff = await diffGovernancePlans(tmpDir);
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.removed, []);
});

test('diffGovernancePlans detects added actions', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'diff-test-'));
  await writeFile(join(tmpDir, 'sync-plan-current.json'), JSON.stringify({
    actions: [{ id: 'a1' }, { id: 'a2' }],
  }), 'utf-8');
  const diff = await diffGovernancePlans(tmpDir);
  assert.equal(diff.added.length, 2);
  assert.ok(diff.added.includes('a1'));
});

test('diffGovernancePlans detects removed actions', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'diff-test-'));
  await writeFile(join(tmpDir, 'sync-plan-previous.json'), JSON.stringify({
    actions: [{ id: 'a1' }, { id: 'a2' }],
  }), 'utf-8');
  const diff = await diffGovernancePlans(tmpDir);
  assert.equal(diff.removed.length, 2);
});

test('diffGovernancePlans detects unchanged actions', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'diff-test-'));
  await writeFile(join(tmpDir, 'sync-plan-current.json'), JSON.stringify({
    actions: [{ id: 'a1' }, { id: 'a3' }],
  }), 'utf-8');
  await writeFile(join(tmpDir, 'sync-plan-previous.json'), JSON.stringify({
    actions: [{ id: 'a1' }, { id: 'a2' }],
  }), 'utf-8');
  const diff = await diffGovernancePlans(tmpDir);
  assert.deepEqual(diff.added, ['a3']);
  assert.deepEqual(diff.removed, ['a2']);
  assert.deepEqual(diff.unchanged, ['a1']);
});

test('formatPlanDiff shows message when no changes', () => {
  const result = formatPlanDiff({ added: [], removed: [], changed: [], unchanged: ['a1'] });
  assert.ok(result.includes('No changes'));
});

test('formatPlanDiff shows added and removed', () => {
  const result = formatPlanDiff({
    added: ['a1'],
    removed: ['a2'],
    changed: [],
    unchanged: [],
  });
  assert.ok(result.includes('+ a1'));
  assert.ok(result.includes('- a2'));
});

test('diffGovernancePlans detects changed actions', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'diff-test-'));
  await writeFile(join(tmpDir, 'sync-plan-current.json'), JSON.stringify({
    actions: [{ id: 'a1', type: 'skip', reason: 'single agent' }],
  }), 'utf-8');
  await writeFile(join(tmpDir, 'sync-plan-previous.json'), JSON.stringify({
    actions: [{ id: 'a1', type: 'manual-review', reason: 'conflict' }],
  }), 'utf-8');
  const diff = await diffGovernancePlans(tmpDir);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.changed[0], 'a1');
});

test('diffGovernancePlans treats same fields as unchanged', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'diff-test-'));
  await writeFile(join(tmpDir, 'sync-plan-current.json'), JSON.stringify({
    actions: [{ id: 'a1', type: 'skip', reason: 'ok' }],
  }), 'utf-8');
  await writeFile(join(tmpDir, 'sync-plan-previous.json'), JSON.stringify({
    actions: [{ id: 'a1', type: 'skip', reason: 'ok' }],
  }), 'utf-8');
  const diff = await diffGovernancePlans(tmpDir);
  assert.deepEqual(diff.changed, []);
  assert.deepEqual(diff.unchanged, ['a1']);
});

test('formatPlanDiff shows changed entries', () => {
  const result = formatPlanDiff({
    added: [],
    removed: [],
    changed: ['a1'],
    unchanged: [],
  });
  assert.ok(result.includes('~ a1'));
  assert.ok(result.includes('Changed (1)'));
});
