import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClaudeCodeMcpConfig } from './claude-code.js';

test('Claude Code adapter parses global and project MCP servers with scope metadata', () => {
  const servers = parseClaudeCodeMcpConfig(
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
    })
  );

  assert.equal(servers.length, 2);
  assert.deepEqual(servers.find(server => server.id === 'global:fetcher'), {
    id: 'global:fetcher',
    transport: 'stdio',
    command: 'npx',
    host: undefined,
    isEnabled: true,
    hasSensitiveEnv: true,
    scope: { kind: 'global' },
  });
  assert.deepEqual(servers.find(server => server.id === 'projectOne:reader'), {
    id: 'projectOne:reader',
    transport: 'sse',
    command: undefined,
    host: 'https://example.com/sse',
    isEnabled: true,
    hasSensitiveEnv: false,
    scope: { kind: 'project', id: 'projectOne' },
  });
});

test('Claude Code adapter treats array-form command values as stdio', () => {
  const servers = parseClaudeCodeMcpConfig(
    JSON.stringify({
      mcpServers: {
        fetcher: { command: ['npx', '-y', '@fetcher/mcp'] },
      },
    })
  );

  assert.equal(servers.length, 1);
  assert.equal(servers[0].id, 'global:fetcher');
  assert.equal(servers[0].transport, 'stdio');
  assert.equal(servers[0].command, 'npx');
});
