import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { parseJsonConfig } from './parse.js';

export interface SyncConfig {
  approvedSyncRoots: string[];
}

export async function loadSyncConfig(configPath: string, defaultApprovedSyncRoots: string[]): Promise<SyncConfig> {
  try {
    const parsed = parseJsonConfig<Partial<SyncConfig>>(await readFile(configPath, 'utf-8'));
    const config = validateSyncConfig(parsed);
    const projectRoot = dirname(dirname(configPath));
    return {
      approvedSyncRoots: config.approvedSyncRoots.map(root => isAbsolute(root) ? root : resolve(projectRoot, root)),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { approvedSyncRoots: defaultApprovedSyncRoots };
    }

    throw err;
  }
}

function validateSyncConfig(value: Partial<SyncConfig>): SyncConfig {
  if (!Array.isArray(value.approvedSyncRoots) || !value.approvedSyncRoots.every(item => typeof item === 'string')) {
    throw new Error('Sync config approvedSyncRoots must be an array of strings');
  }

  return {
    approvedSyncRoots: value.approvedSyncRoots,
  };
}
