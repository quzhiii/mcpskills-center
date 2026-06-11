import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClaudeCodeMcpConfig, serializeClaudeCodeMcpConfig } from './claude-code.js';
import type { ParsedMcpConfigServer } from './base.js';

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

test('serializeClaudeCodeMcpConfig adds a global server to existing config', () => {
  const existing = JSON.stringify({
    mcpServers: { existing: { command: 'node' } },
  });
  const servers: ParsedMcpConfigServer[] = [
    { id: 'global:existing', transport: 'stdio', command: 'node', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
    { id: 'global:newserver', transport: 'stdio', command: 'npx', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
  ];
  const result = serializeClaudeCodeMcpConfig(servers, existing);
  const parsed = JSON.parse(result);
  assert.ok(parsed.mcpServers.existing);
  assert.ok(parsed.mcpServers.newserver);
  assert.equal(parsed.mcpServers.newserver.command, 'npx');
});

test('serializeClaudeCodeMcpConfig adds a project-scoped server', () => {
  const existing = JSON.stringify({});
  const servers: ParsedMcpConfigServer[] = [
    { id: 'myproject:reader', transport: 'stdio', command: 'npx', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'project', id: 'myproject' } },
  ];
  const result = serializeClaudeCodeMcpConfig(servers, existing);
  const parsed = JSON.parse(result);
  assert.ok(parsed.projects.myproject.mcpServers.reader);
});

test('serializeClaudeCodeMcpConfig preserves existing non-MCP config fields', () => {
  const existing = JSON.stringify({
    apiKey: 'test',
    otherSetting: true,
    mcpServers: { old: { command: 'node' } },
  });
  const servers: ParsedMcpConfigServer[] = [
    { id: 'global:old', transport: 'stdio', command: 'node', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
  ];
  const result = serializeClaudeCodeMcpConfig(servers, existing);
  const parsed = JSON.parse(result);
  assert.equal(parsed.apiKey, 'test');
  assert.equal(parsed.otherSetting, true);
});

test('serializeClaudeCodeMcpConfig handles no existing content', () => {
  const servers: ParsedMcpConfigServer[] = [
    { id: 'global:fs', transport: 'stdio', command: 'npx', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
  ];
  const result = serializeClaudeCodeMcpConfig(servers);
  const parsed = JSON.parse(result);
  assert.ok(parsed.mcpServers.fs);
});

test('serializeClaudeCodeMcpConfig preserves global env data', () => {
  const existing = JSON.stringify({
    mcpServers: {
      fetcher: { command: 'npx', env: { API_KEY: 'secret' } },
    },
  });
  const servers = parseClaudeCodeMcpConfig(existing);
  const result = serializeClaudeCodeMcpConfig(servers, existing);
  const parsed = JSON.parse(result);
  assert.deepEqual(parsed.mcpServers.fetcher.env, { API_KEY: 'secret' });
});

test('serializeClaudeCodeMcpConfig preserves project env data', () => {
  const existing = JSON.stringify({
    projects: {
      myproject: {
        mcpServers: {
          reader: { url: 'https://example.com/sse', env: { TOKEN: 'abc' } },
        },
      },
    },
  });
  const servers = parseClaudeCodeMcpConfig(existing);
  const result = serializeClaudeCodeMcpConfig(servers, existing);
  const parsed = JSON.parse(result);
  assert.deepEqual(parsed.projects.myproject.mcpServers.reader.env, { TOKEN: 'abc' });
});
