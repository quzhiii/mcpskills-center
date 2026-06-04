import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMcpHealth,
  runActiveMcpHealth,
  type SpawnLike,
} from './mcp.js';
import type { MCPServer } from '../types/index.js';

function makeMcp(overrides: Partial<MCPServer>): MCPServer {
  return {
    id: 'server',
    agentSources: ['claude-code'],
    transport: 'stdio',
    isDuplicate: false,
    isEnabled: true,
    canStart: null,
    hasSensitiveEnv: false,
    ...overrides,
  };
}

test('evaluateMcpHealth marks stdio server with command as passive warning', () => {
  const result = evaluateMcpHealth(makeMcp({ command: 'npx' }));

  assert.equal(result.mode, 'passive');
  assert.equal(result.status, 'warning');
  assert.equal(result.canStart, null);
  assert.match(result.reasons.join('\n'), /command is configured/);
});

test('evaluateMcpHealth marks http server with valid URL as passive ok', () => {
  const result = evaluateMcpHealth(makeMcp({ transport: 'http', host: 'https://example.com/mcp' }));

  assert.equal(result.status, 'ok');
  assert.equal(result.canStart, true);
});

test('evaluateMcpHealth reports unknown transport and sensitive env risk', () => {
  const result = evaluateMcpHealth(makeMcp({ transport: 'unknown', hasSensitiveEnv: true }));

  assert.equal(result.status, 'error');
  assert.equal(result.canStart, false);
  assert.equal(result.hasSensitiveEnv, true);
  assert.match(result.reasons.join('\n'), /Unknown transport/);
  assert.match(result.reasons.join('\n'), /Sensitive env/);
});

test('runActiveMcpHealth refuses commands outside allowlist', async () => {
  const result = await runActiveMcpHealth(
    makeMcp({ command: 'bad-command' }),
    { allowCommands: ['npx'], timeoutMs: 10 },
    createSpawnLike(0)
  );

  assert.equal(result.mode, 'active');
  assert.equal(result.status, 'error');
  assert.equal(result.canStart, false);
  assert.match(result.reasons.join('\n'), /not in active health check allowlist/);
});

test('runActiveMcpHealth uses spawn-like command runner for allowlisted commands', async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const result = await runActiveMcpHealth(
    makeMcp({ command: 'npx' }),
    { allowCommands: ['npx'], timeoutMs: 100 },
    createSpawnLike(0, calls)
  );

  assert.equal(result.status, 'ok');
  assert.equal(result.canStart, true);
  assert.deepEqual(calls, [{ command: 'npx', args: ['--version'] }]);
});

test('runActiveMcpHealth fails allowlisted commands that exit non-zero', async () => {
  const result = await runActiveMcpHealth(
    makeMcp({ command: 'npx' }),
    { allowCommands: ['npx'], timeoutMs: 100 },
    createSpawnLike(2)
  );

  assert.equal(result.status, 'error');
  assert.equal(result.canStart, false);
  assert.match(result.reasons.join('\n'), /exited with code 2/);
});

function createSpawnLike(exitCode: number, calls: Array<{ command: string; args: string[] }> = []): SpawnLike {
  return (command, args) => {
    calls.push({ command, args });
    const child = new EventEmitter() as EventEmitter & { kill: () => void };
    child.kill = () => undefined;
    setTimeout(() => child.emit('close', exitCode), 0);
    return child;
  };
}
