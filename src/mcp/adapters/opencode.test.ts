import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenCodeMcpConfig } from './opencode.js';

test('OpenCode adapter parses BOM-prefixed JSON MCP config', () => {
  const servers = parseOpenCodeMcpConfig(
    '\uFEFF' + JSON.stringify({ mcp: { web: { url: 'https://example.com/mcp' } } })
  );

  assert.equal(servers.length, 1);
  assert.deepEqual(servers[0], {
    id: 'web',
    transport: 'http',
    command: undefined,
    host: 'https://example.com/mcp',
    isEnabled: true,
    hasSensitiveEnv: false,
    scope: { kind: 'global' },
  });
});

test('OpenCode adapter parses array-form local command entries', () => {
  const servers = parseOpenCodeMcpConfig(
    JSON.stringify({ mcp: { agentmemory: { type: 'local', command: ['npx', '-y', '@agentmemory/mcp'] } } })
  );

  assert.equal(servers.length, 1);
  assert.equal(servers[0].transport, 'stdio');
  assert.equal(servers[0].command, 'npx');
  assert.deepEqual(servers[0].scope, { kind: 'global' });
});

test('OpenCode adapter detects sensitive env keys', () => {
  const servers = parseOpenCodeMcpConfig(
    JSON.stringify({ mcp: { memory: { command: 'npx', env: { AUTH_TOKEN: 'redacted' } } } })
  );

  assert.equal(servers.length, 1);
  assert.equal(servers[0].hasSensitiveEnv, true);
});

test('OpenCode adapter honors explicitly disabled MCP entries', () => {
  const servers = parseOpenCodeMcpConfig(
    JSON.stringify({ mcp: { memory: { command: 'npx', enabled: false } } })
  );

  assert.equal(servers.length, 1);
  assert.equal(servers[0].isEnabled, false);
});

test('OpenCode adapter detects sensitive environment keys', () => {
  const servers = parseOpenCodeMcpConfig(
    JSON.stringify({ mcp: { memory: { command: 'npx', environment: { API_TOKEN: 'redacted' } } } })
  );

  assert.equal(servers.length, 1);
  assert.equal(servers[0].hasSensitiveEnv, true);
});
