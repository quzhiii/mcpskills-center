import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from './cli.js';

test('parseCliArgs parses governance command with --dry-run', () => {
  const args = parseCliArgs(['governance', '--dry-run']);
  assert.equal(args.command, 'governance');
  assert.equal(args.options.dryRun, true);
});

test('parseCliArgs parses governance command with --apply --confirm', () => {
  const args = parseCliArgs(['governance', '--apply', '--confirm']);
  assert.equal(args.command, 'governance');
  assert.equal(args.options.apply, true);
  assert.equal(args.options.confirm, true);
});

test('parseCliArgs parses governance command with --restore', () => {
  const args = parseCliArgs(['governance', '--restore', 'path/to/manifest.json']);
  assert.equal(args.command, 'governance');
  assert.equal(args.options.restoreManifestPath, 'path/to/manifest.json');
});

test('parseCliArgs parses history command', () => {
  const args = parseCliArgs(['history']);
  assert.equal(args.command, 'history');
});
