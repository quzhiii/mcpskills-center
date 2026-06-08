import { join } from 'node:path';
import { describeAgentSupport } from '../agents/support.js';
import { runAudit } from '../auditor/index.js';
import { evaluateMcpHealth, runActiveMcpHealth } from '../health/mcp.js';
import { buildCapabilityMatrix } from '../matrix/capability.js';
import { planMcpGovernance } from '../mcp/planner.js';
import { buildMcpGovernancePlanSummary } from '../mcp/reporter.js';
import { normalizeInventory } from '../normalizer/index.js';
import { planProfile } from '../profiles/planner.js';
import { applySyncPlan } from '../sync/apply.js';
import { planSkillSync } from '../sync/planner.js';
import { buildSyncPlanSummary } from '../sync/reporter.js';
import { restoreSyncBackupManifest } from '../sync/restore.js';
import type { AgentConfig, AgentDiscoveryReport, AuditReport, Inventory, McpGovernancePlan, Profile, SyncPlan } from '../types/index.js';
import type { CliArgs } from '../cli.js';

export interface CommandContext {
  reportsDir: string;
  canonicalSkillsDir: string;
  backupsDir: string;
  profilesDir: string;
  syncConfigPath: string;
  agentConfigPath: string;
  approvedSyncRoots: string[];
  runInventory: () => Promise<Inventory>;
  writeAllReports: (inventory: Inventory, audit: AuditReport, reportsDir: string) => Promise<void>;
  writeSyncPlanReports: (plan: SyncPlan, reportsDir: string) => Promise<void>;
  writeCapabilityMatrixReports: (matrix: import('../types/index.js').CapabilityMatrix, reportsDir: string) => Promise<void>;
  writeMcpGovernancePlanReports?: (plan: McpGovernancePlan, reportsDir: string) => Promise<void>;
  loadProfiles: (profilesDir: string) => Promise<Profile[]>;
  listAgents: () => Promise<AgentConfig[]>;
  discoverAgents: () => Promise<AgentDiscoveryReport>;
  writeAgentDiscoveryReports: (report: AgentDiscoveryReport, reportsDir: string) => Promise<void>;
  applySyncPlan: typeof applySyncPlan;
  restoreSyncBackupManifest: typeof restoreSyncBackupManifest;
}

export async function executeCommand(cli: CliArgs, context: CommandContext): Promise<string> {
  switch (cli.command) {
    case 'scan':
      return executeScan(context);
    case 'audit':
      return executeAudit(context);
    case 'sync':
      return executeSync(cli, context);
    case 'profile':
      return executeProfile(cli, context);
    case 'agents':
      return executeAgents(cli, context);
    case 'mcp':
      return executeMcp(cli, context);
    case 'matrix':
      return executeMatrix(context);
    case 'health':
      return executeHealth(cli, context);
    case 'help':
      return renderHelp();
  }
}

export function renderHelp(): string {
  return [
    'Usage: node dist/index.js [command] [options]',
    '',
    'Commands:',
    '  scan                         Scan inventory and write reports',
    '  audit                        Print audit summary',
    '  sync --dry-run               Generate sync dry-run plan and reports',
    '  sync --apply --confirm       Apply sync plan with backup manifest',
    '  sync --restore <manifest>    Restore a prior sync apply from manifest',
    '  profile list                 List local profiles',
    '  profile show <name>          Show a profile JSON',
    '  profile plan <name>          Plan profile changes without writing',
    '  agents list                  List registered local agents',
    '  agents discover              Discover local agent config candidates',
    '  mcp plan                     Generate MCP governance dry-run plan and reports',
    '  matrix                       Build cross-agent capability matrix reports',
    '  health                       Run passive MCP health checks',
    '  health --active --allow-command <cmd> --timeout <ms>',
    '  help                         Show this help',
  ].join('\n');
}

async function executeMcp(cli: CliArgs, context: CommandContext): Promise<string> {
  const subcommand = cli.options.subcommand ?? 'plan';

  if (subcommand !== 'plan') {
    return 'Usage: node dist/index.js mcp plan';
  }

  if (!context.writeMcpGovernancePlanReports) {
    throw new Error('MCP governance plan report writer is not configured');
  }

  const inventory = await context.runInventory();
  const normalized = normalizeInventory(inventory);
  const plan = planMcpGovernance(normalized);
  await context.writeMcpGovernancePlanReports(plan, context.reportsDir);
  const summary = buildMcpGovernancePlanSummary(plan);

  return [
    'MCP governance dry-run complete!',
    `   MCP Servers: ${normalized.mcpServers.length}`,
    `   Governance Actions: ${plan.actions.length}`,
    `   Write Actions: ${summary.writeActions}`,
    `   Action Types: ${formatMcpSummaryActionTypes(summary.actionTypes)}`,
    '',
    `   Reports written to: ${context.reportsDir}`,
  ].join('\n');
}

async function executeScan(context: CommandContext): Promise<string> {
  const inventory = await context.runInventory();
  const normalized = normalizeInventory(inventory);
  const audit = runAudit(normalized);
  await context.writeAllReports(normalized, audit, context.reportsDir);

  return [
    'Scan complete!',
    `   Skills: ${normalized.skills.length}`,
    `   MCP Servers: ${normalized.mcpServers.length}`,
    `   Issues: ${audit.issues.length}`,
    '',
    `   Reports written to: ${context.reportsDir}`,
  ].join('\n');
}

async function executeAudit(context: CommandContext): Promise<string> {
  const inventory = await context.runInventory();
  const normalized = normalizeInventory(inventory);
  const audit = runAudit(normalized);
  const lines = [
    'Audit Summary',
    `   Total Skills: ${audit.summary.totalSkills}`,
    `   Total MCP Servers: ${audit.summary.totalMcpServers}`,
    `   Duplicate Skills: ${audit.summary.duplicateSkills}`,
    `   Duplicate MCPs: ${audit.summary.duplicateMcps}`,
    `   Missing SKILL.md: ${audit.summary.missingSkillMds}`,
    `   Broken Symlinks: ${audit.summary.brokenSymlinks}`,
    `   Sensitive Env: ${audit.summary.sensitiveEnvs}`,
  ];

  if (audit.issues.length > 0) {
    lines.push('', 'Issues found:');
    for (const issue of audit.issues) {
      lines.push(`   [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.item}`);
    }
  }

  return lines.join('\n');
}

async function executeSync(cli: CliArgs, context: CommandContext): Promise<string> {
  if (cli.options.restoreManifestPath) {
    const result = await context.restoreSyncBackupManifest(cli.options.restoreManifestPath, {
      approvedRoots: context.approvedSyncRoots,
    });
    const actionTypes = formatActionTypeCounts(countRestoreActionTypes(result.restoredEntries));
    return [
      'Sync restore complete!',
      `   Restored Entries: ${result.restoredEntries.length}`,
      `   Restored Targets: ${new Set(result.restoredEntries.map(entry => entry.targetPath)).size}`,
      `   Action Types: ${actionTypes}`,
      `   Manifest: ${cli.options.restoreManifestPath}`,
    ].join('\n');
  }

  const inventory = await context.runInventory();
  const normalized = normalizeInventory(inventory);
  const audit = runAudit(normalized);
  const canonicalSkillsDir = cli.options.canonicalDir ?? context.canonicalSkillsDir;
  const plan = planSkillSync(normalized, {
    canonicalSkillsDir,
    strategy: 'symlink',
    agentNames: normalized.agents.map(agent => agent.name),
  });

  if (cli.options.apply) {
    const result = await context.applySyncPlan(plan, {
      confirm: cli.options.confirm,
      backupsDir: context.backupsDir,
      approvedRoots: context.approvedSyncRoots,
    });
    const actionTypes = formatActionTypeCounts(countActionTypes(result.appliedActions));

    return [
      'Sync apply complete!',
      `   Applied Actions: ${result.appliedActions.length}`,
      `   Backup Entries: ${result.backupEntries.length}`,
      `   Receipts: ${result.receipts.length}`,
      `   Action Types: ${actionTypes}`,
      `   Manifest: ${result.manifestPath}`,
    ].join('\n');
  }

  await context.writeAllReports(normalized, audit, context.reportsDir);
  await context.writeSyncPlanReports(plan, context.reportsDir);
  const syncSummary = buildSyncPlanSummary(plan);

  return [
    'Sync dry-run complete!',
    `   Skills: ${normalized.skills.length}`,
    `   MCP Servers: ${normalized.mcpServers.length}`,
    `   Audit Issues: ${audit.issues.length}`,
    `   Sync Actions: ${plan.actions.length}`,
    `   Write Actions: ${syncSummary.writeActions}`,
    `   Action Types: ${formatSyncSummaryActionTypes(syncSummary.actionTypes)}`,
    '',
    `   Reports written to: ${context.reportsDir}`,
  ].join('\n');
}

async function executeProfile(cli: CliArgs, context: CommandContext): Promise<string> {
  const profiles = await context.loadProfiles(context.profilesDir);
  const subcommand = cli.options.subcommand ?? 'list';

  switch (subcommand) {
    case 'list':
      return ['Available profiles:', ...profiles.map(profile => `   ${profile.name} - ${profile.description}`)].join('\n');
    case 'show':
      return JSON.stringify(findProfile(profiles, cli.options.profileName), null, 2);
    case 'plan': {
      const profile = findProfile(profiles, cli.options.profileName);
      const inventory = await context.runInventory();
      const normalized = normalizeInventory(inventory);
      const plan = planProfile(profile, normalized);
      return [
        `Profile plan: ${plan.profileName}`,
        ...plan.actions.map(action => `   [${action.type}] ${action.targetType}: ${action.targetId} - ${action.reason}`),
      ].join('\n');
    }
    default:
      return 'Usage: node dist/index.js profile [list|show|plan] [name]';
  }
}

async function executeHealth(cli: CliArgs, context: CommandContext): Promise<string> {
  const inventory = await context.runInventory();
  const normalized = normalizeInventory(inventory);
  const lines = [cli.options.active ? 'Running active MCP health checks...' : 'Running passive MCP health checks...'];

  for (const mcp of normalized.mcpServers) {
    const result = cli.options.active
      ? await runActiveMcpHealth(mcp, {
        allowCommands: cli.options.allowCommands,
        timeoutMs: cli.options.timeoutMs,
      })
      : evaluateMcpHealth(mcp);
    lines.push(`   [${result.status.toUpperCase()}] ${result.serverId}: ${result.reasons.join('; ')}`);
  }

  return lines.join('\n');
}

async function executeMatrix(context: CommandContext): Promise<string> {
  const inventory = await context.runInventory();
  const normalized = normalizeInventory(inventory);
  const matrix = buildCapabilityMatrix(normalized);
  await context.writeCapabilityMatrixReports(matrix, context.reportsDir);

  return [
    'Capability matrix complete!',
    `   Skill Capabilities: ${matrix.summary.totalSkillCapabilities}`,
    `   MCP Capabilities: ${matrix.summary.totalMcpCapabilities}`,
    '',
    `   Reports written to: ${context.reportsDir}`,
  ].join('\n');
}

async function executeAgents(cli: CliArgs, context: CommandContext): Promise<string> {
  const subcommand = cli.options.subcommand ?? 'list';

  switch (subcommand) {
    case 'list': {
      const agents = await context.listAgents();
      return [
        'Registered agents:',
        ...agents.map(agent => {
          const support = describeAgentSupport(agent.id ?? agent.name);
          return `   ${agent.id ?? agent.name} - ${agent.displayName ?? agent.name} [scanner: ${agent.scannerType ?? agent.name}, ${agent.enabled === false ? 'disabled' : 'enabled'}, ${agent.readOnly ? 'read-only' : 'write-capable'}, support: ${support.currentLevel}, source-of-truth-confidence: ${support.sourceOfTruthConfidence}]`;
        }),
      ].join('\n');
    }
    case 'discover': {
      const report = await context.discoverAgents();
      await context.writeAgentDiscoveryReports(report, context.reportsDir);
      return [
        'Agent discovery complete!',
        `   Candidates: ${report.candidates.length}`,
        '',
        `   Reports written to: ${context.reportsDir}`,
      ].join('\n');
    }
    default:
      return 'Usage: node dist/index.js agents [list|discover]';
  }
}

function findProfile<T extends { name: string }>(profiles: T[], name: string | undefined): T {
  if (!name) throw new Error('Profile name is required');
  const profile = profiles.find(item => item.name === name);
  if (!profile) throw new Error(`Profile not found: ${name}`);
  return profile;
}

function countActionTypes(actions: Array<{ type: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const action of actions) {
    counts[action.type] = (counts[action.type] ?? 0) + 1;
  }
  return counts;
}

function countRestoreActionTypes(entries: Array<{ actionId: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const actionType = entry.actionId.split(':')[0] || 'unknown';
    counts[actionType] = (counts[actionType] ?? 0) + 1;
  }
  return counts;
}

function formatActionTypeCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  return entries.length > 0 ? entries.map(([type, count]) => `${type}=${count}`).join(', ') : 'none';
}

function formatSyncSummaryActionTypes(actionTypes: ReturnType<typeof buildSyncPlanSummary>['actionTypes']): string {
  const entries = Object.entries(actionTypes);
  return entries.length > 0 ? entries.map(([type, count]) => `${type}=${count.actions}`).join(', ') : 'none';
}

function formatMcpSummaryActionTypes(actionTypes: ReturnType<typeof buildMcpGovernancePlanSummary>['actionTypes']): string {
  const entries = Object.entries(actionTypes);
  return entries.length > 0 ? entries.map(([type, count]) => `${type}=${count.actions}`).join(', ') : 'none';
}

export function createDefaultPaths(dirname: string): Pick<CommandContext, 'reportsDir' | 'canonicalSkillsDir' | 'backupsDir' | 'profilesDir' | 'syncConfigPath' | 'agentConfigPath' | 'approvedSyncRoots'> {
  return {
    reportsDir: join(dirname, '..', 'reports'),
    canonicalSkillsDir: join(dirname, '..', 'config', 'canonical-skills'),
    backupsDir: join(dirname, '..', 'backups'),
    profilesDir: join(dirname, '..', 'config', 'profiles'),
    syncConfigPath: join(dirname, '..', 'config', 'sync.json'),
    agentConfigPath: join(dirname, '..', 'config', 'agents.json'),
    approvedSyncRoots: [
      join(dirname, '..', 'config', 'canonical-skills'),
      'C:/Users/quzhi/.claude/skills',
      'C:/Users/quzhi/.opencode/skills',
      'C:/Users/quzhi/.codex/skills',
    ],
  };
}
