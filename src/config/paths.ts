import { homedir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

export interface RuntimePathEnv {
  platform: NodeJS.Platform;
  homeDir: string;
  appData?: string;
  xdgDataHome?: string;
}

export interface DefaultPaths {
  homeDir: string;
  packageRoot: string;
  bundledConfigDir: string;
  userDataRoot: string;
  userConfigDir: string;
  reportsDir: string;
  backupsDir: string;
  dataDir: string;
  governanceDbPath: string;
  canonicalSkillsDir: string;
  userProfilesDir: string;
  bundledProfilesDir: string;
  userSyncConfigPath: string;
  bundledSyncConfigPath: string;
  userAgentConfigPath: string;
  bundledAgentConfigPath: string;
  userRoutingPolicyPath: string;
  bundledRoutingPolicyPath: string;
  approvedSyncRoots: string[];
}

export function resolveUserDataRoot(env: RuntimePathEnv): string {
  if (env.platform === 'win32') {
    return env.appData
      ? join(env.appData, 'mcpskills-center')
      : join(env.homeDir, 'AppData', 'Roaming', 'mcpskills-center');
  }

  if (env.platform === 'darwin') {
    return join(env.homeDir, 'Library', 'Application Support', 'mcpskills-center');
  }

  return join(env.xdgDataHome ?? join(env.homeDir, '.local', 'share'), 'mcpskills-center');
}

export function createDefaultPaths(
  moduleDir: string,
  runtimeEnv: RuntimePathEnv = {
    platform: process.platform,
    homeDir: homedir(),
    appData: process.env.APPDATA,
    xdgDataHome: process.env.XDG_DATA_HOME,
  },
): DefaultPaths {
  const packageRoot = join(moduleDir, '..');
  const bundledConfigDir = join(packageRoot, 'config');
  const userDataRoot = resolveUserDataRoot(runtimeEnv);
  const userConfigDir = join(userDataRoot, 'config');
  const dataDir = join(userDataRoot, 'data');
  const canonicalSkillsDir = join(userDataRoot, 'canonical-skills');

  return {
    homeDir: runtimeEnv.homeDir,
    packageRoot,
    bundledConfigDir,
    userDataRoot,
    userConfigDir,
    reportsDir: join(userDataRoot, 'reports'),
    backupsDir: join(userDataRoot, 'backups'),
    dataDir,
    governanceDbPath: join(dataDir, 'governance.db'),
    canonicalSkillsDir,
    userProfilesDir: join(userConfigDir, 'profiles'),
    bundledProfilesDir: join(bundledConfigDir, 'profiles'),
    userSyncConfigPath: join(userConfigDir, 'sync.json'),
    bundledSyncConfigPath: join(bundledConfigDir, 'sync.json'),
    userAgentConfigPath: join(userConfigDir, 'agents.json'),
    bundledAgentConfigPath: join(bundledConfigDir, 'agents.json'),
    userRoutingPolicyPath: join(userConfigDir, 'routing-policy.json'),
    bundledRoutingPolicyPath: join(bundledConfigDir, 'routing-policy.json'),
    approvedSyncRoots: [
      canonicalSkillsDir,
      join(runtimeEnv.homeDir, '.claude', 'skills'),
      join(runtimeEnv.homeDir, '.opencode', 'skills'),
      join(runtimeEnv.homeDir, '.codex', 'skills'),
    ],
  };
}
