import { runInventory } from './scanner/index.js';
import { writeAllReports } from './dashboard/reporter.js';
import { writeCapabilityMatrixReports } from './matrix/reporter.js';
import { parseCliArgs } from './cli.js';
import { applySyncPlan } from './sync/apply.js';
import { writeSyncPlanReports } from './sync/reporter.js';
import { writeMcpGovernancePlanReports } from './mcp/reporter.js';
import { applyMcpPlan } from './mcp/apply.js';
import { restoreMcpBackupManifest } from './mcp/restore.js';
import { loadProfiles } from './profiles/loader.js';
import { executeCommand } from './cli/commands.js';
import { createDefaultPaths } from './config/paths.js';
import { executeSetupCommand } from './cli/setup-commands.js';
import { resolveEffectiveConfigPaths } from './config/user-config.js';
import { dirname } from 'node:path';
import { loadSyncConfig } from './config/sync.js';
import { restoreSyncBackupManifest } from './sync/restore.js';
import { loadAgentRegistry } from './config/agents.js';
import { DEFAULT_AGENTS } from './scanner/index.js';
import { discoverAgents } from './agents/discovery.js';
import { writeAgentDiscoveryReports } from './agents/reporter.js';
import { openGovernanceDb } from './db/index.js';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
  if (process.argv.slice(2).length === 0) {
    console.log('Usage: mcpskills <command> [options]');
    console.log('Run "mcpskills help" for full usage.');
    return;
  }
  const cli = parseCliArgs(process.argv.slice(2));
  const paths = createDefaultPaths(__dirname);
  const setupOutput = await executeSetupCommand(cli, paths);
  if (setupOutput !== null) {
    console.log(setupOutput);
    return;
  }
  const effective = await resolveEffectiveConfigPaths(paths);
  const syncConfigPath = effective.sync.path ?? paths.userSyncConfigPath;
  const agentConfigPath = effective.agents.path ?? paths.userAgentConfigPath;
  const syncConfig = await loadSyncConfig(syncConfigPath, paths.approvedSyncRoots, {
    baseDir: dirname(syncConfigPath),
    homeDir: paths.homeDir,
  });
  const agentRegistry = await loadAgentRegistry(agentConfigPath, DEFAULT_AGENTS, {
    baseDir: dirname(agentConfigPath),
    homeDir: paths.homeDir,
  });
  const db = openGovernanceDb(paths.governanceDbPath);
  const output = await executeCommand(cli, {
    reportsDir: paths.reportsDir,
    canonicalSkillsDir: paths.canonicalSkillsDir,
    backupsDir: paths.backupsDir,
    profilesDir: effective.profiles.path,
    routingPolicyPath: effective.routingPolicy.path,
    syncConfigPath,
    agentConfigPath,
    approvedSyncRoots: syncConfig.approvedSyncRoots,
    runInventory: () => runInventory(agentRegistry.agents),
    writeAllReports,
    writeSyncPlanReports,
    writeCapabilityMatrixReports,
    writeMcpGovernancePlanReports,
    loadProfiles,
    listAgents: async () => agentRegistry.agents,
    discoverAgents,
    writeAgentDiscoveryReports,
    applySyncPlan,
    restoreSyncBackupManifest,
    applyMcpPlan,
    restoreMcpBackupManifest,
    db,
  });
  console.log(output);
}

main().catch(err => {
  const msg = err.message ?? String(err);
  if (msg.includes('requires --confirm')) {
    console.error(`Error: ${msg}`);
    console.error('Hint: Add --confirm to apply changes.');
  } else if (msg.includes('outside approved roots')) {
    console.error(`Error: ${msg}`);
    console.error('Hint: Check config/sync.json approvedSyncRoots.');
  } else if (msg.includes('not eligible for MCP writes')) {
    console.error(`Error: ${msg}`);
    console.error('Hint: Only claude-code, opencode, and codex support MCP writes.');
  } else if (msg.includes('Usage:')) {
    console.error(msg);
  } else {
    console.error('Error:', msg);
  }
  process.exit(1);
});
