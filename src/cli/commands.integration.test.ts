import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCliArgs } from '../cli.js';
import { applySyncPlan } from '../sync/apply.js';
import { restoreSyncBackupManifest } from '../sync/restore.js';
import type { Inventory } from '../types/index.js';
import { executeCommand } from './commands.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-cli-sync-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('sync apply and restore simulate safely in an isolated CLI environment', async () => {
  const root = await makeTempRoot();
  const canonicalRoot = join(root, 'canonical');
  const reportsDir = join(root, 'reports');
  const profilesDir = join(root, 'profiles');
  const backupsDir = join(root, 'backups');
  const agentOneSkillsDir = join(root, 'claude-skills');
  const agentTwoSkillsDir = join(root, 'opencode-skills');
  const sourcePath = join(agentOneSkillsDir, 'duplicate-skill');
  const targetPath = join(agentTwoSkillsDir, 'duplicate-skill');

  await mkdir(sourcePath, { recursive: true });
  await mkdir(targetPath, { recursive: true });
  await writeFile(join(sourcePath, 'SKILL.md'), 'source content', 'utf-8');
  await writeFile(join(sourcePath, 'SOURCE_ONLY.md'), 'source-only', 'utf-8');
  await writeFile(join(targetPath, 'SKILL.md'), 'target content', 'utf-8');
  await writeFile(join(targetPath, 'TARGET_ONLY.md'), 'target-only', 'utf-8');

  const inventory: Inventory = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    agents: [
      { name: 'claude-code', configDir: join(root, 'claude-config'), skillsDir: agentOneSkillsDir },
      { name: 'opencode', configDir: join(root, 'opencode-config'), skillsDir: agentTwoSkillsDir },
    ],
    skills: [
      {
        id: 'duplicate-skill',
        displayName: 'duplicate-skill',
        sourcePath,
        agentInstallPaths: [sourcePath, targetPath],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: true,
      },
    ],
    mcpServers: [],
    profiles: [],
  };

  const context = {
    reportsDir,
    canonicalSkillsDir: canonicalRoot,
    backupsDir,
    profilesDir,
    syncConfigPath: join(root, 'config', 'sync.json'),
    agentConfigPath: join(root, 'config', 'agents.json'),
    approvedSyncRoots: [canonicalRoot, agentOneSkillsDir, agentTwoSkillsDir],
    runInventory: async () => inventory,
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    loadProfiles: async () => [],
    applySyncPlan,
    restoreSyncBackupManifest,
  };

  const applyOutput = await executeCommand(
    parseCliArgs(['sync', '--apply', '--confirm', '--canonical-dir', canonicalRoot]),
    context
  );

  const backupRuns = await readdir(backupsDir);
  const manifestPath = join(backupsDir, backupRuns[0], 'manifest.json');

  assert.match(applyOutput, /Sync apply complete!/);
  assert.equal(await readFile(join(canonicalRoot, 'duplicate-skill', 'SKILL.md'), 'utf-8'), 'source content');
  assert.equal(await readFile(join(targetPath, 'SKILL.md'), 'utf-8'), 'source content');
  assert.equal(await readFile(join(targetPath, 'SOURCE_ONLY.md'), 'utf-8'), 'source-only');

  const restoreOutput = await executeCommand(
    parseCliArgs(['sync', '--restore', manifestPath]),
    context
  );

  assert.match(restoreOutput, /Sync restore complete!/);
  assert.equal(await readFile(join(sourcePath, 'SKILL.md'), 'utf-8'), 'source content');
  assert.equal(await readFile(join(sourcePath, 'SOURCE_ONLY.md'), 'utf-8'), 'source-only');
  assert.equal(await readFile(join(targetPath, 'SKILL.md'), 'utf-8'), 'target content');
  assert.equal(await readFile(join(targetPath, 'TARGET_ONLY.md'), 'utf-8'), 'target-only');
  await assert.rejects(() => access(join(targetPath, 'SOURCE_ONLY.md')));
});
