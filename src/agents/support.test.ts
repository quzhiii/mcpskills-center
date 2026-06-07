import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeAgentSupport, getAgentSupportMap, resolveAgentSupport } from './support.js';

test('describeAgentSupport returns documented support metadata for baseline and research agents', () => {
  assert.deepEqual(describeAgentSupport('claude-code'), {
    currentLevel: 'dedicated read-only plus write-ready workflow support',
    sourceOfTruthConfidence: 'high',
  });

  assert.deepEqual(describeAgentSupport('opencode'), {
    currentLevel: 'dedicated read-only plus write-ready workflow support',
    sourceOfTruthConfidence: 'high',
  });

  assert.deepEqual(describeAgentSupport('codex'), {
    currentLevel: 'dedicated read-only plus write-ready workflow support',
    sourceOfTruthConfidence: 'high',
  });

  assert.deepEqual(describeAgentSupport('trae'), {
    currentLevel: 'dedicated read-only',
    sourceOfTruthConfidence: 'low',
  });

  assert.deepEqual(describeAgentSupport('qoder'), {
    currentLevel: 'generic read-only placeholder',
    sourceOfTruthConfidence: 'low',
  });
});

test('getAgentSupportMap includes known supported agents', () => {
  const supportMap = getAgentSupportMap();

  assert.equal(supportMap.get('codebuddy')?.currentLevel, 'dedicated read-only');
  assert.equal(supportMap.get('workbuddy')?.sourceOfTruthConfidence, 'medium');
  assert.equal(supportMap.get('qoder-work')?.currentLevel, 'generic read-only placeholder');
  assert.equal(supportMap.size, 8);
});

test('describeAgentSupport returns undocumented fallback for unknown agents', () => {
  assert.deepEqual(describeAgentSupport('future-agent'), {
    currentLevel: 'undocumented/unknown',
    sourceOfTruthConfidence: 'low',
  });
});

test('support metadata accessors return defensive copies', () => {
  const described = describeAgentSupport('claude-code');
  described.currentLevel = 'mutated';

  assert.equal(describeAgentSupport('claude-code').currentLevel, 'dedicated read-only plus write-ready workflow support');

  const supportMap = getAgentSupportMap();
  const mapped = supportMap.get('claude-code');
  assert.ok(mapped);
  mapped.currentLevel = 'mutated-again';

  assert.equal(describeAgentSupport('claude-code').currentLevel, 'dedicated read-only plus write-ready workflow support');
});

test('resolveAgentSupport prefers scannerType over custom id', () => {
  assert.deepEqual(resolveAgentSupport({
    id: 'custom-claude-install',
    scannerType: 'claude-code',
    name: 'custom-claude-install',
  }), {
    currentLevel: 'dedicated read-only plus write-ready workflow support',
    sourceOfTruthConfidence: 'high',
  });
});

test('resolveAgentSupport prefers known agent id over generic scanner type', () => {
  assert.deepEqual(resolveAgentSupport({
    id: 'qoder',
    scannerType: 'generic',
    name: 'qoder',
  }), {
    currentLevel: 'generic read-only placeholder',
    sourceOfTruthConfidence: 'low',
  });
});
