import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CodexScanner } from './codex.js';
import { createTempAgentRoot, withSuppressedConsoleWarn } from './test-utils.js';
import type { AgentConfig } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

test('Codex MCP scanner reads TOML mcp_servers', async () => {
  const fixture = await createTempAgentRoot('mcpskills-codex-');
  cleanups.push(fixture.cleanup);

  const mcpConfigFile = join(fixture.root, 'config.toml');
  await writeFile(
    mcpConfigFile,
    `
[mcp_servers.agentmemory]
command = "npx"

[mcp_servers.agentmemory.env]
SECRET_TOKEN = "redacted"

[mcp_servers.reader]
url = "https://example.com/mcp"
`,
    'utf-8'
  );

  const config: AgentConfig = {
    name: 'codex',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile,
  };

  const servers = await new CodexScanner(config).scanMCP();

  assert.equal(servers.length, 2);
  assert.equal(servers.find(server => server.id === 'agentmemory')?.transport, 'stdio');
  assert.equal(servers.find(server => server.id === 'agentmemory')?.hasSensitiveEnv, true);
  assert.equal(servers.find(server => server.id === 'reader')?.transport, 'http');
  assert.equal(servers.find(server => server.id === 'reader')?.host, 'https://example.com/mcp');
});

test('Codex MCP scanner returns no servers for missing config file', async () => {
  const fixture = await createTempAgentRoot('mcpskills-codex-missing-');
  cleanups.push(fixture.cleanup);

  const config: AgentConfig = {
    name: 'codex',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile: join(fixture.root, 'missing.toml'),
  };

  const servers = await withSuppressedConsoleWarn(() => new CodexScanner(config).scanMCP());

  assert.deepEqual(servers, []);
});
