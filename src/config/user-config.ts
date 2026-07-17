import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DefaultPaths } from './paths.js';

export type ConfigSource = 'user' | 'bundled' | 'default';

export interface ConfigPathSource {
  source: ConfigSource;
  path?: string;
}

export interface EffectiveConfigPaths {
  agents: ConfigPathSource;
  sync: ConfigPathSource;
  profiles: ConfigPathSource & { path: string };
  routingPolicy: ConfigPathSource & { path: string };
}

export type InitAction = 'create' | 'skip' | 'overwrite';

export interface InitEntry {
  path: string;
  action: InitAction;
}

export interface InitResult {
  dryRun: boolean;
  entries: InitEntry[];
}

export interface InitOptions {
  dryRun: boolean;
  force: boolean;
  confirm: boolean;
}

export async function resolveEffectiveConfigPaths(paths: DefaultPaths): Promise<EffectiveConfigPaths> {
  const [
    userAgents,
    bundledAgents,
    userSync,
    userProfiles,
    userRouting,
  ] = await Promise.all([
    pathExists(paths.userAgentConfigPath),
    pathExists(paths.bundledAgentConfigPath),
    pathExists(paths.userSyncConfigPath),
    pathExists(paths.userProfilesDir),
    pathExists(paths.userRoutingPolicyPath),
  ]);

  return {
    agents: userAgents
      ? { source: 'user', path: paths.userAgentConfigPath }
      : bundledAgents
        ? { source: 'bundled', path: paths.bundledAgentConfigPath }
        : { source: 'default' },
    sync: userSync
      ? { source: 'user', path: paths.userSyncConfigPath }
      : { source: 'default' },
    profiles: userProfiles
      ? { source: 'user', path: paths.userProfilesDir }
      : { source: 'bundled', path: paths.bundledProfilesDir },
    routingPolicy: userRouting
      ? { source: 'user', path: paths.userRoutingPolicyPath }
      : { source: 'bundled', path: paths.bundledRoutingPolicyPath },
  };
}

export async function initializeUserConfig(paths: DefaultPaths, options: InitOptions): Promise<InitResult> {
  if (options.force && !options.confirm && !options.dryRun) {
    throw new Error('init --force requires --confirm before overwriting user configuration');
  }

  const profileEntries = await readdir(paths.bundledProfilesDir, { withFileTypes: true });
  const templates: Array<{ sourcePath?: string; targetPath: string; content?: string }> = [
    { sourcePath: paths.bundledAgentConfigPath, targetPath: paths.userAgentConfigPath },
    {
      targetPath: paths.userSyncConfigPath,
      content: `${JSON.stringify({
        approvedSyncRoots: [
          '../canonical-skills',
          '~/.claude/skills',
          '~/.opencode/skills',
          '~/.codex/skills',
        ],
      }, null, 2)}\n`,
    },
    { sourcePath: paths.bundledRoutingPolicyPath, targetPath: paths.userRoutingPolicyPath },
    ...profileEntries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => ({
        sourcePath: join(paths.bundledProfilesDir, entry.name),
        targetPath: join(paths.userProfilesDir, entry.name),
      })),
  ];

  const entries: InitEntry[] = [];
  for (const template of templates) {
    const exists = await pathExists(template.targetPath);
    entries.push({
      path: template.targetPath,
      action: exists ? options.force ? 'overwrite' : 'skip' : 'create',
    });
  }

  entries.push({
    path: paths.canonicalSkillsDir,
    action: await pathExists(paths.canonicalSkillsDir) ? 'skip' : 'create',
  });

  if (options.dryRun) return { dryRun: true, entries };

  await Promise.all([
    mkdir(paths.userConfigDir, { recursive: true }),
    mkdir(paths.userProfilesDir, { recursive: true }),
    mkdir(paths.canonicalSkillsDir, { recursive: true }),
  ]);

  for (let index = 0; index < templates.length; index++) {
    const entry = entries[index];
    if (entry.action === 'skip') continue;
    const template = templates[index];
    const content = template.content ?? await readFile(template.sourcePath as string);
    await writeFile(template.targetPath, content, entry.action === 'create' ? { flag: 'wx' } : undefined);
  }

  return { dryRun: false, entries };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
