import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGovernanceDb, insertGovernanceHistory, readGovernanceHistory, insertInventorySnapshot, readInventorySnapshots, insertActionResult, readActionResults, insertRoutingLog, readRoutingLog } from './index.js';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'db-test-'));
}

test('openGovernanceDb creates database with all tables', () => {
  const tmpDir = makeTempDir();
  const db = openGovernanceDb(join(tmpDir, 'test.db'));
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const tableNames = tables.map((t: any) => t.name);
  assert.ok(tableNames.includes('governance_history'));
  assert.ok(tableNames.includes('inventory_snapshots'));
  assert.ok(tableNames.includes('action_results'));
  db.close();
});

test('insertGovernanceHistory and readGovernanceHistory round-trip', () => {
  const tmpDir = makeTempDir();
  const db = openGovernanceDb(join(tmpDir, 'test.db'));
  insertGovernanceHistory(db, {
    timestamp: '2026-06-11T00:00:00Z',
    operation: 'apply',
    domain: 'unified',
    actionCount: 5,
    manifestPath: '/path/manifest.json',
    summary: 'Applied 5 actions',
  });
  insertGovernanceHistory(db, {
    timestamp: '2026-06-11T01:00:00Z',
    operation: 'restore',
    domain: 'skills',
    actionCount: 3,
    summary: 'Restored 3 entries',
  });
  const entries = readGovernanceHistory(db);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].operation, 'restore');
  assert.equal(entries[0].manifestPath, null);
  assert.equal(entries[1].operation, 'apply');
  assert.equal(entries[1].actionCount, 5);
  assert.equal(entries[1].manifestPath, '/path/manifest.json');
  db.close();
});

test('readGovernanceHistory respects limit', () => {
  const tmpDir = makeTempDir();
  const db = openGovernanceDb(join(tmpDir, 'test.db'));
  for (let i = 0; i < 10; i++) {
    insertGovernanceHistory(db, {
      timestamp: `2026-06-11T${String(i).padStart(2, '0')}:00:00Z`,
      operation: 'apply',
      domain: 'unified',
      actionCount: i,
      summary: `Run ${i}`,
    });
  }
  const entries = readGovernanceHistory(db, 3);
  assert.equal(entries.length, 3);
  db.close();
});

test('insertInventorySnapshot and readInventorySnapshots round-trip', () => {
  const tmpDir = makeTempDir();
  const db = openGovernanceDb(join(tmpDir, 'test.db'));
  insertInventorySnapshot(db, {
    capturedAt: '2026-06-11T00:00:00Z',
    skillCount: 76,
    mcpServerCount: 15,
    agentCount: 8,
  });
  const snapshots = readInventorySnapshots(db);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].skillCount, 76);
  assert.equal(snapshots[0].mcpServerCount, 15);
  db.close();
});

test('insertActionResult and readActionResults round-trip', () => {
  const tmpDir = makeTempDir();
  const db = openGovernanceDb(join(tmpDir, 'test.db'));
  insertActionResult(db, {
    runTimestamp: '2026-06-11T00:00:00Z',
    domain: 'skills',
    actionId: 'promote-canonical:neat-freak',
    actionType: 'promote-canonical',
    target: '/path/to/skill',
    status: 'applied',
  });
  insertActionResult(db, {
    runTimestamp: '2026-06-11T00:00:00Z',
    domain: 'mcp',
    actionId: 'add-server:filesystem',
    actionType: 'add-server',
    target: '~/.claude.json',
    status: 'applied',
  });
  const results = readActionResults(db);
  assert.equal(results.length, 2);
  assert.equal(results[0].domain, 'mcp');
  assert.equal(results[1].domain, 'skills');
  db.close();
});

test('readActionResults filters by domain', () => {
  const tmpDir = makeTempDir();
  const db = openGovernanceDb(join(tmpDir, 'test.db'));
  insertActionResult(db, { runTimestamp: 't1', domain: 'skills', actionId: 'a1', actionType: 'skip', status: 'skipped' });
  insertActionResult(db, { runTimestamp: 't1', domain: 'mcp', actionId: 'a2', actionType: 'add-server', status: 'applied' });
  const skillsResults = readActionResults(db, 'skills');
  assert.equal(skillsResults.length, 1);
  assert.equal(skillsResults[0].domain, 'skills');
  db.close();
});

test('openGovernanceDb creates routing_log table', () => {
  const tmpDir = makeTempDir();
  const db = openGovernanceDb(join(tmpDir, 'test.db'));
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const tableNames = tables.map((t: any) => t.name);
  assert.ok(tableNames.includes('routing_log'));
  db.close();
});

test('insertRoutingLog and readRoutingLog round-trip', () => {
  const tmpDir = makeTempDir();
  const db = openGovernanceDb(join(tmpDir, 'test.db'));
  insertRoutingLog(db, {
    timestamp: '2026-06-11T00:00:00Z',
    taskDescription: 'fix this bug',
    recommendedAgent: 'claude-code',
    category: 'coding',
    alternatives: 'opencode, codex',
    reasoning: 'Task matches category "coding".',
  });
  const entries = readRoutingLog(db);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].recommendedAgent, 'claude-code');
  assert.equal(entries[0].taskDescription, 'fix this bug');
  assert.equal(entries[0].category, 'coding');
  assert.equal(entries[0].alternatives, 'opencode, codex');
  db.close();
});

test('readRoutingLog respects limit', () => {
  const tmpDir = makeTempDir();
  const db = openGovernanceDb(join(tmpDir, 'test.db'));
  for (let i = 0; i < 5; i++) {
    insertRoutingLog(db, {
      timestamp: `2026-06-11T${String(i).padStart(2, '0')}:00:00Z`,
      taskDescription: `task ${i}`,
      recommendedAgent: 'agent',
      category: 'cat',
      reasoning: `reason ${i}`,
    });
  }
  const entries = readRoutingLog(db, 3);
  assert.equal(entries.length, 3);
  db.close();
});
