import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function createTempAgentRoot(prefix: string): Promise<{
  root: string;
  skillsDir: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const skillsDir = join(root, 'skills');
  await mkdir(skillsDir, { recursive: true });

  return {
    root,
    skillsDir,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export async function withSuppressedConsoleWarn<T>(fn: () => Promise<T>): Promise<T> {
  const originalWarn = console.warn;
  console.warn = () => undefined;

  try {
    return await fn();
  } finally {
    console.warn = originalWarn;
  }
}
