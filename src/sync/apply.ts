import { cp, mkdir, rm, stat, symlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createBackupEntry, writeBackupManifest } from './backup.js';
import type { SyncAction, SyncBackupEntry, SyncPlan } from '../types/index.js';

export interface ApplySyncPlanOptions {
  confirm: boolean;
  backupsDir: string;
  approvedRoots: string[];
}

export interface ApplySyncPlanResult {
  manifestPath: string;
  appliedActions: SyncAction[];
  backupEntries: SyncBackupEntry[];
}

export async function applySyncPlan(plan: SyncPlan, options: ApplySyncPlanOptions): Promise<ApplySyncPlanResult> {
  if (!options.confirm) {
    throw new Error('Applying a sync plan requires --confirm');
  }

  const writeActions = plan.actions.filter(action => action.requiresWrite && isWriteAction(action.type));
  const backupEntries: SyncBackupEntry[] = [];
  const generatedAt = new Date().toISOString();
  const backupDir = join(options.backupsDir, generatedAt.replace(/[:.]/g, '-'));
  const manifestPath = join(backupDir, 'manifest.json');

  try {
    for (const action of writeActions) {
      assertActionPathsWithinApprovedRoots(action, options.approvedRoots);

      if (action.targetPath && await pathExists(action.targetPath)) {
        const backupEntry = await createBackupEntry(action, backupDir, generatedAt);
        backupEntries.push(backupEntry);
      }

      await applyAction(plan, action);
    }
  } finally {
    if (backupEntries.length > 0) {
      await writeBackupManifest(manifestPath, backupEntries, generatedAt);
    }
  }

  if (backupEntries.length === 0) {
    await writeBackupManifest(manifestPath, backupEntries, generatedAt);
  }

  return {
    manifestPath,
    appliedActions: writeActions,
    backupEntries,
  };
}

async function applyAction(plan: SyncPlan, action: SyncAction): Promise<void> {
  if (!action.sourcePath || !action.targetPath) {
    throw new Error(`Sync action ${action.id} is missing sourcePath or targetPath`);
  }

  switch (action.type) {
    case 'copy-to-agent':
    case 'copy-to-canonical':
      await rm(action.targetPath, { recursive: true, force: true });
      await mkdir(dirname(action.targetPath), { recursive: true });
      await cp(action.sourcePath, action.targetPath, { recursive: true });
      return;

    case 'link-to-agent':
      if (plan.strategy !== 'symlink') {
        throw new Error(`Sync action ${action.id} requires symlink strategy`);
      }
      await rm(action.targetPath, { recursive: true, force: true });
      await mkdir(dirname(action.targetPath), { recursive: true });
      await symlink(action.sourcePath, action.targetPath, 'junction');
      return;

    default:
      throw new Error(`Unsupported sync action for apply: ${action.type}`);
  }
}

function assertActionPathsWithinApprovedRoots(action: SyncAction, approvedRoots: string[]): void {
  const approved = approvedRoots.map(root => normalizeRoot(root));
  for (const candidate of [action.sourcePath, action.targetPath]) {
    if (!candidate) continue;
    const normalizedCandidate = resolve(candidate).toLowerCase();
    const isApproved = approved.some(root => normalizedCandidate === root || normalizedCandidate.startsWith(`${root}\\`) || normalizedCandidate.startsWith(`${root}/`));
    if (!isApproved) {
      throw new Error(`Sync action ${action.id} targets a path outside approved roots: ${candidate}`);
    }
  }
}

function normalizeRoot(root: string): string {
  return resolve(root).toLowerCase().replace(/[\\/]+$/, '');
}

function isWriteAction(type: SyncAction['type']): boolean {
  return type === 'copy-to-agent' || type === 'copy-to-canonical' || type === 'link-to-agent';
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
