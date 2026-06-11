import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asRecord, detectTransport, extractCommand, checkSensitiveEnv } from './shared.js';

test('asRecord returns object for valid input', () => {
  assert.deepEqual(asRecord({ a: 1 }), { a: 1 });
  assert.deepEqual(asRecord(null), {});
  assert.deepEqual(asRecord('string'), {});
  assert.deepEqual(asRecord([1, 2]), {});
});

test('detectTransport identifies stdio', () => {
  assert.equal(detectTransport({ command: 'npx' }), 'stdio');
  assert.equal(detectTransport({ command: ['npx', '-y'] }), 'stdio');
});

test('detectTransport identifies http/sse', () => {
  assert.equal(detectTransport({ url: 'http://localhost:3000' }), 'http');
  assert.equal(detectTransport({ url: 'http://localhost:3000/sse' }), 'sse');
});

test('detectTransport returns unknown for empty', () => {
  assert.equal(detectTransport({}), 'unknown');
});

test('extractCommand gets string command', () => {
  assert.equal(extractCommand({ command: 'npx' }), 'npx');
  assert.equal(extractCommand({ command: ['npx', '-y'] }), 'npx');
  assert.equal(extractCommand({}), undefined);
});

test('checkSensitiveEnv detects sensitive keys', () => {
  assert.equal(checkSensitiveEnv({ env: { API_KEY: 'test' } }), true);
  assert.equal(checkSensitiveEnv({ env: { NORMAL: 'test' } }), false);
  assert.equal(checkSensitiveEnv({}), false);
  assert.equal(checkSensitiveEnv({ environment: { AUTH_TOKEN: 'x' } }), true);
});
