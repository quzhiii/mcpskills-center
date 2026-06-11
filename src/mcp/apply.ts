import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  McpApplyPlan,
  McpApplyResult,
  McpApplyReceipt,
  McpApplyAction,
  McpBackupEntry,
  McpBackupManifest,
  ParsedMcpConfigServer,
} from '../types/index.js';
import type { McpConfigAdapter } from './adapters/base.js';
import { parseClaudeCodeMcpConfig, serializeClaudeCodeMcpConfig } from './adapters/claude-code.js';
import { parseOpenCodeMcpConfig, serializeOpenCodeMcpConfig } from './adapters/opencode.js';
import { parseCodexMcpConfig, serializeCodexMcpConfig } from './adapters/codex.js';
import { assertMcpApplyConfirm, assertMcpApplyPathsWithinApprovedRoots, assertMcpWriteBoundaryAllowed } from './safety.js';

export interface ApplyMcpPlanOptions {
  backupsDir: string;
  agentConfigPaths: Record<string, string>;
}

const ADAPTER_MAP: Record<string, McpConfigAdapter> = {
  'claude-code': { parse: parseClaudeCodeMcpConfig, serialize: serializeClaudeCodeMcpConfig },
  'opencode': { parse: parseOpenCodeMcpConfig, serialize: serializeOpenCodeMcpConfig },
  'codex': { parse: parseCodexMcpConfig, serialize: serializeCodexMcpConfig },
};

export async function applyMcpPlan(plan: McpApplyPlan, options: ApplyMcpPlanOptions): Promise<McpApplyResult> {
  assertMcpApplyConfirm(plan.confirm);

  const targets = plan.actions.map(a => ({
    targetConfigPath: options.agentConfigPaths[a.targetAgentName],
  }));
  assertMcpApplyPathsWithinApprovedRoots(targets, plan.approvedRoots);

  const receipts: McpApplyReceipt[] = [];
  const backupEntries: McpBackupEntry[] = [];
  const generatedAt = new Date().toISOString();
  const backupDir = join(options.backupsDir, generatedAt.replace(/[:.]/g, '-'));

  for (const action of plan.actions) {
    const configPath = options.agentConfigPaths[action.targetAgentName];
    assertMcpWriteBoundaryAllowed(action.targetAgentName);

    let existingContent = '';
    try {
      existingContent = await readFile(configPath, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    let backupPath: string | undefined;
    if (existingContent) {
      await mkdir(backupDir, { recursive: true });
      const safeName = `${action.targetAgentName}-${action.mcpId}`.replace(/[^a-zA-Z0-9-]/g, '_');
      backupPath = join(backupDir, `${safeName}.json`);
      await writeFile(backupPath, existingContent, 'utf-8');
      backupEntries.push({
        mcpId: action.mcpId,
        targetAgentName: action.targetAgentName,
        targetConfigPath: configPath,
        backupPath,
        backedUpAt: generatedAt,
      });
    }

    const mergedContent = mergeActionIntoConfig(action, existingContent, action.targetAgentName);
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, mergedContent, 'utf-8');

    receipts.push({
      actionId: action.id,
      type: action.type,
      mcpId: action.mcpId,
      targetAgentName: action.targetAgentName,
      targetConfigPath: configPath,
      backupPath,
      appliedAt: generatedAt,
    });
  }

  const manifestPath = join(backupDir, 'manifest.json');
  const manifest: McpBackupManifest = {
    generatedAt,
    entries: backupEntries,
    sourcePlanGeneratedAt: plan.generatedAt,
  };
  await mkdir(backupDir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return {
    manifestPath,
    appliedActions: plan.actions,
    backupEntries,
    receipts,
  };
}

function mergeActionIntoConfig(action: McpApplyAction, existingContent: string, agentName: string): string {
  const adapter = ADAPTER_MAP[agentName];
  if (!adapter) {
    throw new Error(`No MCP config adapter found for agent: ${agentName}`);
  }

  const servers = adapter.parse(existingContent || '{}');
  const definition = action.canonicalDefinition;

  if (action.type === 'add-server' || action.type === 'update-server') {
    if (!definition) {
      throw new Error(`Action ${action.id} of type ${action.type} requires a canonicalDefinition`);
    }
    const newServer: ParsedMcpConfigServer = {
      id: action.mcpId,
      transport: definition.transport,
      command: definition.command,
      host: definition.host,
      isEnabled: definition.isEnabled,
      hasSensitiveEnv: definition.hasSensitiveEnv,
      scope: definition.scope ?? { kind: 'global' },
    };
    const existingIndex = servers.findIndex(s => s.id === action.mcpId);
    if (existingIndex >= 0) {
      servers[existingIndex] = newServer;
    } else {
      servers.push(newServer);
    }
  } else if (action.type === 'remove-server') {
    const filtered = servers.filter(s => s.id !== action.mcpId);
    return adapter.serialize(filtered, existingContent || undefined);
  } else if (action.type === 'enable-server') {
    const server = servers.find(s => s.id === action.mcpId);
    if (server) server.isEnabled = true;
  } else if (action.type === 'disable-server') {
    const server = servers.find(s => s.id === action.mcpId);
    if (server) server.isEnabled = false;
  }

  return adapter.serialize(servers, existingContent || undefined);
}
