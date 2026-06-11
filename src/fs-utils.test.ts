import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { normalizeRoot, pathExists } from './fs-utils.js';

test('normalizeRoot resolves and lowercases', () => {
  assert.equal(normalizeRoot('C:\\Users\\test'), normalizeRoot('c:\\users\\test'));
});

test('pathExists returns true for existing file', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'fs-test-'));
  const filePath = join(tmpDir, 'test.txt');
  writeFileSync(filePath, 'test');
  assert.equal(await pathExists(filePath), true);
});

test('pathExists returns false for missing file', async () => {
  assert.equal(await pathExists('/nonexistent/path'), false);
});
