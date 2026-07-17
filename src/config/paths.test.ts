import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from 'node:path';
import { createDefaultPaths, resolveUserDataRoot } from './paths.js';

test('resolveUserDataRoot uses APPDATA on Windows', () => {
  assert.equal(
    resolveUserDataRoot({
      platform: 'win32',
      homeDir: 'C:/Users/test',
      appData: 'C:/Users/test/AppData/Roaming',
    }),
    normalize('C:/Users/test/AppData/Roaming/mcpskills-center'),
  );
});

test('resolveUserDataRoot falls back to the Windows roaming directory', () => {
  assert.equal(
    resolveUserDataRoot({ platform: 'win32', homeDir: 'C:/Users/test' }),
    normalize('C:/Users/test/AppData/Roaming/mcpskills-center'),
  );
});

test('resolveUserDataRoot uses Application Support on macOS', () => {
  assert.equal(
    resolveUserDataRoot({ platform: 'darwin', homeDir: '/Users/test' }),
    normalize('/Users/test/Library/Application Support/mcpskills-center'),
  );
});

test('resolveUserDataRoot uses the Linux data directory', () => {
  assert.equal(
    resolveUserDataRoot({ platform: 'linux', homeDir: '/home/test' }),
    normalize('/home/test/.local/share/mcpskills-center'),
  );
});

test('resolveUserDataRoot honors XDG_DATA_HOME', () => {
  assert.equal(
    resolveUserDataRoot({
      platform: 'linux',
      homeDir: '/home/test',
      xdgDataHome: '/var/app-data/test',
    }),
    normalize('/var/app-data/test/mcpskills-center'),
  );
});

test('createDefaultPaths separates bundled and writable paths', () => {
  const paths = createDefaultPaths('C:/pkg/dist', {
    platform: 'win32',
    homeDir: 'C:/Users/test',
    appData: 'C:/Users/test/AppData/Roaming',
  });

  assert.equal(paths.packageRoot, normalize('C:/pkg'));
  assert.equal(paths.bundledConfigDir, normalize('C:/pkg/config'));
  assert.equal(paths.bundledAgentConfigPath, normalize('C:/pkg/config/agents.json'));
  assert.equal(paths.bundledSyncConfigPath, normalize('C:/pkg/config/sync.json'));
  assert.equal(paths.bundledProfilesDir, normalize('C:/pkg/config/profiles'));
  assert.equal(paths.bundledRoutingPolicyPath, normalize('C:/pkg/config/routing-policy.json'));

  const userRoot = normalize('C:/Users/test/AppData/Roaming/mcpskills-center');
  assert.equal(paths.userDataRoot, userRoot);
  assert.equal(paths.userConfigDir, normalize(`${userRoot}/config`));
  assert.equal(paths.userAgentConfigPath, normalize(`${userRoot}/config/agents.json`));
  assert.equal(paths.userSyncConfigPath, normalize(`${userRoot}/config/sync.json`));
  assert.equal(paths.userProfilesDir, normalize(`${userRoot}/config/profiles`));
  assert.equal(paths.userRoutingPolicyPath, normalize(`${userRoot}/config/routing-policy.json`));
  assert.equal(paths.canonicalSkillsDir, normalize(`${userRoot}/canonical-skills`));
  assert.equal(paths.reportsDir, normalize(`${userRoot}/reports`));
  assert.equal(paths.backupsDir, normalize(`${userRoot}/backups`));
  assert.equal(paths.dataDir, normalize(`${userRoot}/data`));
  assert.equal(paths.governanceDbPath, normalize(`${userRoot}/data/governance.db`));
});

test('default approved roots contain no writable package paths', () => {
  const paths = createDefaultPaths('/opt/mcpskills-center/dist', {
    platform: 'linux',
    homeDir: '/home/test',
  });

  assert.ok(paths.approvedSyncRoots.includes(paths.canonicalSkillsDir));
  assert.equal(paths.approvedSyncRoots.some(path => path.startsWith(paths.packageRoot)), false);
  assert.equal(paths.reportsDir.startsWith(paths.packageRoot), false);
  assert.equal(paths.backupsDir.startsWith(paths.packageRoot), false);
  assert.equal(paths.dataDir.startsWith(paths.packageRoot), false);
  assert.equal(paths.canonicalSkillsDir.startsWith(paths.packageRoot), false);
});
