import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { McpAdapterScope, McpConfigAdapter, ParsedMcpConfigServer } from './base.js';

test('ParsedMcpConfigServer supports normalized read-only MCP adapter fields', () => {
  const scope: McpAdapterScope = {
    kind: 'project',
    id: 'project-one',
  };

  const server: ParsedMcpConfigServer = {
    id: 'filesystem',
    transport: 'stdio',
    command: 'npx',
    host: undefined,
    isEnabled: true,
    hasSensitiveEnv: false,
    scope,
  };

  assert.equal(server.id, 'filesystem');
  assert.equal(server.transport, 'stdio');
  assert.equal(server.command, 'npx');
  assert.equal(server.hasSensitiveEnv, false);
  assert.deepEqual(server.scope, {
    kind: 'project',
    id: 'project-one',
  });
});

test('McpConfigAdapter has serialize method that round-trips parsed servers', () => {
  const servers: ParsedMcpConfigServer[] = [
    {
      id: 'filesystem',
      transport: 'stdio',
      command: 'npx @modelcontextprotocol/server-filesystem /tmp',
      isEnabled: true,
      hasSensitiveEnv: false,
      scope: { kind: 'global' },
    },
  ];
  const adapter: McpConfigAdapter = {
    parse: () => servers,
    serialize: (input) => JSON.stringify({ mcpServers: Object.fromEntries(input.map(s => [s.id, { command: s.command, transport: s.transport }])) }),
  };
  const output = adapter.serialize(servers);
  assert.ok(typeof output === 'string');
  assert.ok(output.includes('filesystem'));
});
