import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parseJsonConfig } from './parse.js';

export interface SyncConfig {
  approvedSyncRoots: string[];
}

export interface SyncConfigPathOptions {
  baseDir?: string;
  homeDir?: string;
}

export async function loadSyncConfig(
  configPath: string,
  defaultApprovedSyncRoots: string[],
  options: SyncConfigPathOptions = {},
): Promise<SyncConfig> {
  try {
    const parsed = parseJsonConfig<Partial<SyncConfig>>(await readFile(configPath, 'utf-8'));
    const config = validateSyncConfig(parsed);
    const baseDir = options.baseDir ?? dirname(dirname(configPath));
    const homeDir = options.homeDir ?? homedir();
    return {
      approvedSyncRoots: [...new Set(config.approvedSyncRoots.map(root => resolveConfigPath(root, baseDir, homeDir)))],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { approvedSyncRoots: defaultApprovedSyncRoots };
    }

    throw err;
  }
}

export function validateSyncConfig(value: Partial<SyncConfig>): SyncConfig {
  if (!Array.isArray(value.approvedSyncRoots) || !value.approvedSyncRoots.every(item => typeof item === 'string' && item.trim().length > 0)) {
    throw new Error('Sync config approvedSyncRoots must be an array of non-empty strings');
  }

  return {
    approvedSyncRoots: value.approvedSyncRoots,
  };
}

function resolveConfigPath(value: string, baseDir: string, homeDir: string): string {
  if (value === '~') return homeDir;
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return resolve(homeDir, value.slice(2));
  }

  return isAbsolute(value) ? value : resolve(baseDir, value);
}
