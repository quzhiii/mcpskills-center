import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';

export function normalizeRoot(root: string): string {
  return resolve(root).toLowerCase().replace(/[/\\]$/, '');
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
