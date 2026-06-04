import { cp, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SyncAction, SyncBackupEntry, SyncBackupManifest } from '../types/index.js';

export interface BackupResult {
  manifestPath: string;
  entries: SyncBackupEntry[];
}

export async function backupSyncActionTarget(action: SyncAction, backupsDir: string): Promise<BackupResult> {
  const generatedAt = new Date().toISOString();
  const safeTimestamp = generatedAt.replace(/[:.]/g, '-');
  const backupDir = join(backupsDir, safeTimestamp);
  const entry = await createBackupEntry(action, backupDir, generatedAt);

  const manifestPath = join(backupDir, 'manifest.json');
  await writeBackupManifest(manifestPath, [entry], generatedAt);

  return {
    manifestPath,
    entries: [entry],
  };
}

export async function readBackupManifest(manifestPath: string): Promise<SyncBackupManifest> {
  const content = await readFile(manifestPath, 'utf-8');
  return JSON.parse(content) as SyncBackupManifest;
}

export async function createBackupEntry(action: SyncAction, backupDir: string, capturedAt: string): Promise<SyncBackupEntry> {
  if (!action.targetPath) {
    throw new Error(`Sync action ${action.id} has no targetPath to back up`);
  }

  const targetStats = await stat(action.targetPath);
  const targetFileName = action.targetPath.split(/[\\/]/).pop() || 'target';
  const backupPath = join(backupDir, `${sanitizeFileName(action.id)}-${sanitizeFileName(targetFileName)}`);

  await mkdir(dirname(backupPath), { recursive: true });
  if (targetStats.isDirectory()) {
    await cp(action.targetPath, backupPath, { recursive: true });
  } else {
    await copyFile(action.targetPath, backupPath);
  }

  return {
    actionId: action.id,
    targetPath: action.targetPath,
    backupPath,
    capturedAt,
  };
}

export async function writeBackupManifest(
  manifestPath: string,
  entries: SyncBackupEntry[],
  generatedAt: string
): Promise<SyncBackupManifest> {
  const manifest: SyncBackupManifest = {
    generatedAt,
    entries,
  };

  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return manifest;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, '-');
}
