import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMcpPlan } from './apply.js';
import type { McpApplyPlan, McpApplyAction } from '../types/index.js';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('applyMcpPlan requires confirm flag', async () => {
  const plan: McpApplyPlan = {
    generatedAt: '2026-01-01T00:00:00Z',
    confirm: false,
    actions: [],
    approvedRoots: [],
  };
  await assert.rejects(
    () => applyMcpPlan(plan, { backupsDir: join(tmpdir(), 'test-backups'), agentConfigPaths: {} }),
    /requires --confirm/
  );
});

test('applyMcpPlan rejects action targeting path outside approved roots', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'mcp-apply-test-'));
  const configPath = join(tmpDir, '.claude.json');
  await writeFile(configPath, JSON.stringify({}), 'utf-8');

  const plan: McpApplyPlan = {
    generatedAt: '2026-01-01T00:00:00Z',
    confirm: true,
    actions: [{
      id: 'a1',
      type: 'add-server',
      mcpId: 'filesystem',
      targetAgentName: 'claude-code',
      canonicalDefinition: { transport: 'stdio', command: 'npx', isEnabled: true, canStart: true, hasSensitiveEnv: false },
      reason: 'test',
      requiresWrite: true,
    }],
    approvedRoots: ['C:/some-other-root'],
  };

  await assert.rejects(
    () => applyMcpPlan(plan, { backupsDir: join(tmpDir, 'backups'), agentConfigPaths: { 'claude-code': configPath } }),
    /outside approved roots/
  );
});

test('applyMcpPlan writes config and returns receipts', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'mcp-apply-test-'));
  const configPath = join(tmpDir, '.claude.json');
  await writeFile(configPath, JSON.stringify({ mcpServers: {} }), 'utf-8');

  const plan: McpApplyPlan = {
    generatedAt: '2026-01-01T00:00:00Z',
    confirm: true,
    actions: [{
      id: 'a1',
      type: 'add-server',
      mcpId: 'filesystem',
      targetAgentName: 'claude-code',
      canonicalDefinition: { transport: 'stdio', command: 'npx @modelcontextprotocol/server-filesystem', isEnabled: true, canStart: true, hasSensitiveEnv: false },
      reason: 'test',
      requiresWrite: true,
    }],
    approvedRoots: [configPath],
  };

  const result = await applyMcpPlan(plan, {
    backupsDir: join(tmpDir, 'backups'),
    agentConfigPaths: { 'claude-code': configPath },
  });

  assert.equal(result.appliedActions.length, 1);
  assert.equal(result.receipts.length, 1);
  assert.ok(result.manifestPath);

  const written = JSON.parse(await readFile(configPath, 'utf-8'));
  assert.ok(written.mcpServers.filesystem);
  assert.equal(written.mcpServers.filesystem.command, 'npx @modelcontextprotocol/server-filesystem');
});

test('applyMcpPlan backs up existing config before writing', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'mcp-apply-test-'));
  const configPath = join(tmpDir, '.claude.json');
  const original = JSON.stringify({ mcpServers: { old: { command: 'node' } }, apiKey: 'test' });
  await writeFile(configPath, original, 'utf-8');

  const plan: McpApplyPlan = {
    generatedAt: '2026-01-01T00:00:00Z',
    confirm: true,
    actions: [{
      id: 'a1',
      type: 'add-server',
      mcpId: 'filesystem',
      targetAgentName: 'claude-code',
      canonicalDefinition: { transport: 'stdio', command: 'npx', isEnabled: true, canStart: true, hasSensitiveEnv: false },
      reason: 'test',
      requiresWrite: true,
    }],
    approvedRoots: [configPath],
  };

  const result = await applyMcpPlan(plan, {
    backupsDir: join(tmpDir, 'backups'),
    agentConfigPaths: { 'claude-code': configPath },
  });

  // Verify backup was created
  assert.equal(result.backupEntries.length, 1);
  const backupContent = await readFile(result.backupEntries[0].backupPath, 'utf-8');
  const backupParsed = JSON.parse(backupContent);
  assert.equal(backupParsed.apiKey, 'test');
  assert.ok(backupParsed.mcpServers.old);
});
