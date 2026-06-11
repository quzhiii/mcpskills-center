import { cp, mkdir, rm, symlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createBackupEntry, writeBackupManifest } from './backup.js';
import { normalizeRoot, pathExists } from '../fs-utils.js';
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
  receipts: SyncApplyReceipt[];
}

export interface SyncApplyReceipt {
  actionId: string;
  type: SyncAction['type'];
  skillId: string;
  targetPath: string;
  backupPath?: string;
  appliedAt: string;
}

export async function applySyncPlan(plan: SyncPlan, options: ApplySyncPlanOptions): Promise<ApplySyncPlanResult> {
  if (!options.confirm) {
    throw new Error('Applying a sync plan requires --confirm');
  }

  const writeActions = getSupportedWriteActions(plan.actions);
  const backupEntries: SyncBackupEntry[] = [];
  const receipts: SyncApplyReceipt[] = [];
  const generatedAt = new Date().toISOString();
  const backupDir = join(options.backupsDir, generatedAt.replace(/[:.]/g, '-'));
  const manifestPath = join(backupDir, 'manifest.json');

  assertUniqueWriteTargets(writeActions);
  for (const action of writeActions) {
    assertActionPathsWithinApprovedRoots(action, options.approvedRoots);
  }

  try {
    for (const action of writeActions) {
      let backupPath: string | undefined;
      if (action.targetPath && await pathExists(action.targetPath)) {
        const backupEntry = await createBackupEntry(action, backupDir, generatedAt);
        backupEntries.push(backupEntry);
        backupPath = backupEntry.backupPath;
      }

      await applyAction(plan, action);
      receipts.push(createReceipt(action, generatedAt, backupPath));
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
    receipts,
  };
}

function getSupportedWriteActions(actions: SyncAction[]): SyncAction[] {
  const writeActions = actions.filter(action => action.requiresWrite);
  const unsupportedAction = writeActions.find(action => !isWriteAction(action.type));
  if (unsupportedAction) {
    throw new Error(`Unsupported sync write action: ${unsupportedAction.type} (${unsupportedAction.id})`);
  }

  return writeActions;
}

function assertUniqueWriteTargets(actions: SyncAction[]): void {
  const seen = new Map<string, SyncAction>();
  for (const action of actions) {
    if (!action.targetPath) continue;
    const normalizedTarget = resolve(action.targetPath).toLowerCase();
    const previous = seen.get(normalizedTarget);
    if (previous) {
      throw new Error(`Ambiguous sync target shared by ${previous.id} and ${action.id}: ${action.targetPath}`);
    }
    seen.set(normalizedTarget, action);
  }
}

function createReceipt(action: SyncAction, appliedAt: string, backupPath: string | undefined): SyncApplyReceipt {
  if (!action.targetPath) {
    throw new Error(`Sync action ${action.id} has no targetPath for receipt`);
  }

  return {
    actionId: action.id,
    type: action.type,
    skillId: action.skillId,
    targetPath: action.targetPath,
    backupPath,
    appliedAt,
  };
}

async function applyAction(plan: SyncPlan, action: SyncAction): Promise<void> {
  if (!action.sourcePath || !action.targetPath) {
    throw new Error(`Sync action ${action.id} is missing sourcePath or targetPath`);
  }

  switch (action.type) {
    case 'promote-canonical':
      await rm(action.targetPath, { recursive: true, force: true });
      await mkdir(dirname(action.targetPath), { recursive: true });
      await cp(action.sourcePath, action.targetPath, { recursive: true });
      return;

    case 'distribute':
      if (action.mode === 'copy') {
        await rm(action.targetPath, { recursive: true, force: true });
        await mkdir(dirname(action.targetPath), { recursive: true });
        await cp(action.sourcePath, action.targetPath, { recursive: true });
        return;
      }
      if (action.mode !== 'symlink') {
        throw new Error(`Sync action ${action.id} is missing a supported distribution mode`);
      }
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

function isWriteAction(type: SyncAction['type']): boolean {
  return type === 'promote-canonical' || type === 'distribute';
}
