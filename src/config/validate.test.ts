import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultPaths } from './paths.js';
import { validateConfiguration } from './validate.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makeValidConfig() {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-validate-config-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const paths = createDefaultPaths(join(root, 'package', 'dist'), {
    platform: 'linux',
    homeDir: join(root, 'home'),
    xdgDataHome: join(root, 'data'),
  });
  await mkdir(paths.bundledProfilesDir, { recursive: true });
  await Promise.all([
    writeFile(paths.bundledAgentConfigPath, JSON.stringify({
      agents: [{ id: 'agent', scannerType: 'generic', configDir: '~/.agent', skillsDir: '~/.agent/skills' }],
    })),
    writeFile(paths.bundledRoutingPolicyPath, JSON.stringify({
      version: '1', taskCategories: [], fallbackOrder: ['agent'],
    })),
    writeFile(join(paths.bundledProfilesDir, 'valid.json'), JSON.stringify({
      name: 'valid', description: 'Valid', agents: ['agent'], mcpServers: [], skills: [],
    })),
  ]);
  return paths;
}

test('validateConfiguration accepts bundled config and generated sync defaults', async () => {
  const paths = await makeValidConfig();

  const diagnostics = await validateConfiguration(paths, []);

  assert.equal(diagnostics.some(item => item.status === 'error'), false);
  assert.ok(diagnostics.some(item => item.surface === 'sync' && item.status === 'ok'));
  assert.ok(diagnostics.every(item => !item.message.includes('secret-value')));
});

test('validateConfiguration aggregates invalid user config surfaces without exposing content', async () => {
  const paths = await makeValidConfig();
  await mkdir(paths.userProfilesDir, { recursive: true });
  await Promise.all([
    writeFile(paths.userAgentConfigPath, '{"token":"secret-value"}'),
    writeFile(paths.userSyncConfigPath, '{"approvedSyncRoots":[""]}'),
    writeFile(paths.userRoutingPolicyPath, '{"version":"secret-value"}'),
    writeFile(join(paths.userProfilesDir, 'bad.json'), '{"secret-value":true}'),
  ]);

  const diagnostics = await validateConfiguration(paths, []);

  const errorSurfaces = new Set(diagnostics.filter(item => item.status === 'error').map(item => item.surface));
  assert.deepEqual(errorSurfaces, new Set(['agents', 'sync', 'profiles', 'routing']));
  assert.equal(diagnostics.some(item => item.message.includes('secret-value')), false);
});

test('validateConfiguration reports unknown scanner types', async () => {
  const paths = await makeValidConfig();
  await mkdir(paths.userConfigDir, { recursive: true });
  await writeFile(paths.userAgentConfigPath, JSON.stringify({
    agents: [{ id: 'agent', scannerType: 'unknown', configDir: 'agent', skillsDir: 'agent/skills' }],
  }));

  const diagnostics = await validateConfiguration(paths, []);

  assert.ok(diagnostics.some(item => item.id === 'agents.scanner.agent' && item.status === 'error'));
});
