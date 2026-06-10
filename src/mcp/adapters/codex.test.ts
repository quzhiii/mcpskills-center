import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCodexMcpConfig, serializeCodexMcpConfig } from './codex.js';
import type { ParsedMcpConfigServer } from './base.js';

test('Codex adapter parses TOML mcp_servers', () => {
  const servers = parseCodexMcpConfig(`
[mcp_servers.agentmemory]
command = "npx"

[mcp_servers.agentmemory.env]
SECRET_TOKEN = "redacted"

[mcp_servers.reader]
url = "https://example.com/mcp"
`);

  assert.equal(servers.length, 2);
  assert.deepEqual(servers.find(server => server.id === 'agentmemory'), {
    id: 'agentmemory',
    transport: 'stdio',
    command: 'npx',
    host: undefined,
    isEnabled: true,
    hasSensitiveEnv: true,
    scope: { kind: 'global' },
  });
  assert.deepEqual(servers.find(server => server.id === 'reader'), {
    id: 'reader',
    transport: 'http',
    command: undefined,
    host: 'https://example.com/mcp',
    isEnabled: true,
    hasSensitiveEnv: false,
    scope: { kind: 'global' },
  });
});

test('Codex adapter treats array-form command values as stdio', () => {
  const servers = parseCodexMcpConfig(`
[mcp_servers.agentmemory]
command = ["npx", "-y", "@agentmemory/mcp"]
`);

  assert.equal(servers.length, 1);
  assert.equal(servers[0].transport, 'stdio');
  assert.equal(servers[0].command, 'npx');
});

test('serializeCodexMcpConfig produces valid TOML with mcp_servers', () => {
  const servers: ParsedMcpConfigServer[] = [
    { id: 'filesystem', transport: 'stdio', command: 'npx', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
  ];
  const result = serializeCodexMcpConfig(servers);
  assert.ok(result.includes('[mcp_servers.filesystem]'));
  assert.ok(result.includes('command'));
  assert.ok(result.includes('npx'));
});

test('serializeCodexMcpConfig handles multiple servers', () => {
  const servers: ParsedMcpConfigServer[] = [
    { id: 'fs', transport: 'stdio', command: 'npx', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
    { id: 'web', transport: 'http', host: 'http://localhost:3000', isEnabled: true, hasSensitiveEnv: false, scope: { kind: 'global' } },
  ];
  const result = serializeCodexMcpConfig(servers);
  assert.ok(result.includes('[mcp_servers.fs]'));
  assert.ok(result.includes('[mcp_servers.web]'));
});

test('serializeCodexMcpConfig handles empty server list', () => {
  const result = serializeCodexMcpConfig([]);
  assert.ok(typeof result === 'string');
});
