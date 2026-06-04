import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeCommand, renderHelp } from './commands.js';
import { applySyncPlan } from '../sync/apply.js';
import type { CliArgs } from '../cli.js';
import type { Inventory, Profile } from '../types/index.js';
import { restoreSyncBackupManifest } from '../sync/restore.js';

function makeCli(command: CliArgs['command'], options: Partial<CliArgs['options']> = {}): CliArgs {
  return {
    command,
    options: {
      dryRun: false,
      apply: false,
      confirm: false,
      active: false,
      allowCommands: [],
      timeoutMs: 3000,
      ...options,
    },
  };
}

function makeInventory(): Inventory {
  return {
    generatedAt: '2026-06-03T00:00:00.000Z',
    agents: [{ name: 'claude-code', configDir: 'C:/claude', skillsDir: 'C:/claude/skills' }],
    skills: [
      {
        id: 'skill-a',
        displayName: 'skill-a',
        sourcePath: 'C:/claude/skills/skill-a',
        agentInstallPaths: ['C:/claude/skills/skill-a'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: false,
      },
    ],
    mcpServers: [
      {
        id: 'agentmemory',
        agentSources: ['claude-code'],
        transport: 'stdio',
        command: 'npx',
        isDuplicate: false,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
    ],
    profiles: [],
  };
}

const profiles: Profile[] = [
  {
    name: 'coding',
    description: 'Coding profile',
    agents: ['claude-code'],
    mcpServers: ['agentmemory'],
    skills: ['skill-a'],
  },
];

test('renderHelp includes current commands', () => {
  const help = renderHelp();

  assert.match(help, /scan/);
  assert.match(help, /audit/);
  assert.match(help, /sync --dry-run/);
  assert.match(help, /profile list/);
  assert.match(help, /health/);
});

test('executeCommand handles scan through injected dependencies', async () => {
  const writes: string[] = [];
  const output = await executeCommand(makeCli('scan'), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => makeInventory(),
    writeAllReports: async () => { writes.push('all-reports'); },
    writeSyncPlanReports: async () => { writes.push('sync-plan'); },
    loadProfiles: async () => profiles,
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /Scan complete/);
  assert.deepEqual(writes, ['all-reports']);
});

test('executeCommand handles profile plan through injected dependencies', async () => {
  const output = await executeCommand(makeCli('profile', { subcommand: 'plan', profileName: 'coding' }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => makeInventory(),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    loadProfiles: async () => profiles,
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /Profile plan: coding/);
  assert.match(output, /\[already-present\] mcp-server: agentmemory/);
});

test('executeCommand handles sync apply through injected dependencies', async () => {
  const output = await executeCommand(makeCli('sync', { apply: true, confirm: true }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    profilesDir: 'C:/profiles',
    backupsDir: 'C:/backups',
    syncConfigPath: 'C:/config/sync.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => ({
      ...makeInventory(),
      skills: [
        {
          id: 'skill-a',
          displayName: 'skill-a',
          sourcePath: 'C:/canonical/skill-a',
          agentInstallPaths: ['C:/agent/skill-a', 'C:/canonical/skill-a'],
          isCanonical: false,
          isSymlink: false,
          hasSkillMd: true,
          frontmatterValid: true,
          isDuplicate: true,
        },
      ],
    }),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    loadProfiles: async () => profiles,
    applySyncPlan: async () => ({
      manifestPath: 'C:/backups/manifest.json',
      appliedActions: [
        {
          id: 'copy-to-agent:skill-a:0',
          type: 'copy-to-agent',
          skillId: 'skill-a',
          sourcePath: 'C:/canonical/skill-a',
          targetPath: 'C:/agent/skill-a',
          reason: 'Copy canonical skill contents to the agent install location',
          requiresWrite: true,
        },
      ],
      backupEntries: [],
    }),
    restoreSyncBackupManifest: async () => ({ restoredEntries: [] }),
  });

  assert.match(output, /Sync apply complete!/);
  assert.match(output, /Applied Actions: 1/);
  assert.match(output, /Manifest: C:\/backups\/manifest\.json/);
});

test('executeCommand handles sync restore through injected dependencies', async () => {
  const output = await executeCommand(makeCli('sync', { restoreManifestPath: 'C:/backups/manifest.json' }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    profilesDir: 'C:/profiles',
    backupsDir: 'C:/backups',
    syncConfigPath: 'C:/config/sync.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => makeInventory(),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    loadProfiles: async () => profiles,
    applySyncPlan: async () => ({ manifestPath: 'x', appliedActions: [], backupEntries: [] }),
    restoreSyncBackupManifest: async () => ({
      restoredEntries: [
        {
          actionId: 'copy-to-agent:skill-a:0',
          targetPath: 'C:/agent/skill-a',
          backupPath: 'C:/backups/skill-a',
          capturedAt: '2026-06-03T00:00:00.000Z',
        },
      ],
    }),
  });

  assert.match(output, /Sync restore complete!/);
  assert.match(output, /Restored Entries: 1/);
  assert.match(output, /Manifest: C:\/backups\/manifest\.json/);
});
