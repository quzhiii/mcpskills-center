import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCodexMcpConfig } from './codex.js';

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
