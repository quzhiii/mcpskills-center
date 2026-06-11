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
  assert.match(help, /mcp plan/);
  assert.match(help, /mcp apply --confirm/);
  assert.match(help, /mcp restore/);
  assert.match(help, /matrix/);
  assert.match(help, /health/);
});

test('executeCommand handles mcp plan dry-run and writes reports', async () => {
  const writes: string[] = [];
  const output = await executeCommand(makeCli('mcp', { subcommand: 'plan' }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => ({
      ...makeInventory(),
      mcpServers: [
        {
          id: 'filesystem',
          agentSources: ['claude-code', 'opencode'],
          canonicalProfileCandidate: {
            profileId: 'filesystem',
            mcpId: 'filesystem',
            sourceAgentName: 'claude-code',
            agentNames: ['claude-code', 'opencode'],
            definition: {
              transport: 'stdio',
              command: 'npx',
              host: undefined,
              isEnabled: true,
              canStart: null,
              hasSensitiveEnv: false,
            },
            blockedByEnvRisk: false,
          },
          envRiskPolicy: 'no-env-risk-detected',
          definitions: [
            {
              agentName: 'claude-code',
              transport: 'stdio',
              command: 'npx',
              isEnabled: true,
              canStart: null,
              hasSensitiveEnv: false,
            },
            {
              agentName: 'opencode',
              transport: 'stdio',
              command: 'npx',
              isEnabled: true,
              canStart: null,
              hasSensitiveEnv: false,
            },
          ],
          transport: 'stdio',
          command: 'npx',
          isDuplicate: true,
          isEnabled: true,
          canStart: null,
          hasSensitiveEnv: false,
        },
        {
          id: 'memory',
          agentSources: ['claude-code', 'codex'],
          envRiskPolicy: 'unknown-transport-requires-review',
          definitions: [
            {
              agentName: 'claude-code',
              transport: 'unknown',
              command: 'npx',
              isEnabled: true,
              canStart: null,
              hasSensitiveEnv: false,
            },
            {
              agentName: 'codex',
              transport: 'unknown',
              command: undefined,
              isEnabled: true,
              canStart: null,
              hasSensitiveEnv: false,
            },
          ],
          transport: 'unknown',
          command: undefined,
          isDuplicate: true,
          isEnabled: true,
          canStart: null,
          hasSensitiveEnv: false,
        },
      ],
    }),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    writeMcpGovernancePlanReports: async () => { writes.push('mcp-governance-plan'); },
    loadProfiles: async () => profiles,
    listAgents: async () => agents,
    discoverAgents: async () => ({ generatedAt: '2026-06-04T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /MCP governance dry-run complete!/);
  assert.match(output, /MCP Servers: 2/);
  assert.match(output, /Governance Actions: 2/);
  assert.match(output, /Canonical Candidates: 1/);
  assert.match(output, /Manual Review: 1/);
  assert.match(output, /Write Actions: 0/);
  assert.match(output, /Env Risk Policies: no-env-risk-detected=1, unknown-transport-requires-review=1/);
  assert.match(output, /Canonical Target Policies: alphabetical-write-ready-tiebreak=1/);
  assert.match(output, /Action Types: canonical-candidate=1, manual-review=1/);
  assert.match(output, /Reports written to: C:\/reports/);
  assert.deepEqual(writes, ['mcp-governance-plan']);
});

test('executeCommand summarizes scope-aware mcp plan decisions', async () => {
  const writes: string[] = [];
  const output = await executeCommand(makeCli('mcp', { subcommand: 'plan' }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => ({
      ...makeInventory(),
      mcpServers: [
        {
          id: 'filesystem',
          agentSources: ['claude-code', 'opencode'],
          definitions: [
            {
              agentName: 'claude-code',
              transport: 'stdio',
              command: 'npx',
              isEnabled: true,
              canStart: null,
              hasSensitiveEnv: false,
              scope: { kind: 'global' },
            },
            {
              agentName: 'opencode',
              transport: 'stdio',
              command: 'npx',
              isEnabled: true,
              canStart: null,
              hasSensitiveEnv: false,
              scope: { kind: 'global' },
            },
          ],
          transport: 'stdio',
          command: 'npx',
          isDuplicate: true,
          isEnabled: true,
          canStart: null,
          hasSensitiveEnv: false,
        },
        {
          id: 'memory',
          agentSources: ['claude-code', 'codex'],
          definitions: [
            {
              agentName: 'claude-code',
              transport: 'stdio',
              command: 'npx',
              isEnabled: true,
              canStart: null,
              hasSensitiveEnv: false,
              scope: { kind: 'global' },
            },
            {
              agentName: 'codex',
              transport: 'stdio',
              command: 'npx',
              isEnabled: true,
              canStart: null,
              hasSensitiveEnv: false,
              scope: { kind: 'project', id: 'project-one' },
            },
          ],
          transport: 'stdio',
          command: 'npx',
          isDuplicate: true,
          isEnabled: true,
          canStart: null,
          hasSensitiveEnv: false,
        },
      ],
    }),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    writeMcpGovernancePlanReports: async () => { writes.push('mcp-governance-plan'); },
    loadProfiles: async () => profiles,
    listAgents: async () => agents,
    discoverAgents: async () => ({ generatedAt: '2026-06-04T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /Canonical Candidates: 1/);
  assert.match(output, /Manual Review: 1/);
  assert.match(output, /Canonical Profile Eligible: 1/);
  assert.match(output, /Canonical Profile Blocked: 1/);
  assert.match(output, /Canonical Profile Blockers: scope-conflict=1/);
  assert.match(output, /Scope Policies: no-scope-conflict-detected=1, scope-conflict-requires-review=1/);
  assert.deepEqual(writes, ['mcp-governance-plan']);
});

test('executeCommand mcp plan includes write readiness summary', async () => {
  const writes: string[] = [];
  const output = await executeCommand(makeCli('mcp', { subcommand: 'plan' }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => ({
      generatedAt: '2026-06-09T00:00:00.000Z',
      agents: [
        { name: 'claude-code', configDir: 'C:/claude', skillsDir: 'C:/claude/skills' },
        { name: 'opencode', configDir: 'C:/opencode', skillsDir: 'C:/opencode/skills' },
      ],
      skills: [],
      mcpServers: [
        {
          id: 'filesystem',
          agentSources: ['claude-code', 'opencode'],
          definitions: [
            { agentName: 'claude-code', transport: 'stdio', command: 'npx', isEnabled: true, canStart: null, hasSensitiveEnv: false },
            { agentName: 'opencode', transport: 'stdio', command: 'npx', isEnabled: true, canStart: null, hasSensitiveEnv: false },
          ],
          transport: 'stdio',
          command: 'npx',
          isDuplicate: true,
          isEnabled: true,
          canStart: null,
          hasSensitiveEnv: false,
        },
      ],
      profiles: [],
    }),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    writeMcpGovernancePlanReports: async () => { writes.push('mcp-governance-plan'); },
    loadProfiles: async () => [],
    listAgents: async () => [],
    discoverAgents: async () => ({ generatedAt: '2026-06-09T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /Write-Ready Candidates:/);
  assert.match(output, /Restore-Unproven Agents:/);
  assert.match(output, /Low-Ownership Agents:/);
  assert.deepEqual(writes, ['mcp-governance-plan']);
});

test('executeCommand mcp plan resolves write readiness through scannerType for custom agent installs', async () => {
  const writes: string[] = [];
  const output = await executeCommand(makeCli('mcp', { subcommand: 'plan' }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => ({
      generatedAt: '2026-06-09T00:00:00.000Z',
      agents: [
        {
          name: 'custom-claude-install',
          id: 'custom-claude-install',
          scannerType: 'claude-code',
          configDir: 'C:/custom-claude',
          skillsDir: 'C:/custom-claude/skills',
        },
        {
          name: 'opencode',
          id: 'opencode',
          scannerType: 'opencode',
          configDir: 'C:/opencode',
          skillsDir: 'C:/opencode/skills',
        },
      ],
      skills: [],
      mcpServers: [
        {
          id: 'filesystem',
          agentSources: ['custom-claude-install', 'opencode'],
          definitions: [
            { agentName: 'custom-claude-install', transport: 'stdio', command: 'npx', isEnabled: true, canStart: null, hasSensitiveEnv: false },
            { agentName: 'opencode', transport: 'stdio', command: 'npx', isEnabled: true, canStart: null, hasSensitiveEnv: false },
          ],
          transport: 'stdio',
          command: 'npx',
          isDuplicate: true,
          isEnabled: true,
          canStart: null,
          hasSensitiveEnv: false,
        },
      ],
      profiles: [],
    }),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    writeMcpGovernancePlanReports: async () => { writes.push('mcp-governance-plan'); },
    loadProfiles: async () => [],
    listAgents: async () => [],
    discoverAgents: async () => ({ generatedAt: '2026-06-09T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /Write-Ready Candidates: 1/);
  assert.match(output, /Restore-Unproven Agents: 0/);
  assert.match(output, /Low-Ownership Agents: 0/);
  assert.deepEqual(writes, ['mcp-governance-plan']);
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

test('executeCommand handles sync dry-run with action type summary', async () => {
  const output = await executeCommand(makeCli('sync', { dryRun: true }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    profilesDir: 'C:/profiles',
    backupsDir: 'C:/backups',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/claude/skills', 'C:/opencode/skills'],
    runInventory: async () => ({
      ...makeInventory(),
      agents: [
        { name: 'claude-code', configDir: 'C:/claude', skillsDir: 'C:/claude/skills' },
        { name: 'opencode', configDir: 'C:/opencode', skillsDir: 'C:/opencode/skills' },
      ],
      skills: [
        {
          id: 'duplicate-skill',
          displayName: 'duplicate-skill',
          sourcePath: 'C:/claude/skills/duplicate-skill',
          agentInstallPaths: ['C:/claude/skills/duplicate-skill', 'C:/opencode/skills/duplicate-skill'],
          isCanonical: false,
          isSymlink: false,
          hasSkillMd: true,
          frontmatterValid: true,
          isDuplicate: true,
        },
        {
          id: 'broken-skill',
          displayName: 'broken-skill',
          sourcePath: 'C:/claude/skills/broken-skill',
          agentInstallPaths: ['C:/claude/skills/broken-skill'],
          isCanonical: false,
          isSymlink: false,
          hasSkillMd: false,
          frontmatterValid: true,
          isDuplicate: false,
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
    applySyncPlan,
    restoreSyncBackupManifest,
  });

  assert.match(output, /Sync dry-run complete!/);
  assert.match(output, /Sync Actions: 4/);
  assert.match(output, /Write Actions: 3/);
  assert.match(output, /Action Types: promote-canonical=1, distribute=2, manual-review=1/);
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
          id: 'distribute:skill-a:0',
          type: 'distribute',
          skillId: 'skill-a',
          sourcePath: 'C:/canonical/skill-a',
          targetPath: 'C:/agent/skill-a',
          mode: 'copy',
          reason: 'Distribute canonical skill to the agent install as a copy',
          requiresWrite: true,
        },
      ],
      backupEntries: [],
      receipts: [
        {
          actionId: 'distribute:skill-a:0',
          type: 'distribute',
          skillId: 'skill-a',
          targetPath: 'C:/agent/skill-a',
          appliedAt: '2026-06-03T00:00:00.000Z',
        },
      ],
    }),
    restoreSyncBackupManifest: async () => ({ restoredEntries: [] }),
  });

  assert.match(output, /Sync apply complete!/);
  assert.match(output, /Applied Actions: 1/);
  assert.match(output, /Receipts: 1/);
  assert.match(output, /Action Types: distribute=1/);
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
    applySyncPlan: async () => ({ manifestPath: 'x', appliedActions: [], backupEntries: [], receipts: [] }),
    restoreSyncBackupManifest: async () => ({
      restoredEntries: [
        {
          actionId: 'distribute:skill-a:0',
          targetPath: 'C:/agent/skill-a',
          backupPath: 'C:/backups/skill-a',
          capturedAt: '2026-06-03T00:00:00.000Z',
        },
      ],
    }),
  });

  assert.match(output, /Sync restore complete!/);
  assert.match(output, /Restored Entries: 1/);
  assert.match(output, /Restored Targets: 1/);
  assert.match(output, /Action Types: distribute=1/);
  assert.match(output, /Manifest: C:\/backups\/manifest\.json/);
});

test('executeCommand handles mcp apply --confirm', async () => {
  const output = await executeCommand(makeCli('mcp', { subcommand: 'apply', confirm: true }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => ({
      generatedAt: '2026-06-09T00:00:00.000Z',
      agents: [
        { name: 'claude-code', configDir: 'C:/claude', skillsDir: 'C:/claude/skills', mcpConfigFile: 'C:/claude/.claude.json' },
        { name: 'opencode', configDir: 'C:/opencode', skillsDir: 'C:/opencode/skills', mcpConfigFile: 'C:/opencode/opencode.json' },
      ],
      skills: [],
      mcpServers: [
        {
          id: 'filesystem',
          agentSources: ['claude-code', 'opencode'],
          definitions: [
            { agentName: 'claude-code', transport: 'stdio', command: 'npx', isEnabled: true, canStart: null, hasSensitiveEnv: false },
            { agentName: 'opencode', transport: 'stdio', command: 'npx', isEnabled: true, canStart: null, hasSensitiveEnv: false },
          ],
          transport: 'stdio',
          command: 'npx',
          isDuplicate: true,
          isEnabled: true,
          canStart: null,
          hasSensitiveEnv: false,
        },
      ],
      profiles: [],
    }),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    loadProfiles: async () => [],
    listAgents: async () => [],
    discoverAgents: async () => ({ generatedAt: '2026-06-09T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
    applySyncPlan: async () => ({ manifestPath: 'x', appliedActions: [], backupEntries: [], receipts: [] }),
    restoreSyncBackupManifest: async () => ({ restoredEntries: [] }),
    applyMcpPlan: async () => ({
      manifestPath: 'C:/backups/2026-06-09T00-00-00/manifest.json',
      appliedActions: [
        {
          id: 'apply-canonical-candidate:filesystem:0',
          type: 'add-server' as const,
          mcpId: 'filesystem',
          targetAgentName: 'claude-code',
          canonicalDefinition: { transport: 'stdio' as const, command: 'npx', isEnabled: true, canStart: true, hasSensitiveEnv: false, scope: { kind: 'global' as const } },
          reason: 'promote canonical MCP from governance action',
          requiresWrite: true,
        },
      ],
      backupEntries: [],
      receipts: [
        {
          actionId: 'apply-canonical-candidate:filesystem:0',
          type: 'add-server' as const,
          mcpId: 'filesystem',
          targetAgentName: 'claude-code',
          targetConfigPath: 'C:/claude/.claude.json',
          appliedAt: '2026-06-09T00:00:00.000Z',
        },
      ],
    }),
  });

  assert.match(output, /MCP apply complete!/);
  assert.match(output, /Applied Actions: 1/);
  assert.match(output, /Receipts: 1/);
  assert.match(output, /Manifest: C:\/backups\//);
});

test('executeCommand mcp restore requires manifest path', async () => {
  await assert.rejects(
    () => executeCommand(makeCli('mcp', { subcommand: 'restore' }), {
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
      applySyncPlan: async () => ({ manifestPath: 'x', appliedActions: [], backupEntries: [], receipts: [] }),
      restoreSyncBackupManifest: async () => ({ restoredEntries: [] }),
      restoreMcpBackupManifest: async () => ({ restoredEntries: [] }),
    }),
    { message: /Usage: node dist\/index\.js mcp restore <manifest-path>/ },
  );
});

test('executeCommand handles mcp restore with manifest path', async () => {
  const output = await executeCommand(makeCli('mcp', { subcommand: 'restore', profileName: 'C:/backups/manifest.json' }), {
    reportsDir: 'C:/reports',
    canonicalSkillsDir: 'C:/canonical',
    backupsDir: 'C:/backups',
    profilesDir: 'C:/profiles',
    syncConfigPath: 'C:/config/sync.json',
    agentConfigPath: 'C:/config/agents.json',
    approvedSyncRoots: ['C:/canonical', 'C:/agent'],
    runInventory: async () => ({
      generatedAt: '2026-06-09T00:00:00.000Z',
      agents: [
        { name: 'claude-code', configDir: 'C:/claude', skillsDir: 'C:/claude/skills', mcpConfigFile: 'C:/claude/.claude.json' },
      ],
      skills: [],
      mcpServers: [],
      profiles: [],
    }),
    writeAllReports: async () => undefined,
    writeSyncPlanReports: async () => undefined,
    writeCapabilityMatrixReports: async () => undefined,
    loadProfiles: async () => [],
    listAgents: async () => [],
    discoverAgents: async () => ({ generatedAt: '2026-06-09T00:00:00.000Z', candidates: [] }),
    writeAgentDiscoveryReports: async () => undefined,
    applySyncPlan: async () => ({ manifestPath: 'x', appliedActions: [], backupEntries: [], receipts: [] }),
    restoreSyncBackupManifest: async () => ({ restoredEntries: [] }),
    restoreMcpBackupManifest: async () => ({
      restoredEntries: [
        {
          mcpId: 'filesystem',
          targetAgentName: 'claude-code',
          targetConfigPath: 'C:/claude/.claude.json',
          backupPath: 'C:/backups/backup.json',
          backedUpAt: '2026-06-09T00:00:00.000Z',
        },
      ],
    }),
  });

  assert.match(output, /MCP restore complete!/);
  assert.match(output, /Restored Entries: 1/);
  assert.match(output, /Manifest: C:\/backups\/manifest\.json/);
});
