import { readFile, writeFile } from 'node:fs/promises';
import type { McpBackupManifest, McpBackupEntry } from '../types/index.js';
import { assertMcpApplyPathsWithinApprovedRoots } from './safety.js';

export interface RestoreMcpOptions {
  approvedRoots: string[];
}

export interface RestoreMcpResult {
  restoredEntries: McpBackupEntry[];
}

export async function restoreMcpBackupManifest(
  manifestPath: string,
  options: RestoreMcpOptions,
): Promise<RestoreMcpResult> {
  const raw = await readFile(manifestPath, 'utf-8');
  let manifest: McpBackupManifest;
  try {
    manifest = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid MCP backup manifest: ${manifestPath}`);
  }

  if (!manifest.entries || !Array.isArray(manifest.entries)) {
    throw new Error(`Invalid MCP backup manifest: missing entries array`);
  }

  assertMcpApplyPathsWithinApprovedRoots(
    manifest.entries.map(e => ({ targetConfigPath: e.targetConfigPath })),
    options.approvedRoots,
  );

  for (const entry of manifest.entries) {
    const backupContent = await readFile(entry.backupPath, 'utf-8');
    await writeFile(entry.targetConfigPath, backupContent, 'utf-8');
  }

  return { restoredEntries: manifest.entries };
}
