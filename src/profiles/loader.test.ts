import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProfiles, validateProfile } from './loader.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function createProfilesDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-profiles-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const profilesDir = join(root, 'profiles');
  await mkdir(profilesDir, { recursive: true });
  return profilesDir;
}

test('validateProfile accepts a complete profile', () => {
  const profile = validateProfile({
    name: 'coding',
    description: 'Coding profile',
    agents: ['claude-code', 'opencode'],
    mcpServers: ['agentmemory'],
    skills: ['test-driven-development'],
    disabledMcpServers: ['unused-server'],
  });

  assert.equal(profile.name, 'coding');
  assert.deepEqual(profile.agents, ['claude-code', 'opencode']);
  assert.deepEqual(profile.disabledMcpServers, ['unused-server']);
});

test('validateProfile rejects malformed profiles with readable errors', () => {
  assert.throws(
    () => validateProfile({ name: 'broken', description: '', agents: [], mcpServers: [], skills: [] }),
    /Profile description must be a non-empty string/
  );
});

test('loadProfiles reads JSON profiles sorted by name', async () => {
  const profilesDir = await createProfilesDir();
  await writeFile(
    join(profilesDir, 'research.json'),
    JSON.stringify({
      name: 'research',
      description: 'Research profile',
      agents: ['claude-code'],
      mcpServers: ['web-search-prime'],
      skills: ['research-superpower'],
    }),
    'utf-8'
  );
  await writeFile(
    join(profilesDir, 'coding.json'),
    JSON.stringify({
      name: 'coding',
      description: 'Coding profile',
      agents: ['claude-code'],
      mcpServers: ['agentmemory'],
      skills: ['test-driven-development'],
    }),
    'utf-8'
  );

  const profiles = await loadProfiles(profilesDir);

  assert.deepEqual(profiles.map(profile => profile.name), ['coding', 'research']);
});
