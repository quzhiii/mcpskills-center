import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OpenCodeScanner } from './opencode.js';
import { createTempAgentRoot, withSuppressedConsoleWarn } from './test-utils.js';
import type { AgentConfig } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

test('OpenCode MCP scanner reads UTF-8 BOM-prefixed JSON config', async () => {
  const fixture = await createTempAgentRoot('mcpskills-opencode-');
  cleanups.push(fixture.cleanup);

  const mcpConfigFile = join(fixture.root, 'opencode.json');
  await writeFile(
    mcpConfigFile,
    '\uFEFF' + JSON.stringify({ mcp: { web: { url: 'https://example.com/mcp' } } }),
    'utf-8'
  );

  const config: AgentConfig = {
    name: 'opencode',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile,
  };

  const servers = await new OpenCodeScanner(config).scanMCP();

  assert.equal(servers.length, 1);
  assert.equal(servers[0].id, 'web');
  assert.equal(servers[0].transport, 'http');
  assert.equal(servers[0].host, 'https://example.com/mcp');
});

test('OpenCode MCP scanner detects sensitive env keys', async () => {
  const fixture = await createTempAgentRoot('mcpskills-opencode-sensitive-');
  cleanups.push(fixture.cleanup);

  const mcpConfigFile = join(fixture.root, 'opencode.json');
  await writeFile(
    mcpConfigFile,
    JSON.stringify({ mcp: { memory: { command: 'npx', env: { AUTH_TOKEN: 'redacted' } } } }),
    'utf-8'
  );

  const config: AgentConfig = {
    name: 'opencode',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile,
  };

  const servers = await new OpenCodeScanner(config).scanMCP();

  assert.equal(servers.length, 1);
  assert.equal(servers[0].transport, 'stdio');
  assert.equal(servers[0].hasSensitiveEnv, true);
});

test('OpenCode MCP scanner reads array-form local commands', async () => {
  const fixture = await createTempAgentRoot('mcpskills-opencode-array-command-');
  cleanups.push(fixture.cleanup);

  const mcpConfigFile = join(fixture.root, 'opencode.json');
  await writeFile(
    mcpConfigFile,
    JSON.stringify({ mcp: { agentmemory: { type: 'local', command: ['npx', '-y', '@agentmemory/mcp'] } } }),
    'utf-8'
  );

  const config: AgentConfig = {
    name: 'opencode',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile,
  };

  const servers = await new OpenCodeScanner(config).scanMCP();

  assert.equal(servers.length, 1);
  assert.equal(servers[0].transport, 'stdio');
  assert.equal(servers[0].command, 'npx');
});

test('OpenCode MCP scanner returns no servers for missing config file', async () => {
  const fixture = await createTempAgentRoot('mcpskills-opencode-missing-');
  cleanups.push(fixture.cleanup);

  const config: AgentConfig = {
    name: 'opencode',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile: join(fixture.root, 'missing.json'),
  };

  const servers = await withSuppressedConsoleWarn(() => new OpenCodeScanner(config).scanMCP());

  assert.deepEqual(servers, []);
});
