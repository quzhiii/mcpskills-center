import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonConfig, parseTomlConfig, stripBom } from './parse.js';

test('stripBom removes a leading UTF-8 BOM', () => {
  assert.equal(stripBom('\uFEFF{"ok":true}'), '{"ok":true}');
});

test('parseJsonConfig accepts normal JSON', () => {
  const parsed = parseJsonConfig<{ ok: boolean }>(`{
    "ok": true
  }`);

  assert.equal(parsed.ok, true);
});

test('parseJsonConfig accepts UTF-8 BOM-prefixed JSON', () => {
  const parsed = parseJsonConfig<{ ok: boolean }>('\uFEFF{"ok":true}');

  assert.equal(parsed.ok, true);
});

test('parseJsonConfig throws a useful error for invalid JSON', () => {
  assert.throws(
    () => parseJsonConfig('{bad json'),
    /Could not parse JSON config:/
  );
});

test('parseTomlConfig parses TOML', () => {
  const parsed = parseTomlConfig<{ section: { enabled: boolean } }>('[section]\nenabled = true');

  assert.equal(parsed.section.enabled, true);
});
