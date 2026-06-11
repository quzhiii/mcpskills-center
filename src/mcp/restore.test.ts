import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreMcpBackupManifest } from './restore.js';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('restoreMcpBackupManifest copies backup content to original config path', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'mcp-restore-test-'));
  const backupDir = join(tmpDir, 'backups');
  await mkdir(backupDir, { recursive: true });

  const configPath = join(tmpDir, '.claude.json');
  const backupPath = join(backupDir, 'claude-code-filesystem.json');
  const originalContent = JSON.stringify({ mcpServers: { old: { command: 'node' } }, apiKey: 'original' });

  await writeFile(backupPath, originalContent, 'utf-8');

  await writeFile(configPath, JSON.stringify({ mcpServers: { new: { command: 'npx' } } }), 'utf-8');

  const manifestPath = join(backupDir, 'manifest.json');
  const manifest = {
    generatedAt: '2026-01-01T00:00:00Z',
    entries: [{
      mcpId: 'filesystem',
      targetAgentName: 'claude-code',
      targetConfigPath: configPath,
      backupPath,
      backedUpAt: '2026-01-01T00:00:00Z',
    }],
    sourcePlanGeneratedAt: '2026-01-01T00:00:00Z',
  };
  await writeFile(manifestPath, JSON.stringify(manifest), 'utf-8');

  const result = await restoreMcpBackupManifest(manifestPath, {
    approvedRoots: [configPath],
  });

  assert.equal(result.restoredEntries.length, 1);
  const restored = await readFile(configPath, 'utf-8');
  const parsed = JSON.parse(restored);
  assert.equal(parsed.apiKey, 'original');
  assert.ok(parsed.mcpServers.old);
});

test('restoreMcpBackupManifest validates approved roots', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'mcp-restore-test-'));
  const backupPath = join(tmpDir, 'backup.json');
  const configPath = join(tmpDir, '.claude.json');
  await writeFile(backupPath, '{}', 'utf-8');

  const manifestPath = join(tmpDir, 'manifest.json');
  const manifest = {
    generatedAt: '2026-01-01T00:00:00Z',
    entries: [{
      mcpId: 'filesystem',
      targetAgentName: 'claude-code',
      targetConfigPath: configPath,
      backupPath,
      backedUpAt: '2026-01-01T00:00:00Z',
    }],
    sourcePlanGeneratedAt: '2026-01-01T00:00:00Z',
  };
  await writeFile(manifestPath, JSON.stringify(manifest), 'utf-8');

  await assert.rejects(
    () => restoreMcpBackupManifest(manifestPath, { approvedRoots: ['C:/other-root'] }),
    /outside approved roots/
  );
});

test('restoreMcpBackupManifest throws for invalid manifest', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'mcp-restore-test-'));
  const manifestPath = join(tmpDir, 'manifest.json');
  await writeFile(manifestPath, 'not json', 'utf-8');

  await assert.rejects(
    () => restoreMcpBackupManifest(manifestPath, { approvedRoots: [] }),
    /invalid|parse|JSON/i
  );
});
