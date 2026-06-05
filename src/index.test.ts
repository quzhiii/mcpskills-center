import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from './cli.js';

test('parseCliArgs parses sync dry-run arguments', () => {
  const parsed = parseCliArgs(['sync', '--dry-run', '--canonical-dir', 'C:/canonical']);

  assert.equal(parsed.command, 'sync');
  assert.equal(parsed.options.dryRun, true);
  assert.equal(parsed.options.canonicalDir, 'C:/canonical');
});

test('parseCliArgs defaults to scan command', () => {
  const parsed = parseCliArgs([]);

  assert.equal(parsed.command, 'scan');
});

test('parseCliArgs parses profile plan command', () => {
  const parsed = parseCliArgs(['profile', 'plan', 'coding']);

  assert.equal(parsed.command, 'profile');
  assert.equal(parsed.options.subcommand, 'plan');
  assert.equal(parsed.options.profileName, 'coding');
});

test('parseCliArgs parses agents list command', () => {
  const parsed = parseCliArgs(['agents', 'list']);

  assert.equal(parsed.command, 'agents');
  assert.equal(parsed.options.subcommand, 'list');
});

test('parseCliArgs parses matrix command', () => {
  const parsed = parseCliArgs(['matrix']);

  assert.equal(parsed.command, 'matrix');
});

test('parseCliArgs parses active health check options', () => {
  const parsed = parseCliArgs(['health', '--active', '--allow-command', 'npx', '--timeout', '2500']);

  assert.equal(parsed.command, 'health');
  assert.equal(parsed.options.active, true);
  assert.deepEqual(parsed.options.allowCommands, ['npx']);
  assert.equal(parsed.options.timeoutMs, 2500);
});

test('parseCliArgs parses sync apply confirmation flags', () => {
  const parsed = parseCliArgs(['sync', '--apply', '--confirm', '--canonical-dir', 'C:/canonical']);

  assert.equal(parsed.command, 'sync');
  assert.equal(parsed.options.apply, true);
  assert.equal(parsed.options.confirm, true);
  assert.equal(parsed.options.canonicalDir, 'C:/canonical');
});

test('parseCliArgs parses sync restore manifest path', () => {
  const parsed = parseCliArgs(['sync', '--restore', 'C:/backups/manifest.json']);

  assert.equal(parsed.command, 'sync');
  assert.equal(parsed.options.restoreManifestPath, 'C:/backups/manifest.json');
});
