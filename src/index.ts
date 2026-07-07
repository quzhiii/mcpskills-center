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
import { createDefaultPaths, executeCommand } from './cli/commands.js';
import { loadSyncConfig } from './config/sync.js';
import { restoreSyncBackupManifest } from './sync/restore.js';
import { loadAgentRegistry } from './config/agents.js';
import { DEFAULT_AGENTS } from './scanner/index.js';
import { discoverAgents } from './agents/discovery.js';
import { writeAgentDiscoveryReports } from './agents/reporter.js';
import { openGovernanceDb } from './db/index.js';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
  if (process.argv.slice(2).length === 0) {
    console.log('Usage: mcpskills <command> [options]');
    console.log('Run "mcpskills help" for full usage.');
    return;
  }
  const cli = parseCliArgs(process.argv.slice(2));
  const paths = createDefaultPaths(__dirname);
  const syncConfig = await loadSyncConfig(paths.syncConfigPath, paths.approvedSyncRoots);
  const agentRegistry = await loadAgentRegistry(paths.agentConfigPath, DEFAULT_AGENTS);
  const runtimeDataRoot = join(paths.reportsDir, '..');
  const dbPath = join(runtimeDataRoot, 'data', 'governance.db');
  const db = openGovernanceDb(dbPath);
  const output = await executeCommand(cli, {
    ...paths,
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
