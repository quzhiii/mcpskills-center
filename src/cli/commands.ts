import { join } from 'node:path';
import { copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import process from 'node:process';
import { describeAgentSupport } from '../agents/support.js';
import { runAudit } from '../auditor/index.js';
import { evaluateMcpHealth, runActiveMcpHealth } from '../health/mcp.js';
import { buildCapabilityMatrix } from '../matrix/capability.js';
import { planMcpGovernance } from '../mcp/planner.js';
import { buildMcpApplyPlan } from '../mcp/apply-plan.js';
import { buildMcpGovernancePlanSummary } from '../mcp/reporter.js';
import { normalizeInventory } from '../normalizer/index.js';
import { planProfile } from '../profiles/planner.js';
import { applySyncPlan } from '../sync/apply.js';
import { planSkillSync } from '../sync/planner.js';
import { buildSyncPlanSummary } from '../sync/reporter.js';
import { restoreSyncBackupManifest } from '../sync/restore.js';
import { writeGovernanceReports } from '../governance/reporter.js';
import { writeGovernanceConsole } from '../governance/console.js';
import { readHistory, appendHistoryEntry, formatHistory, type GovernanceHistory } from '../governance/history.js';
import { diffGovernancePlans, formatPlanDiff } from '../governance/diff.js';
import { routeTask } from '../routing/router.js';
import type { AgentConfig, AgentDiscoveryReport, AuditReport, Inventory, McpApplyResult, McpGovernancePlan, Profile, SyncPlan } from '../types/index.js';
import type { CliArgs } from '../cli.js';
import type { applyMcpPlan } from '../mcp/apply.js';
import type { restoreMcpBackupManifest, RestoreMcpResult } from '../mcp/restore.js';
import type Database from 'better-sqlite3';

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
  writeMcpGovernancePlanReports?: (plan: McpGovernancePlan, reportsDir: string, agents?: AgentConfig[]) => Promise<void>;
  loadProfiles: (profilesDir: string) => Promise<Profile[]>;
  listAgents: () => Promise<AgentConfig[]>;
  discoverAgents: () => Promise<AgentDiscoveryReport>;
  writeAgentDiscoveryReports: (report: AgentDiscoveryReport, reportsDir: string) => Promise<void>;
  applySyncPlan: typeof applySyncPlan;
  restoreSyncBackupManifest: typeof restoreSyncBackupManifest;
  applyMcpPlan?: typeof applyMcpPlan;
  restoreMcpBackupManifest?: typeof restoreMcpBackupManifest;
  db?: Database.Database;
}

export interface RuntimePathEnv {
  platform: NodeJS.Platform;
  homeDir: string;
  appData?: string;
  xdgDataHome?: string;
}

export function resolveUserDataRoot(env: RuntimePathEnv): string {
  if (env.platform === 'win32') {
    return env.appData
      ? join(env.appData, 'mcpskills-center')
      : join(env.homeDir, 'AppData', 'Roaming', 'mcpskills-center');
  }

  if (env.platform === 'darwin') {
    return join(env.homeDir, 'Library', 'Application Support', 'mcpskills-center');
  }

  return join(env.xdgDataHome ?? join(env.homeDir, '.local', 'share'), 'mcpskills-center');
}

export function resolveGovernanceDbPath(reportsDir: string): string {
  return join(reportsDir, '..', 'data', 'governance.db');
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
    case 'governance':
      return executeGovernance(cli, context);
    case 'governance-diff':
      return executeGovernanceDiff(context);
    case 'history':
      return executeHistory(context);
    case 'route':
      return executeRoute(cli, context);
    case 'web':
      return executeWeb(cli, context);
    case 'help':
      return renderHelp();
  }
}

export function renderHelp(): string {
  return [
    'MCPskills Center — Local-first agent skills and MCP governance CLI',
    '',
    'Usage: mcpskills <command> [options]',
    '',
    'Quick Start:',
    '  mcpskills scan                          Scan inventory and generate reports',
    '  mcpskills governance --dry-run          Unified skills + MCP governance plan',
    '  mcpskills route "fix this bug"          Recommend which agent to use',
    '',
    'Skills Sync:',
    '  mcpskills sync --dry-run                Generate sync plan',
    '  mcpskills sync --apply --confirm        Apply sync plan with backups',
    '  mcpskills sync --restore <manifest>     Restore from manifest',
    '',
    'MCP Governance:',
    '  mcpskills mcp plan                      Generate MCP governance plan',
    '  mcpskills mcp apply --confirm           Apply MCP governance plan',
    '  mcpskills mcp restore <manifest>        Restore MCP config',
    '',
    'Unified Governance:',
    '  mcpskills governance --dry-run          Plan both skills + MCP',
    '  mcpskills governance --apply --confirm  Apply both',
    '  mcpskills governance --restore <path>   Restore both',
    '  mcpskills governance-diff               Compare plans',
    '  mcpskills history                       View operation history',
    '',
    'Inspection:',
    '  mcpskills audit                         Print audit summary',
    '  mcpskills agents list                   List registered agents',
    '  mcpskills agents discover               Discover agent candidates',
    '  mcpskills matrix                        Build capability matrix',
    '  mcpskills health                        Passive MCP health checks',
    '  mcpskills health --active --allow-command npx',
    '  mcpskills route <task>                  Recommend agent for task',
    '',
    'Web Console:',
    '  mcpskills web [--port <port>]           Start local Web console (default: 3000)',
    '',
    'Profiles:',
    '  mcpskills profile list                  List profiles',
    '  mcpskills profile show <name>           Show profile JSON',
    '  mcpskills profile plan <name>           Plan profile changes',
    '',
    'Options:',
    '  --dry-run                               Plan without writing',
    '  --apply                                 Execute the plan',
    '  --confirm                               Required for apply',
    '  --restore <manifest>                    Restore from manifest',
    '  --canonical-dir <path>                  Custom canonical skills dir',
    '  --active                                Enable active health probes',
    '  --allow-command <cmd>                   Allowlist command for probes',
    '  --timeout <ms>                          Probe timeout (default: 3000)',
    '',
    'Examples:',
    '  mcpskills scan                          First-time inventory scan',
    '  mcpskills sync --dry-run                Review skills sync plan',
    '  mcpskills governance --apply --confirm  Apply all changes',
    '  mcpskills route "implement a feature"   Get agent recommendation',
    '  mcpskills history                       See past operations',
    '',
    'Documentation: https://github.com/quzhiii/mcpskills-center',
  ].join('\n');
}

async function executeMcp(cli: CliArgs, context: CommandContext): Promise<string> {
  const subcommand = cli.options.subcommand ?? 'plan';

  if (subcommand === 'apply') {
    if (!context.applyMcpPlan) throw new Error('MCP apply is not configured');
    const inventory = await context.runInventory();
    const normalized = normalizeInventory(inventory);
    const governancePlan = planMcpGovernance(normalized);
    const agentConfigPaths = buildAgentConfigPaths(normalized.agents);
    const applyPlan = buildMcpApplyPlan(governancePlan, Object.values(agentConfigPaths));
    applyPlan.confirm = cli.options.confirm;
    const result = await context.applyMcpPlan(applyPlan, {
      backupsDir: context.backupsDir,
      agentConfigPaths,
    });
    return [
      'MCP apply complete!',
      `   Applied Actions: ${result.appliedActions.length}`,
      `   Backup Entries: ${result.backupEntries.length}`,
      `   Receipts: ${result.receipts.length}`,
      `   Manifest: ${result.manifestPath}`,
    ].join('\n');
  }

  if (subcommand === 'restore') {
    if (!context.restoreMcpBackupManifest) throw new Error('MCP restore is not configured');
    const manifestPath = cli.options.profileName;
    if (!manifestPath) throw new Error('Usage: node dist/index.js mcp restore <manifest-path>');
    const inventory = await context.runInventory();
    const normalized = normalizeInventory(inventory);
    const agentConfigPaths = buildAgentConfigPaths(normalized.agents);
    const result = await context.restoreMcpBackupManifest(manifestPath, {
      approvedRoots: Object.values(agentConfigPaths),
    });
    return [
      'MCP restore complete!',
      `   Restored Entries: ${result.restoredEntries.length}`,
      `   Manifest: ${manifestPath}`,
    ].join('\n');
  }

  if (subcommand === 'plan') {
    if (!context.writeMcpGovernancePlanReports) {
      throw new Error('MCP governance plan report writer is not configured');
    }

    const inventory = await context.runInventory();
    const normalized = normalizeInventory(inventory);
    const plan = planMcpGovernance(normalized);
    await context.writeMcpGovernancePlanReports(plan, context.reportsDir, normalized.agents);
    const summary = buildMcpGovernancePlanSummary(plan, normalized.agents);

    return [
      'MCP governance dry-run complete!',
      `   MCP Servers: ${normalized.mcpServers.length}`,
      `   Governance Actions: ${plan.actions.length}`,
      `   Canonical Candidates: ${summary.canonicalCandidates}`,
      `   Manual Review: ${summary.manualReviewActions}`,
      `   Canonical Profile Eligible: ${summary.canonicalProfileEligible}`,
      `   Canonical Profile Blocked: ${summary.canonicalProfileBlocked}`,
      `   Canonical Profile Blockers: ${formatActionTypeCounts(summary.canonicalProfileBlockers)}`,
      `   Write Actions: ${summary.writeActions}`,
      `   Env Risk Policies: ${formatActionTypeCounts(summary.envRiskPolicies)}`,
      `   Canonical Target Policies: ${formatActionTypeCounts(summary.canonicalTargetPolicies)}`,
      `   Scope Policies: ${formatActionTypeCounts(countMcpScopePolicies(plan.actions))}`,
      `   Write-Ready Candidates: ${summary.writeReadyCandidates}`,
      `   Restore-Unproven Agents: ${summary.restoreUnprovenAgentCount}`,
      `   Low-Ownership Agents: ${summary.lowOwnershipAgentCount}`,
      `   Action Types: ${formatMcpSummaryActionTypes(summary.actionTypes)}`,
      '',
    `   Reports written to: ${context.reportsDir}`,
    `   Unified report: ${context.reportsDir}/governance-current.json`,
  ].join('\n');
}

  return 'Usage: node dist/index.js mcp [plan|apply|restore]';
}

async function executeGovernance(cli: CliArgs, context: CommandContext): Promise<string> {
  if (cli.options.restoreManifestPath) {
    const syncResult = await context.restoreSyncBackupManifest(cli.options.restoreManifestPath, {
      approvedRoots: context.approvedSyncRoots,
    });

    let mcpResult: RestoreMcpResult | null = null;
    if (context.restoreMcpBackupManifest) {
      const inventory = await context.runInventory();
      const normalized = normalizeInventory(inventory);
      const agentConfigPaths = buildAgentConfigPaths(normalized.agents);
      mcpResult = await context.restoreMcpBackupManifest(cli.options.restoreManifestPath, {
        approvedRoots: Object.values(agentConfigPaths),
      });
    }

    const lines = [
      'Governance restore complete!',
      '',
      'Skills Sync:',
      `   Restored Entries: ${syncResult.restoredEntries.length}`,
      `   Manifest: ${cli.options.restoreManifestPath}`,
    ];

    if (mcpResult) {
      lines.push(
        '',
        'MCP Governance:',
        `   Restored Entries: ${mcpResult.restoredEntries.length}`,
        `   Manifest: ${cli.options.restoreManifestPath}`,
      );
    }

    await appendHistoryEntry(context.reportsDir, {
      timestamp: new Date().toISOString(),
      operation: 'restore',
      domain: mcpResult ? 'unified' : 'skills',
      actionCount: syncResult.restoredEntries.length + (mcpResult?.restoredEntries.length ?? 0),
      manifestPath: cli.options.restoreManifestPath,
      summary: `Restored ${syncResult.restoredEntries.length} skills${mcpResult ? ` + ${mcpResult.restoredEntries.length} MCP` : ''}`,
    });

    return lines.join('\n');
  }

  const inventory = await context.runInventory();
  const normalized = normalizeInventory(inventory);
  const audit = runAudit(normalized);
  const canonicalSkillsDir = cli.options.canonicalDir ?? context.canonicalSkillsDir;

  if (context.db) {
    const { insertInventorySnapshot } = await import('../db/index.js');
    insertInventorySnapshot(context.db, {
      capturedAt: new Date().toISOString(),
      skillCount: normalized.skills.length,
      mcpServerCount: normalized.mcpServers.length,
      agentCount: normalized.agents.length,
    });
  }

  if (cli.options.apply) {
    await snapshotCurrentPlansAsPrevious(context.reportsDir);

    const syncPlan = planSkillSync(normalized, {
      canonicalSkillsDir,
      strategy: 'symlink',
      agentNames: normalized.agents.map(agent => agent.name),
    });
    const syncResult = await context.applySyncPlan(syncPlan, {
      confirm: cli.options.confirm,
      backupsDir: context.backupsDir,
      approvedRoots: context.approvedSyncRoots,
    });

    let mcpResult: McpApplyResult | null = null;
    if (context.applyMcpPlan) {
      const mcpPlan = planMcpGovernance(normalized);
      const agentConfigPaths = buildAgentConfigPaths(normalized.agents);
      const applyPlan = buildMcpApplyPlan(mcpPlan, Object.values(agentConfigPaths));
      applyPlan.confirm = cli.options.confirm;
      mcpResult = await context.applyMcpPlan(applyPlan, {
        backupsDir: context.backupsDir,
        agentConfigPaths,
      });
    }

    const lines = [
      'Governance apply complete!',
      '',
      'Skills:',
      `   Applied Actions: ${syncResult.appliedActions.length}`,
      `   Backup Entries: ${syncResult.backupEntries.length}`,
      `   Receipts: ${syncResult.receipts.length}`,
      `   Manifest: ${syncResult.manifestPath}`,
    ];

    if (mcpResult) {
      lines.push(
        '',
        'MCP:',
        `   Applied Actions: ${mcpResult.appliedActions.length}`,
        `   Backup Entries: ${mcpResult.backupEntries.length}`,
        `   Receipts: ${mcpResult.receipts.length}`,
        `   Manifest: ${mcpResult.manifestPath}`,
      );
    }

    await appendHistoryEntry(context.reportsDir, {
      timestamp: new Date().toISOString(),
      operation: 'apply',
      domain: mcpResult ? 'unified' : 'skills',
      actionCount: syncResult.appliedActions.length + (mcpResult?.appliedActions.length ?? 0),
      manifestPath: syncResult.manifestPath,
      summary: `Applied ${syncResult.appliedActions.length} skills${mcpResult ? ` + ${mcpResult.appliedActions.length} MCP` : ''}`,
    });

    if (context.db) {
      const { insertActionResult, insertGovernanceHistory } = await import('../db/index.js');
      const runTimestamp = new Date().toISOString();

      insertGovernanceHistory(context.db, {
        timestamp: runTimestamp,
        operation: 'apply',
        domain: mcpResult ? 'unified' : 'skills',
        actionCount: syncResult.appliedActions.length + (mcpResult?.appliedActions.length ?? 0),
        manifestPath: syncResult.manifestPath,
        summary: `Applied ${syncResult.appliedActions.length} skills + ${mcpResult?.appliedActions.length ?? 0} MCP actions`,
      });

      for (const action of syncResult.appliedActions) {
        insertActionResult(context.db, {
          runTimestamp,
          domain: 'skills',
          actionId: action.id,
          actionType: action.type,
          target: action.targetPath,
          status: 'applied',
        });
      }
      if (mcpResult) {
        for (const action of mcpResult.appliedActions) {
          insertActionResult(context.db, {
            runTimestamp,
            domain: 'mcp',
            actionId: action.id,
            actionType: action.type,
            target: action.targetAgentName,
            status: 'applied',
          });
        }
      }
    }

    return lines.join('\n');
  }

  const syncPlan = planSkillSync(normalized, {
    canonicalSkillsDir,
    strategy: 'symlink',
    agentNames: normalized.agents.map(agent => agent.name),
  });
  await context.writeAllReports(normalized, audit, context.reportsDir);
  await context.writeSyncPlanReports(syncPlan, context.reportsDir);
  const syncSummary = buildSyncPlanSummary(syncPlan);

  const mcpPlan = planMcpGovernance(normalized);
  if (context.writeMcpGovernancePlanReports) {
    await context.writeMcpGovernancePlanReports(mcpPlan, context.reportsDir, normalized.agents);
  }
  const mcpSummary = buildMcpGovernancePlanSummary(mcpPlan, normalized.agents);

  await writeGovernanceReports({
    generatedAt: new Date().toISOString(),
    skills: {
      totalSkills: normalized.skills.length,
      syncActions: syncPlan.actions.length,
      writeActions: syncSummary.writeActions,
    },
    mcp: {
      totalServers: normalized.mcpServers.length,
      governanceActions: mcpPlan.actions.length,
      canonicalCandidates: mcpSummary.canonicalCandidates,
    },
  }, context.reportsDir);

  const history = await readHistory(context.reportsDir);
  const consolePath = await writeGovernanceConsole({
    generatedAt: new Date().toISOString(),
    skills: {
      totalSkills: normalized.skills.length,
      syncActions: syncPlan.actions.length,
      writeActions: syncSummary.writeActions,
      actionBreakdown: countActionTypes(syncPlan.actions),
    },
    mcp: {
      totalServers: normalized.mcpServers.length,
      governanceActions: mcpPlan.actions.length,
      canonicalCandidates: mcpSummary.canonicalCandidates,
      manualReview: mcpSummary.manualReviewActions,
      actionBreakdown: countActionTypes(mcpPlan.actions),
    },
    history: history.entries,
  }, context.reportsDir);

  return [
    'Governance dry-run complete!',
    '',
    'Skills Sync:',
    `   Skills: ${normalized.skills.length}`,
    `   Sync Actions: ${syncPlan.actions.length}`,
    `   Write Actions: ${syncSummary.writeActions}`,
    `   Action Types: ${formatSyncSummaryActionTypes(syncSummary.actionTypes)}`,
    '',
    'MCP Governance:',
    `   MCP Servers: ${normalized.mcpServers.length}`,
    `   Governance Actions: ${mcpPlan.actions.length}`,
    `   Canonical Candidates: ${mcpSummary.canonicalCandidates}`,
    `   Manual Review: ${mcpSummary.manualReviewActions}`,
    `   Write Actions: ${mcpSummary.writeActions}`,
    '',
    `   Reports written to: ${context.reportsDir}`,
    `   Unified report: ${context.reportsDir}/governance-current.json`,
    `   Console: ${consolePath}`,
  ].join('\n');
}

async function executeHistory(context: CommandContext): Promise<string> {
  if (context.db) {
    const { readGovernanceHistory } = await import('../db/index.js');
    const entries = readGovernanceHistory(context.db);
    return formatHistory({ entries: entries as GovernanceHistory['entries'] });
  }
  const history = await readHistory(context.reportsDir);
  return formatHistory(history);
}

async function executeGovernanceDiff(context: CommandContext): Promise<string> {
  const diff = await diffGovernancePlans(context.reportsDir);
  return formatPlanDiff(diff);
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
    `   Unified report: ${context.reportsDir}/governance-current.json`,
  ].join('\n');
    }
    default:
      return 'Usage: node dist/index.js agents [list|discover]';
  }
}

async function executeRoute(cli: CliArgs, context: CommandContext): Promise<string> {
  const taskDescription = cli.options.profileName;
  if (!taskDescription) {
    return 'Usage: node dist/index.js route <task-description>';
  }

  const policyPath = join(context.profilesDir, '..', 'routing-policy.json');
  const agents = await context.listAgents();
  const result = await routeTask(taskDescription, policyPath, agents, context.db);

  return [
    'Route Recommendation:',
    `   Task: ${taskDescription}`,
    `   Category: ${result.category}`,
    `   Recommended: ${result.recommendedAgent}`,
    `   Alternatives: ${result.alternatives.join(', ') || 'none'}`,
    `   Reasoning: ${result.reasoning}`,
  ].join('\n');
}

async function executeWeb(cli: CliArgs, context: CommandContext): Promise<string> {
  const port = Number(cli.options.profileName) || 3000;
  const { startWebServer } = await import('../web/server.js');
  await startWebServer(port, context);
  return new Promise(() => {});
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

function countMcpScopePolicies(actions: Array<{ scopePolicy?: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const action of actions) {
    if (!action.scopePolicy) continue;
    counts[action.scopePolicy] = (counts[action.scopePolicy] ?? 0) + 1;
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

function buildAgentConfigPaths(agents: AgentConfig[]): Record<string, string> {
  const paths: Record<string, string> = {};
  for (const agent of agents) {
    if (agent.mcpConfigFile) {
      paths[agent.name] = agent.mcpConfigFile;
    }
  }
  return paths;
}

export async function snapshotCurrentPlansAsPrevious(reportsDir: string): Promise<void> {
  const pairs: [string, string][] = [
    ['sync-plan-current.json', 'sync-plan-previous.json'],
    ['mcp-governance-plan-current.json', 'mcp-governance-plan-previous.json'],
  ];
  for (const [src, dst] of pairs) {
    try {
      await copyFile(join(reportsDir, src), join(reportsDir, dst));
    } catch {
      // No previous plan to snapshot
    }
  }
}

export function createDefaultPaths(
  dirname: string,
  runtimeEnv: RuntimePathEnv = {
    platform: process.platform,
    homeDir: homedir(),
    appData: process.env.APPDATA,
    xdgDataHome: process.env.XDG_DATA_HOME,
  },
): Pick<CommandContext, 'reportsDir' | 'canonicalSkillsDir' | 'backupsDir' | 'profilesDir' | 'syncConfigPath' | 'agentConfigPath' | 'approvedSyncRoots'> {
  const home = runtimeEnv.homeDir;
  const userDataRoot = resolveUserDataRoot(runtimeEnv);
  return {
    reportsDir: join(userDataRoot, 'reports'),
    canonicalSkillsDir: join(dirname, '..', 'config', 'canonical-skills'),
    backupsDir: join(userDataRoot, 'backups'),
    profilesDir: join(dirname, '..', 'config', 'profiles'),
    syncConfigPath: join(dirname, '..', 'config', 'sync.json'),
    agentConfigPath: join(dirname, '..', 'config', 'agents.json'),
    approvedSyncRoots: [
      join(dirname, '..', 'config', 'canonical-skills'),
      join(home, '.claude', 'skills'),
      join(home, '.opencode', 'skills'),
      join(home, '.codex', 'skills'),
    ],
  };
}
