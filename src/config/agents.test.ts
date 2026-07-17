import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadAgentRegistry } from './agents.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-agent-config-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('loadAgentRegistry reads enabled agents and expands home paths', async () => {
  const root = await makeTempRoot();
  const configDir = join(root, 'config');
  const configPath = join(configDir, 'agents.json');

  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify({
    agents: [
      {
        id: 'claude-code',
        displayName: 'Claude Code',
        vendor: 'Anthropic',
        scannerType: 'claude-code',
        enabled: true,
        readOnly: false,
        configDir: '~/.claude',
        skillsDir: '~/.claude/skills',
        mcpConfigFile: '~/.claude.json',
      },
      {
        id: 'disabled-agent',
        displayName: 'Disabled Agent',
        vendor: 'Example',
        scannerType: 'generic',
        enabled: false,
        readOnly: true,
        configDir: 'disabled/config',
        skillsDir: 'disabled/skills',
      },
    ],
  }), 'utf-8');

  const registry = await loadAgentRegistry(configPath, []);

  assert.equal(registry.agents.length, 1);
  assert.equal(registry.agents[0].name, 'claude-code');
  assert.equal(registry.agents[0].id, 'claude-code');
  assert.equal(registry.agents[0].displayName, 'Claude Code');
  assert.equal(registry.agents[0].scannerType, 'claude-code');
  assert.equal(registry.agents[0].readOnly, false);
  assert.equal(registry.agents[0].configDir, join(homedir(), '.claude'));
  assert.equal(registry.agents[0].skillsDir, join(homedir(), '.claude', 'skills'));
  assert.equal(registry.agents[0].mcpConfigFile, join(homedir(), '.claude.json'));
});

test('loadAgentRegistry resolves relative paths from project root', async () => {
  const root = await makeTempRoot();
  const configDir = join(root, 'config');
  const configPath = join(configDir, 'agents.json');

  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify({
    agents: [
      {
        id: 'generic-agent',
        displayName: 'Generic Agent',
        scannerType: 'generic',
        enabled: true,
        readOnly: true,
        configDir: 'fixtures/agent/config',
        skillsDir: 'fixtures/agent/skills',
        mcpConfigFile: 'fixtures/agent/mcp.json',
      },
    ],
  }), 'utf-8');

  const registry = await loadAgentRegistry(configPath, []);

  assert.equal(registry.agents[0].configDir, resolve(root, 'fixtures/agent/config'));
  assert.equal(registry.agents[0].skillsDir, resolve(root, 'fixtures/agent/skills'));
  assert.equal(registry.agents[0].mcpConfigFile, resolve(root, 'fixtures/agent/mcp.json'));
});

test('loadAgentRegistry falls back to default agents when config file is missing', async () => {
  const root = await makeTempRoot();
  const configPath = join(root, 'config', 'agents.json');

  const registry = await loadAgentRegistry(configPath, [
    { name: 'claude-code', configDir: 'C:/claude', skillsDir: 'C:/claude/skills' },
  ]);

  assert.deepEqual(registry.agents, [
    { name: 'claude-code', configDir: 'C:/claude', skillsDir: 'C:/claude/skills' },
  ]);
});

test('loadAgentRegistry rejects invalid agents config', async () => {
  const root = await makeTempRoot();
  const configDir = join(root, 'config');
  const configPath = join(configDir, 'agents.json');

  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify({ agents: [{ id: 'missing-paths' }] }), 'utf-8');

  await assert.rejects(
    () => loadAgentRegistry(configPath, []),
    /Agent registry entry must include id, scannerType, configDir, and skillsDir/
  );
});

test('loadAgentRegistry expands home paths with the injected home directory', async () => {
  const root = await makeTempRoot();
  const configPath = join(root, 'config', 'agents.json');
  await mkdir(join(root, 'config'), { recursive: true });
  await writeFile(configPath, JSON.stringify({
    agents: [{
      id: 'custom',
      scannerType: 'generic',
      configDir: '~/.custom',
      skillsDir: '~/.custom/skills',
    }],
  }));

  const registry = await loadAgentRegistry(configPath, [], {
    baseDir: root,
    homeDir: join(root, 'injected-home'),
  });

  assert.equal(registry.agents[0].configDir, join(root, 'injected-home', '.custom'));
});

test('loadAgentRegistry rejects empty and duplicate agent ids', async () => {
  const root = await makeTempRoot();
  const configPath = join(root, 'config', 'agents.json');
  await mkdir(join(root, 'config'), { recursive: true });
  await writeFile(configPath, JSON.stringify({
    agents: [
      { id: 'same', scannerType: 'generic', configDir: 'one', skillsDir: 'one/skills' },
      { id: 'same', scannerType: 'generic', configDir: 'two', skillsDir: 'two/skills' },
    ],
  }));

  await assert.rejects(() => loadAgentRegistry(configPath, []), /duplicate agent id: same/i);
});
