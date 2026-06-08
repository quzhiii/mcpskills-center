import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySyncPlan } from './apply.js';
import { readBackupManifest } from './backup.js';
import type { SyncPlan } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-apply-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('applySyncPlan copies canonical skill into agent target and writes backup manifest', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const agentRoot = join(root, 'agent');
  const backupsDir = join(root, 'backups');
  const sourcePath = join(canonicalRoot, 'duplicate-skill');
  const targetPath = join(agentRoot, 'duplicate-skill');

  await mkdir(sourcePath, { recursive: true });
  await mkdir(targetPath, { recursive: true });
  await writeFile(join(sourcePath, 'SKILL.md'), 'new content', 'utf-8');
  await writeFile(join(targetPath, 'SKILL.md'), 'old content', 'utf-8');

  const plan: SyncPlan = {
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
  };

  const result = await applySyncPlan(plan, {
    confirm: true,
    backupsDir,
    approvedRoots: [canonicalRoot, agentRoot],
  });

  const targetContent = await readFile(join(targetPath, 'SKILL.md'), 'utf-8');
  const manifest = await readBackupManifest(result.manifestPath);
  const backupContent = await readFile(join(manifest.entries[0].backupPath, 'SKILL.md'), 'utf-8');

  assert.equal(targetContent, 'new content');
  assert.equal(result.appliedActions.length, 1);
  assert.equal(manifest.entries[0].targetPath, targetPath);
  assert.equal(backupContent, 'old content');
});

test('applySyncPlan skips backup for new targets and still applies plan', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const agentRoot = join(root, 'agent');
  const backupsDir = join(root, 'backups');
  const sourcePath = join(canonicalRoot, 'duplicate-skill');
  const targetPath = join(agentRoot, 'duplicate-skill');

  await mkdir(sourcePath, { recursive: true });
  await writeFile(join(sourcePath, 'SKILL.md'), 'new content', 'utf-8');

  const plan: SyncPlan = {
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
  };

  const result = await applySyncPlan(plan, {
    confirm: true,
    backupsDir,
    approvedRoots: [canonicalRoot, agentRoot],
  });

  const targetContent = await readFile(join(targetPath, 'SKILL.md'), 'utf-8');

  assert.equal(targetContent, 'new content');
  assert.equal(result.backupEntries.length, 0);
});

test('applySyncPlan writes one consolidated manifest for multiple backups', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const agentRoot = join(root, 'agent');
  const backupsDir = join(root, 'backups');
  const sourceOne = join(canonicalRoot, 'skill-one');
  const sourceTwo = join(canonicalRoot, 'skill-two');
  const targetOne = join(agentRoot, 'skill-one');
  const targetTwo = join(agentRoot, 'skill-two');

  await mkdir(sourceOne, { recursive: true });
  await mkdir(sourceTwo, { recursive: true });
  await mkdir(targetOne, { recursive: true });
  await mkdir(targetTwo, { recursive: true });
  await writeFile(join(sourceOne, 'SKILL.md'), 'new one', 'utf-8');
  await writeFile(join(sourceTwo, 'SKILL.md'), 'new two', 'utf-8');
  await writeFile(join(targetOne, 'SKILL.md'), 'old one', 'utf-8');
  await writeFile(join(targetTwo, 'SKILL.md'), 'old two', 'utf-8');

  const plan: SyncPlan = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    canonicalSkillsDir: canonicalRoot,
    strategy: 'copy',
    actions: [
      {
        id: 'distribute:skill-one:0',
        type: 'distribute',
        skillId: 'skill-one',
        sourcePath: sourceOne,
        targetPath: targetOne,
        mode: 'copy',
        reason: 'Distribute canonical skill to the agent install as a copy',
        requiresWrite: true,
      },
      {
        id: 'distribute:skill-two:1',
        type: 'distribute',
        skillId: 'skill-two',
        sourcePath: sourceTwo,
        targetPath: targetTwo,
        mode: 'copy',
        reason: 'Distribute canonical skill to the agent install as a copy',
        requiresWrite: true,
      },
    ],
  };

  const result = await applySyncPlan(plan, {
    confirm: true,
    backupsDir,
    approvedRoots: [canonicalRoot, agentRoot],
  });

  const manifest = await readBackupManifest(result.manifestPath);

  assert.equal(result.backupEntries.length, 2);
  assert.equal(manifest.entries.length, 2);
});

test('applySyncPlan records receipts for every executed write action', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const agentRoot = join(root, 'agent');
  const backupsDir = join(root, 'backups');
  const sourcePath = join(canonicalRoot, 'duplicate-skill');
  const targetPath = join(agentRoot, 'duplicate-skill');

  await mkdir(sourcePath, { recursive: true });
  await mkdir(targetPath, { recursive: true });
  await writeFile(join(sourcePath, 'SKILL.md'), 'new content', 'utf-8');
  await writeFile(join(targetPath, 'SKILL.md'), 'old content', 'utf-8');

  const result = await applySyncPlan({
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
  }, {
    confirm: true,
    backupsDir,
    approvedRoots: [canonicalRoot, agentRoot],
  });

  assert.equal(result.receipts.length, 1);
  assert.equal(result.receipts[0].actionId, 'distribute:duplicate-skill:0');
  assert.equal(result.receipts[0].type, 'distribute');
  assert.equal(result.receipts[0].skillId, 'duplicate-skill');
  assert.equal(result.receipts[0].targetPath, targetPath);
  assert.equal(result.receipts[0].backupPath, result.backupEntries[0].backupPath);
});

test('applySyncPlan refuses unsupported write action types instead of silently skipping them', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const agentRoot = join(root, 'agent');
  const skillPath = join(agentRoot, 'skill-one');
  await mkdir(skillPath, { recursive: true });

  await assert.rejects(
    () => applySyncPlan({
      generatedAt: '2026-06-03T00:00:00.000Z',
      canonicalSkillsDir: canonicalRoot,
      strategy: 'copy',
      actions: [
        {
          id: 'repair-metadata:skill-one:0',
          type: 'repair-metadata',
          skillId: 'skill-one',
          sourcePath: skillPath,
          targetPath: skillPath,
          reason: 'Repair invalid metadata after manual review',
          requiresWrite: true,
        },
      ],
    }, {
      confirm: true,
      backupsDir: join(root, 'backups'),
      approvedRoots: [canonicalRoot, agentRoot],
    }),
    /Unsupported sync write action/
  );
});

test('applySyncPlan refuses ambiguous duplicate targets before writing', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const agentRoot = join(root, 'agent');
  const sourceOne = join(canonicalRoot, 'skill-one');
  const sourceTwo = join(canonicalRoot, 'skill-two');
  const targetPath = join(agentRoot, 'shared-target');

  await mkdir(sourceOne, { recursive: true });
  await mkdir(sourceTwo, { recursive: true });
  await mkdir(targetPath, { recursive: true });
  await writeFile(join(sourceOne, 'SKILL.md'), 'new one', 'utf-8');
  await writeFile(join(sourceTwo, 'SKILL.md'), 'new two', 'utf-8');
  await writeFile(join(targetPath, 'SKILL.md'), 'old content', 'utf-8');

  await assert.rejects(
    () => applySyncPlan({
      generatedAt: '2026-06-03T00:00:00.000Z',
      canonicalSkillsDir: canonicalRoot,
      strategy: 'copy',
      actions: [
        {
          id: 'distribute:skill-one:0',
          type: 'distribute',
          skillId: 'skill-one',
          sourcePath: sourceOne,
          targetPath,
          mode: 'copy',
          reason: 'Distribute canonical skill to the agent install as a copy',
          requiresWrite: true,
        },
        {
          id: 'distribute:skill-two:1',
          type: 'distribute',
          skillId: 'skill-two',
          sourcePath: sourceTwo,
          targetPath,
          mode: 'copy',
          reason: 'Distribute canonical skill to the agent install as a copy',
          requiresWrite: true,
        },
      ],
    }, {
      confirm: true,
      backupsDir: join(root, 'backups'),
      approvedRoots: [canonicalRoot, agentRoot],
    }),
    /Ambiguous sync target/
  );

  assert.equal(await readFile(join(targetPath, 'SKILL.md'), 'utf-8'), 'old content');
});

test('applySyncPlan writes manifest for completed backups when a later action fails', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const agentRoot = join(root, 'agent');
  const backupsDir = join(root, 'backups');
  const sourceOne = join(canonicalRoot, 'skill-one');
  const missingSourceTwo = join(canonicalRoot, 'missing-skill-two');
  const targetOne = join(agentRoot, 'skill-one');
  const targetTwo = join(agentRoot, 'skill-two');

  await mkdir(sourceOne, { recursive: true });
  await mkdir(targetOne, { recursive: true });
  await mkdir(targetTwo, { recursive: true });
  await writeFile(join(sourceOne, 'SKILL.md'), 'new one', 'utf-8');
  await writeFile(join(targetOne, 'SKILL.md'), 'old one', 'utf-8');
  await writeFile(join(targetTwo, 'SKILL.md'), 'old two', 'utf-8');

  const plan: SyncPlan = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    canonicalSkillsDir: canonicalRoot,
    strategy: 'copy',
    actions: [
      {
        id: 'distribute:skill-one:0',
        type: 'distribute',
        skillId: 'skill-one',
        sourcePath: sourceOne,
        targetPath: targetOne,
        mode: 'copy',
        reason: 'Distribute canonical skill to the agent install as a copy',
        requiresWrite: true,
      },
      {
        id: 'distribute:skill-two:1',
        type: 'distribute',
        skillId: 'skill-two',
        sourcePath: missingSourceTwo,
        targetPath: targetTwo,
        mode: 'copy',
        reason: 'Distribute canonical skill to the agent install as a copy',
        requiresWrite: true,
      },
    ],
  };

  await assert.rejects(
    () => applySyncPlan(plan, {
      confirm: true,
      backupsDir,
      approvedRoots: [canonicalRoot, agentRoot],
    })
  );

  const backupRuns = await readdir(backupsDir);
  assert.equal(backupRuns.length, 1);

  const manifest = await readBackupManifest(join(backupsDir, backupRuns[0], 'manifest.json'));
  assert.equal(manifest.entries.length, 2);
  assert.equal(manifest.entries[0].targetPath, targetOne);
  assert.equal(manifest.entries[1].targetPath, targetTwo);
});

test('applySyncPlan refuses when confirm flag is missing', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const sourcePath = join(canonicalRoot, 'duplicate-skill');
  await mkdir(sourcePath, { recursive: true });

  const plan: SyncPlan = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    canonicalSkillsDir: canonicalRoot,
    strategy: 'copy',
    actions: [
      {
        id: 'promote-canonical:duplicate-skill:0',
        type: 'promote-canonical',
        skillId: 'duplicate-skill',
        sourcePath,
        targetPath: join(root, 'target'),
        reason: 'Promote one reviewed skill instance into the canonical store',
        requiresWrite: true,
      },
    ],
  };

  await assert.rejects(
    () => applySyncPlan(plan, {
      confirm: false,
      backupsDir: join(root, 'backups'),
      approvedRoots: [canonicalRoot, join(root, 'target')],
    }),
    /requires --confirm/
  );
});

test('applySyncPlan refuses target paths outside approved roots', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const sourcePath = join(canonicalRoot, 'duplicate-skill');
  await mkdir(sourcePath, { recursive: true });

  const plan: SyncPlan = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    canonicalSkillsDir: canonicalRoot,
    strategy: 'copy',
    actions: [
      {
        id: 'distribute:duplicate-skill:0',
        type: 'distribute',
        skillId: 'duplicate-skill',
        sourcePath,
        targetPath: 'C:/outside/duplicate-skill',
        mode: 'copy',
        reason: 'Distribute canonical skill to the agent install as a copy',
        requiresWrite: true,
      },
    ],
  };

  await assert.rejects(
    () => applySyncPlan(plan, {
      confirm: true,
      backupsDir: join(root, 'backups'),
      approvedRoots: [canonicalRoot, join(root, 'agent')],
    }),
    /outside approved roots/
  );
});
