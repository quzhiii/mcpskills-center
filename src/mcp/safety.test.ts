import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertMcpApplyPathsWithinApprovedRoots, assertMcpApplyConfirm } from './safety.js';

test('assertMcpApplyPathsWithinApprovedRoots throws for path outside approved roots', () => {
  assert.throws(
    () => assertMcpApplyPathsWithinApprovedRoots(
      [{ targetConfigPath: 'C:/evil/path.json' }],
      ['C:/Users/quzhi/.claude.json']
    ),
    /outside approved roots/
  );
});

test('assertMcpApplyPathsWithinApprovedRoots passes for path inside approved roots', () => {
  assert.doesNotThrow(
    () => assertMcpApplyPathsWithinApprovedRoots(
      [{ targetConfigPath: 'C:/Users/quzhi/.claude.json' }],
      ['C:/Users/quzhi/.claude.json']
    )
  );
});

test('assertMcpApplyConfirm throws when confirm is false', () => {
  assert.throws(
    () => assertMcpApplyConfirm(false),
    /requires --confirm/
  );
});

test('assertMcpApplyConfirm passes when confirm is true', () => {
  assert.doesNotThrow(() => assertMcpApplyConfirm(true));
});
