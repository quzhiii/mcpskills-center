import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ClaudeCodeScanner } from './claude-code.js';
import { createTempAgentRoot } from './test-utils.js';
import type { AgentConfig, MCPServer, McpAdapterScope } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

test('Claude Code MCP scanner reads global and project MCP servers', async () => {
  const fixture = await createTempAgentRoot('mcpskills-claude-');
  cleanups.push(fixture.cleanup);

  const mcpConfigFile = join(fixture.root, '.claude.json');
  await writeFile(
    mcpConfigFile,
    JSON.stringify({
      mcpServers: {
        fetcher: { command: 'npx', env: { API_TOKEN: 'redacted' } },
      },
      projects: {
        projectOne: {
          mcpServers: {
            reader: { url: 'https://example.com/sse' },
          },
        },
      },
    }),
    'utf-8'
  );

  const config: AgentConfig = {
    name: 'claude-code',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile,
  };

  const servers = await new ClaudeCodeScanner(config).scanMCP();

  assert.equal(servers.length, 2);
  assert.deepEqual(
    servers.map(server => server.id).sort(),
    ['global:fetcher', 'projectOne:reader']
  );
  assert.equal(servers.find(server => server.id === 'global:fetcher')?.transport, 'stdio');
  assert.equal(servers.find(server => server.id === 'global:fetcher')?.hasSensitiveEnv, true);
  assert.deepEqual(firstDefinitionScope(servers.find(server => server.id === 'global:fetcher')), { kind: 'global' });
  assert.equal(servers.find(server => server.id === 'projectOne:reader')?.transport, 'sse');
  assert.equal(servers.find(server => server.id === 'projectOne:reader')?.host, 'https://example.com/sse');
  assert.deepEqual(firstDefinitionScope(servers.find(server => server.id === 'projectOne:reader')), {
    kind: 'project',
    id: 'projectOne',
  });
});

test('Claude Code MCP scanner returns no servers for missing config file', async () => {
  const fixture = await createTempAgentRoot('mcpskills-claude-missing-');
  cleanups.push(fixture.cleanup);

  const config: AgentConfig = {
    name: 'claude-code',
    configDir: fixture.root,
    skillsDir: fixture.skillsDir,
    mcpConfigFile: join(fixture.root, 'missing.json'),
  };

  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  let servers;
  try {
    servers = await new ClaudeCodeScanner(config).scanMCP();
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(servers, []);
  assert.deepEqual(warnings, []);
});

test('Claude Code MCP scanner warns for malformed existing config', async () => {
  const fixture = await createTempAgentRoot('mcpskills-claude-invalid-');
  cleanups.push(fixture.cleanup);
  const mcpConfigFile = join(fixture.root, 'invalid.json');
  await writeFile(mcpConfigFile, '{invalid');
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try {
    await new ClaudeCodeScanner({
      name: 'claude-code', configDir: fixture.root, skillsDir: fixture.skillsDir, mcpConfigFile,
    }).scanMCP();
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnings.length, 1);
});

function firstDefinitionScope(server: MCPServer | undefined): McpAdapterScope | undefined {
  return server?.definitions?.[0]?.scope;
}
