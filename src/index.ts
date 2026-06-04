import { runInventory } from './scanner/index.js';
import { writeAllReports } from './dashboard/reporter.js';
import { parseCliArgs } from './cli.js';
import { applySyncPlan } from './sync/apply.js';
import { writeSyncPlanReports } from './sync/reporter.js';
import { loadProfiles } from './profiles/loader.js';
import { createDefaultPaths, executeCommand } from './cli/commands.js';
import { loadSyncConfig } from './config/sync.js';
import { restoreSyncBackupManifest } from './sync/restore.js';
import { loadAgentRegistry } from './config/agents.js';
import { DEFAULT_AGENTS } from './scanner/index.js';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const paths = createDefaultPaths(__dirname);
  const syncConfig = await loadSyncConfig(paths.syncConfigPath, paths.approvedSyncRoots);
  const agentRegistry = await loadAgentRegistry(paths.agentConfigPath, DEFAULT_AGENTS);
  const output = await executeCommand(cli, {
    ...paths,
    approvedSyncRoots: syncConfig.approvedSyncRoots,
    runInventory: () => runInventory(agentRegistry.agents),
    writeAllReports,
    writeSyncPlanReports,
    loadProfiles,
    listAgents: async () => agentRegistry.agents,
    applySyncPlan,
    restoreSyncBackupManifest,
  });
  console.log(output);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
