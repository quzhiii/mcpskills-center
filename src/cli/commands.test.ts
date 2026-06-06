import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeCommand, renderHelp } from './commands.js';
import { applySyncPlan } from '../sync/apply.js';
import type { CliArgs } from '../cli.js';
import type { AgentConfig, Inventory, Profile } from '../types/index.js';
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

const agents: AgentConfig[] = [
  {
    name: 'claude-code',
    id: 'claude-code',
    displayName: 'Claude Code',
    scannerType: 'claude-code',
    enabled: true,
    readOnly: false,
    configDir: 'C:/claude',
    skillsDir: 'C:/claude/skills',
  },
  {
    name: 'qoder',
    id: 'qoder',
    displayName: 'Qoder',
    scannerType: 'generic',
    enabled: false,
    readOnly: true,
    configDir: 'C:/qoder',
    skillsDir: 'C:/qoder/skills',
  },
];

test('renderHelp includes current commands', () => {
  const help = renderHelp();

  assert.match(help, /scan/);
  assert.match(help, /audit/);
  assert.match(help, /sync --dry-run/);
  assert.match(help, /profile list/);
  assert.match(help, /agents list/);
  assert.match(help, /matrix/);
  assert.match(help, /health/);
});

test('executeCommand handles matrix and writes reports', async () => {
  const writes: string[] = [];
  const output = await executeCommand(makeCli('matrix'), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => makeInventory(),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => { writes.push('capability-matrix'); },
    loadProfiles: async () => profiles,
    listAgents: async () => agents,
    discoverAgents: async () => ({ generatedAt: '2026-06-04T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /Capability matrix complete!/);
  assert.match(output, /Skill Capabilities: 1/);
  assert.match(output, /MCP Capabilities: 1/);
  assert.deepEqual(writes, ['capability-matrix']);
});

test('executeCommand handles agents list through injected registry', async () => {
  const output = await executeCommand(makeCli('agents', { subcommand: 'list' }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => makeInventory(),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    loadProfiles: async () => profiles,
    listAgents: async () => agents,
    discoverAgents: async () => ({ generatedAt: '2026-06-04T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /Registered agents:/);
  assert.match(output, /claude-code - Claude Code \[scanner: claude-code, enabled, write-capable, support: dedicated read-only plus write-ready workflow support, source-of-truth-confidence: high\]/);
  assert.match(output, /qoder - Qoder \[scanner: generic, disabled, read-only, support: generic read-only placeholder, source-of-truth-confidence: low\]/);
});

test('executeCommand handles agents list with undocumented support fallback', async () => {
  const output = await executeCommand(makeCli('agents', { subcommand: 'list' }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => makeInventory(),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    loadProfiles: async () => profiles,
    listAgents: async () => [
      {
        name: 'future-agent',
        id: 'future-agent',
        displayName: 'Future Agent',
        scannerType: 'future',
        enabled: false,
        readOnly: true,
        configDir: 'C:/future',
        skillsDir: 'C:/future/skills',
      },
    ],
    discoverAgents: async () => ({ generatedAt: '2026-06-04T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /future-agent - Future Agent \[scanner: future, disabled, read-only, support: undocumented\/unknown, source-of-truth-confidence: low\]/);
});

test('executeCommand handles agents discover and writes reports', async () => {
  const writes: string[] = [];
  const output = await executeCommand(makeCli('agents', { subcommand: 'discover' }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => makeInventory(),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    loadProfiles: async () => profiles,
    listAgents: async () => agents,
    discoverAgents: async () => ({
      generatedAt: '2026-06-04T00:00:00.000Z',
      candidates: [
        { agentId: 'qoder', displayName: 'Qoder', status: 'candidate', path: 'C:/qoder', reason: 'Directory exists' },
      ],
    }),
    writeAgentDiscoveryReports: async () => { writes.push('agent-discovery'); },
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /Agent discovery complete!/);
  assert.match(output, /Candidates: 1/);
  assert.match(output, /Reports written to: C:\/reports/);
  assert.deepEqual(writes, ['agent-discovery']);
});

test('executeCommand handles scan through injected dependencies', async () => {
  const writes: string[] = [];
  const output = await executeCommand(makeCli('scan'), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => makeInventory(),
    writeAllReports: async () => { writes.push('all-reports'); },
    writeSyncPlanReports: async () => { writes.push('sync-plan'); },
    writeCapabilityMatrixReports: async () => undefined,
    loadProfiles: async () => profiles,
    listAgents: async () => agents,
    discoverAgents: async () => ({ generatedAt: '2026-06-04T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
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
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => makeInventory(),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    loadProfiles: async () => profiles,
    listAgents: async () => agents,
    discoverAgents: async () => ({ generatedAt: '2026-06-04T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
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
    agentConfigPath: 'C:/config/agents.json',
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
    writeCapabilityMatrixReports: async () => undefined,
    loadProfiles: async () => profiles,
    listAgents: async () => agents,
    discoverAgents: async () => ({ generatedAt: '2026-06-04T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
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
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => makeInventory(),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    loadProfiles: async () => profiles,
    listAgents: async () => agents,
    discoverAgents: async () => ({ generatedAt: '2026-06-04T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
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
