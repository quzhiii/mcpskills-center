import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenCodeMcpConfig, serializeOpenCodeMcpConfig } from './opencode.js';
import type { ParsedMcpConfigServer } from './base.js';

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

test('serializeOpenCodeMcpConfig adds server under mcp key', () => {
  const existing = JSON.stringify({ mcp: { web: { command: 'node', enabled: true } } });
  const servers: ParsedMcpConfigServer[] = [
    { id: 'web', transport: 'stdio', command: 'node', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
    { id: 'memory', transport: 'stdio', command: 'npx', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
  ];
  const result = serializeOpenCodeMcpConfig(servers, existing);
  const parsed = JSON.parse(result);
  assert.ok(parsed.mcp.web);
  assert.ok(parsed.mcp.memory);
  assert.equal(parsed.mcp.memory.command, 'npx');
});

test('serializeOpenCodeMcpConfig preserves enabled: false', () => {
  const existing = JSON.stringify({});
  const servers: ParsedMcpConfigServer[] = [
    { id: 'disabled-server', transport: 'stdio', command: 'npx', isEnabled: false, hasSensitiveEnv: false, scope: { kind: 'global' } },
  ];
  const result = serializeOpenCodeMcpConfig(servers, existing);
  const parsed = JSON.parse(result);
  assert.equal(parsed.mcp['disabled-server'].enabled, false);
});

test('serializeOpenCodeMcpConfig preserves non-MCP fields', () => {
  const existing = JSON.stringify({ theme: 'dark', mcp: {} });
  const servers: ParsedMcpConfigServer[] = [
    { id: 'fs', transport: 'stdio', command: 'npx', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
  ];
  const result = serializeOpenCodeMcpConfig(servers, existing);
  const parsed = JSON.parse(result);
  assert.equal(parsed.theme, 'dark');
  assert.ok(parsed.mcp.fs);
});

test('serializeOpenCodeMcpConfig handles no existing content', () => {
  const servers: ParsedMcpConfigServer[] = [
    { id: 'fs', transport: 'stdio', command: 'npx', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
  ];
  const result = serializeOpenCodeMcpConfig(servers);
  const parsed = JSON.parse(result);
  assert.ok(parsed.mcp.fs);
});
