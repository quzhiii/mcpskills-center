import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { McpAdapterScope, ParsedMcpConfigServer } from './base.js';

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
