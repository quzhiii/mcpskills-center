import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultPaths } from './paths.js';
import { initializeUserConfig, resolveEffectiveConfigPaths } from './user-config.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makePaths() {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-user-config-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const packageModuleDir = join(root, 'package', 'dist');
  return createDefaultPaths(packageModuleDir, {
    platform: 'linux',
    homeDir: join(root, 'home'),
    xdgDataHome: join(root, 'data'),
  });
}

test('resolveEffectiveConfigPaths prefers every existing user source', async () => {
  const paths = await makePaths();
  await mkdir(paths.userProfilesDir, { recursive: true });
  await Promise.all([
    writeFile(paths.userAgentConfigPath, '{}'),
    writeFile(paths.userSyncConfigPath, '{}'),
    writeFile(paths.userRoutingPolicyPath, '{}'),
  ]);

  const effective = await resolveEffectiveConfigPaths(paths);

  assert.deepEqual(effective.agents, { source: 'user', path: paths.userAgentConfigPath });
  assert.deepEqual(effective.sync, { source: 'user', path: paths.userSyncConfigPath });
  assert.deepEqual(effective.profiles, { source: 'user', path: paths.userProfilesDir });
  assert.deepEqual(effective.routingPolicy, { source: 'user', path: paths.userRoutingPolicyPath });
});

test('resolveEffectiveConfigPaths falls back to bundled and generated defaults', async () => {
  const paths = await makePaths();
  await mkdir(paths.bundledProfilesDir, { recursive: true });
  await Promise.all([
    writeFile(paths.bundledAgentConfigPath, '{}'),
    writeFile(paths.bundledRoutingPolicyPath, '{}'),
  ]);

  const effective = await resolveEffectiveConfigPaths(paths);

  assert.deepEqual(effective.agents, { source: 'bundled', path: paths.bundledAgentConfigPath });
  assert.deepEqual(effective.sync, { source: 'default' });
  assert.deepEqual(effective.profiles, { source: 'bundled', path: paths.bundledProfilesDir });
  assert.deepEqual(effective.routingPolicy, { source: 'bundled', path: paths.bundledRoutingPolicyPath });
});

test('resolveEffectiveConfigPaths reports the agent code default when no file exists', async () => {
  const paths = await makePaths();
  await mkdir(paths.bundledProfilesDir, { recursive: true });
  await writeFile(paths.bundledRoutingPolicyPath, '{}');

  const effective = await resolveEffectiveConfigPaths(paths);

  assert.deepEqual(effective.agents, { source: 'default' });
});

test('initializeUserConfig dry-run plans the tree without writing', async () => {
  const paths = await makePaths();
  await createBundledConfig(paths);

  const result = await initializeUserConfig(paths, { dryRun: true, force: false, confirm: false });

  assert.ok(result.entries.some(entry => entry.path === paths.userAgentConfigPath && entry.action === 'create'));
  await assert.rejects(() => access(paths.userDataRoot), { code: 'ENOENT' });
});

test('initializeUserConfig creates config and preserves it on rerun', async () => {
  const paths = await makePaths();
  await createBundledConfig(paths);

  const first = await initializeUserConfig(paths, { dryRun: false, force: false, confirm: false });
  const originalAgents = await readFile(paths.userAgentConfigPath, 'utf-8');
  await writeFile(paths.bundledAgentConfigPath, '{"agents":[]}');
  const second = await initializeUserConfig(paths, { dryRun: false, force: false, confirm: false });

  assert.ok(first.entries.some(entry => entry.action === 'create'));
  assert.ok(second.entries.some(entry => entry.path === paths.userAgentConfigPath && entry.action === 'skip'));
  assert.equal(await readFile(paths.userAgentConfigPath, 'utf-8'), originalAgents);
  await access(paths.canonicalSkillsDir);
});

test('initializeUserConfig requires confirmation before forced overwrite', async () => {
  const paths = await makePaths();
  await createBundledConfig(paths);
  await mkdir(paths.userConfigDir, { recursive: true });
  await writeFile(paths.userAgentConfigPath, 'keep-me');

  await assert.rejects(
    () => initializeUserConfig(paths, { dryRun: false, force: true, confirm: false }),
    /requires --confirm/,
  );
  assert.equal(await readFile(paths.userAgentConfigPath, 'utf-8'), 'keep-me');
});

test('initializeUserConfig overwrites known files but preserves unknown profiles', async () => {
  const paths = await makePaths();
  await createBundledConfig(paths);
  await initializeUserConfig(paths, { dryRun: false, force: false, confirm: false });
  const unknownProfile = join(paths.userProfilesDir, 'custom.json');
  await writeFile(unknownProfile, 'custom');
  await writeFile(paths.bundledAgentConfigPath, '{"agents":[]}');

  const result = await initializeUserConfig(paths, { dryRun: false, force: true, confirm: true });

  assert.equal(await readFile(paths.userAgentConfigPath, 'utf-8'), '{"agents":[]}');
  assert.equal(await readFile(unknownProfile, 'utf-8'), 'custom');
  assert.ok(result.entries.some(entry => entry.path === paths.userAgentConfigPath && entry.action === 'overwrite'));
});

async function createBundledConfig(paths: ReturnType<typeof createDefaultPaths>): Promise<void> {
  await mkdir(paths.bundledProfilesDir, { recursive: true });
  await Promise.all([
    writeFile(paths.bundledAgentConfigPath, '{"agents":[]}'),
    writeFile(paths.bundledRoutingPolicyPath, '{"version":"1","taskCategories":[],"fallbackOrder":[]}'),
    writeFile(join(paths.bundledProfilesDir, 'coding.json'), '{"name":"coding"}'),
  ]);
}
