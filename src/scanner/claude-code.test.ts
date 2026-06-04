import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ClaudeCodeScanner } from './claude-code.js';
import { createTempAgentRoot, withSuppressedConsoleWarn } from './test-utils.js';
import type { AgentConfig } from '../types/index.js';

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
  assert.equal(servers.find(server => server.id === 'projectOne:reader')?.transport, 'sse');
  assert.equal(servers.find(server => server.id === 'projectOne:reader')?.host, 'https://example.com/sse');
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

  const servers = await withSuppressedConsoleWarn(() => new ClaudeCodeScanner(config).scanMCP());

  assert.deepEqual(servers, []);
});
