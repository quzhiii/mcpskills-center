import { cp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { SyncBackupManifest } from '../types/index.js';

export interface RestoreSyncBackupResult {
  restoredEntries: SyncBackupManifest['entries'];
}

export interface RestoreSyncBackupOptions {
  approvedRoots: string[];
}

export async function restoreSyncBackupManifest(manifestPath: string, options: RestoreSyncBackupOptions): Promise<RestoreSyncBackupResult> {
  const manifest = await readAndValidateManifest(manifestPath);

  for (const entry of manifest.entries) {
    assertPathWithinApprovedRoots(entry.targetPath, options.approvedRoots);
    await rm(entry.targetPath, { recursive: true, force: true });
    await cp(entry.backupPath, entry.targetPath, { recursive: true, force: true });
  }

  return {
    restoredEntries: manifest.entries,
  };
}

async function readAndValidateManifest(manifestPath: string): Promise<SyncBackupManifest> {
  const content = await readFile(manifestPath, 'utf-8');
  const parsed = JSON.parse(content) as Partial<SyncBackupManifest>;

  if (!parsed || typeof parsed.generatedAt !== 'string' || !Array.isArray(parsed.entries)) {
    throw new Error('Malformed backup manifest');
  }

  for (const entry of parsed.entries) {
    if (!entry || typeof entry.actionId !== 'string' || typeof entry.targetPath !== 'string' || typeof entry.backupPath !== 'string' || typeof entry.capturedAt !== 'string') {
      throw new Error('Malformed backup manifest');
    }
  }

  return parsed as SyncBackupManifest;
}

function assertPathWithinApprovedRoots(path: string, approvedRoots: string[]): void {
  const normalizedPath = resolve(path).toLowerCase();
  const approved = approvedRoots.map(root => resolve(root).toLowerCase().replace(/[\\/]+$/, ''));
  const isApproved = approved.some(root => normalizedPath === root || normalizedPath.startsWith(`${root}\\`) || normalizedPath.startsWith(`${root}/`));

  if (!isApproved) {
    throw new Error(`Restore target path is outside approved roots: ${path}`);
  }
}
