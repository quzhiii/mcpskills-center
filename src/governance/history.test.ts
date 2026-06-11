import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHistory, appendHistoryEntry, formatHistory } from './history.js';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('readHistory returns empty history when no file exists', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'history-test-'));
  const history = await readHistory(tmpDir);
  assert.deepEqual(history.entries, []);
});

test('appendHistoryEntry creates and appends to history file', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'history-test-'));
  await appendHistoryEntry(tmpDir, {
    timestamp: '2026-06-11T00:00:00Z',
    operation: 'apply',
    domain: 'unified',
    actionCount: 5,
    summary: 'Applied 5 actions',
  });
  await appendHistoryEntry(tmpDir, {
    timestamp: '2026-06-11T01:00:00Z',
    operation: 'restore',
    domain: 'skills',
    actionCount: 3,
    summary: 'Restored 3 entries',
  });
  const history = await readHistory(tmpDir);
  assert.equal(history.entries.length, 2);
  assert.equal(history.entries[0].operation, 'apply');
  assert.equal(history.entries[1].operation, 'restore');
});

test('formatHistory returns message when empty', () => {
  const result = formatHistory({ entries: [] });
  assert.ok(result.includes('No governance operations'));
});

test('formatHistory formats entries in reverse chronological order', () => {
  const result = formatHistory({
    entries: [
      { timestamp: '2026-06-11T00:00:00Z', operation: 'apply', domain: 'unified', actionCount: 5, summary: 'Applied' },
      { timestamp: '2026-06-11T01:00:00Z', operation: 'restore', domain: 'skills', actionCount: 3, summary: 'Restored' },
    ],
  });
  const lines = result.split('\n');
  assert.ok(lines[2].includes('restore'));
  assert.ok(lines[3].includes('apply'));
});

test('formatHistory includes manifest path when present', () => {
  const result = formatHistory({
    entries: [
      { timestamp: '2026-06-11T00:00:00Z', operation: 'apply', domain: 'unified', actionCount: 5, summary: 'Applied', manifestPath: '/path/to/manifest.json' },
    ],
  });
  assert.ok(result.includes('manifest: /path/to/manifest.json'));
});
