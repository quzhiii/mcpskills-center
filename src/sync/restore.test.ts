import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySyncPlan } from './apply.js';
import { restoreSyncBackupManifest } from './restore.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-restore-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('restoreSyncBackupManifest restores overwritten directory contents', async () => {
  const root = await makeTempRoot();
  const targetPath = join(root, 'agent', 'duplicate-skill');
  const backupPath = join(root, 'backups', 'duplicate-skill');
  const manifestPath = join(root, 'backups', 'manifest.json');

  await mkdir(targetPath, { recursive: true });
  await mkdir(backupPath, { recursive: true });
  await writeFile(join(targetPath, 'SKILL.md'), 'new content', 'utf-8');
  await writeFile(join(backupPath, 'SKILL.md'), 'old content', 'utf-8');
  await writeFile(
    manifestPath,
    JSON.stringify({
      generatedAt: '2026-06-03T00:00:00.000Z',
      entries: [
        {
          actionId: 'distribute:duplicate-skill:0',
          targetPath,
          backupPath,
          capturedAt: '2026-06-03T00:00:00.000Z',
        },
      ],
    }),
    'utf-8'
  );

  const result = await restoreSyncBackupManifest(manifestPath, { approvedRoots: [join(root, 'agent')] });
  const restoredContent = await readFile(join(targetPath, 'SKILL.md'), 'utf-8');

  assert.equal(result.restoredEntries.length, 1);
  assert.equal(restoredContent, 'old content');
});

test('restoreSyncBackupManifest rejects malformed manifests', async () => {
  const root = await makeTempRoot();
  const manifestPath = join(root, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify({ generatedAt: '2026-06-03T00:00:00.000Z', entries: [{}] }), 'utf-8');

  await assert.rejects(
    () => restoreSyncBackupManifest(manifestPath, { approvedRoots: [root] }),
    /Malformed backup manifest/
  );
});

test('restoreSyncBackupManifest fully reverts an apply run', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const agentRoot = join(root, 'agent');
  const backupsDir = join(root, 'backups');
  const sourcePath = join(canonicalRoot, 'duplicate-skill');
  const targetPath = join(agentRoot, 'duplicate-skill');

  await mkdir(sourcePath, { recursive: true });
  await mkdir(targetPath, { recursive: true });
  await writeFile(join(sourcePath, 'SKILL.md'), 'new content', 'utf-8');
  await writeFile(join(sourcePath, 'NEW_ONLY.md'), 'new-only', 'utf-8');
  await writeFile(join(targetPath, 'SKILL.md'), 'old content', 'utf-8');
  await writeFile(join(targetPath, 'OLD_ONLY.md'), 'old-only', 'utf-8');

  const applyResult = await applySyncPlan(
    {
      generatedAt: '2026-06-03T00:00:00.000Z',
      canonicalSkillsDir: canonicalRoot,
      strategy: 'copy',
      actions: [
        {
          id: 'distribute:duplicate-skill:0',
          type: 'distribute',
          skillId: 'duplicate-skill',
          sourcePath,
          targetPath,
          mode: 'copy',
          reason: 'Distribute canonical skill to the agent install as a copy',
          requiresWrite: true,
        },
      ],
    },
    {
      confirm: true,
      backupsDir,
      approvedRoots: [canonicalRoot, agentRoot],
    }
  );

  await restoreSyncBackupManifest(applyResult.manifestPath, { approvedRoots: [agentRoot] });

  const restoredSkill = await readFile(join(targetPath, 'SKILL.md'), 'utf-8');
  const restoredOldOnly = await readFile(join(targetPath, 'OLD_ONLY.md'), 'utf-8');

  assert.equal(restoredSkill, 'old content');
  assert.equal(restoredOldOnly, 'old-only');
  await assert.rejects(() => access(join(targetPath, 'NEW_ONLY.md')));
});

test('restoreSyncBackupManifest refuses target paths outside approved roots', async () => {
  const root = await makeTempRoot();
  const approvedRoot = join(root, 'approved');
  const outsideRoot = join(root, 'outside');
  const targetPath = join(outsideRoot, 'duplicate-skill');
  const backupPath = join(root, 'backups', 'duplicate-skill');
  const manifestPath = join(root, 'backups', 'manifest.json');

  await mkdir(backupPath, { recursive: true });
  await writeFile(join(backupPath, 'SKILL.md'), 'old content', 'utf-8');
  await writeFile(
    manifestPath,
    JSON.stringify({
      generatedAt: '2026-06-03T00:00:00.000Z',
      entries: [
        {
          actionId: 'distribute:duplicate-skill:0',
          targetPath,
          backupPath,
          capturedAt: '2026-06-03T00:00:00.000Z',
        },
      ],
    }),
    'utf-8'
  );

  await assert.rejects(
    () => restoreSyncBackupManifest(manifestPath, { approvedRoots: [approvedRoot] }),
    /outside approved roots/
  );
});
