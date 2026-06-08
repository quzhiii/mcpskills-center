import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { backupSyncActionTarget, readBackupManifest } from './backup.js';
import type { SyncAction } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-backup-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('backupSyncActionTarget creates backup copy and manifest entry', async () => {
  const root = await makeTempRoot();
  const targetPath = join(root, 'agent', 'skills', 'duplicate-skill', 'SKILL.md');
  await mkdir(join(root, 'agent', 'skills', 'duplicate-skill'), { recursive: true });
  await writeFile(targetPath, 'original skill content', 'utf-8');

  const action: SyncAction = {
    id: 'distribute:duplicate-skill:0',
    type: 'distribute',
    skillId: 'duplicate-skill',
    targetPath,
    sourcePath: join(root, 'canonical', 'duplicate-skill', 'SKILL.md'),
    mode: 'copy',
    requiresWrite: true,
    reason: 'Distribute canonical skill to the agent install as a copy',
  };

  const result = await backupSyncActionTarget(action, join(root, 'backups'));
  const manifest = await readBackupManifest(result.manifestPath);
  const backupContent = await readFile(result.entries[0].backupPath, 'utf-8');

  assert.equal(manifest.entries.length, 1);
  assert.equal(manifest.entries[0].actionId, action.id);
  assert.equal(manifest.entries[0].targetPath, targetPath);
  assert.equal(backupContent, 'original skill content');
});
