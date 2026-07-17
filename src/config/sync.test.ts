import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadSyncConfig } from './sync.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-sync-config-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('loadSyncConfig reads approved sync roots from config file', async () => {
  const root = await makeTempRoot();
  const configDir = join(root, 'config');
  const configPath = join(configDir, 'sync.json');
  const approvedSyncRoots = [join(root, 'custom', 'canonical'), join(root, 'custom', 'agent')];

  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify({ approvedSyncRoots }, null, 2), 'utf-8');

  const config = await loadSyncConfig(configPath, ['C:/default']);

  assert.deepEqual(config.approvedSyncRoots, approvedSyncRoots);
});

test('loadSyncConfig resolves relative approved roots from project root', async () => {
  const root = await makeTempRoot();
  const configDir = join(root, 'config');
  const configPath = join(configDir, 'sync.json');

  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify({ approvedSyncRoots: ['config/canonical-skills', 'agent-skills'] }), 'utf-8');

  const config = await loadSyncConfig(configPath, ['C:/default']);

  assert.deepEqual(config.approvedSyncRoots, [
    resolve(root, 'config/canonical-skills'),
    resolve(root, 'agent-skills'),
  ]);
});

test('loadSyncConfig falls back to defaults when config file is missing', async () => {
  const root = await makeTempRoot();
  const configPath = join(root, 'config', 'sync.json');

  const config = await loadSyncConfig(configPath, ['C:/default/canonical', 'C:/default/agent']);

  assert.deepEqual(config.approvedSyncRoots, ['C:/default/canonical', 'C:/default/agent']);
});

test('loadSyncConfig rejects invalid approved sync roots', async () => {
  const root = await makeTempRoot();
  const configDir = join(root, 'config');
  const configPath = join(configDir, 'sync.json');

  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify({ approvedSyncRoots: [123] }), 'utf-8');

  await assert.rejects(
    () => loadSyncConfig(configPath, ['C:/default']),
    /Sync config approvedSyncRoots must be an array of non-empty strings/
  );
});

test('loadSyncConfig expands home paths and removes duplicate roots', async () => {
  const root = await makeTempRoot();
  const configDir = join(root, 'config');
  const configPath = join(configDir, 'sync.json');
  const homeDir = join(root, 'home');
  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify({
    approvedSyncRoots: ['~/.claude/skills', '~/.claude/skills', '../canonical-skills'],
  }));

  const config = await loadSyncConfig(configPath, [], { baseDir: configDir, homeDir });

  assert.deepEqual(config.approvedSyncRoots, [
    join(homeDir, '.claude', 'skills'),
    resolve(configDir, '../canonical-skills'),
  ]);
});

test('loadSyncConfig rejects empty approved roots', async () => {
  const root = await makeTempRoot();
  const configPath = join(root, 'config', 'sync.json');
  await mkdir(join(root, 'config'), { recursive: true });
  await writeFile(configPath, JSON.stringify({ approvedSyncRoots: ['  '] }));

  await assert.rejects(() => loadSyncConfig(configPath, []), /non-empty strings/);
});
