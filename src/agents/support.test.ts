import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeAgentSupport, getAgentSupportMap, resolveAgentSupport } from './support.js';

test('describeAgentSupport returns documented support metadata for baseline and research agents', () => {
  assert.deepEqual(describeAgentSupport('claude-code'), {
    currentLevel: 'dedicated read-only plus write-ready workflow support',
    sourceOfTruthConfidence: 'high',
    mcpReadSupport: 'native',
    mcpPlanSupport: 'native',
    mcpApplySupport: 'write-ready',
    mcpRestoreSupport: 'write-ready',
    mcpConfigOwnershipConfidence: 'high',
  });

  assert.deepEqual(describeAgentSupport('opencode'), {
    currentLevel: 'dedicated read-only plus write-ready workflow support',
    sourceOfTruthConfidence: 'high',
    mcpReadSupport: 'native',
    mcpPlanSupport: 'native',
    mcpApplySupport: 'write-ready',
    mcpRestoreSupport: 'write-ready',
    mcpConfigOwnershipConfidence: 'high',
  });

  assert.deepEqual(describeAgentSupport('codex'), {
    currentLevel: 'dedicated read-only plus write-ready workflow support',
    sourceOfTruthConfidence: 'high',
    mcpReadSupport: 'native',
    mcpPlanSupport: 'native',
    mcpApplySupport: 'write-ready',
    mcpRestoreSupport: 'write-ready',
    mcpConfigOwnershipConfidence: 'high',
  });

  assert.deepEqual(describeAgentSupport('trae'), {
    currentLevel: 'dedicated read-only',
    sourceOfTruthConfidence: 'low',
    mcpReadSupport: 'native',
    mcpPlanSupport: 'observe-only',
    mcpApplySupport: 'observe-only',
    mcpRestoreSupport: 'unproven',
    mcpConfigOwnershipConfidence: 'low',
  });

  assert.deepEqual(describeAgentSupport('qoder'), {
    currentLevel: 'generic read-only placeholder',
    sourceOfTruthConfidence: 'low',
    mcpReadSupport: 'native',
    mcpPlanSupport: 'observe-only',
    mcpApplySupport: 'observe-only',
    mcpRestoreSupport: 'unproven',
    mcpConfigOwnershipConfidence: 'low',
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
    mcpReadSupport: 'observe-only',
    mcpPlanSupport: 'observe-only',
    mcpApplySupport: 'observe-only',
    mcpRestoreSupport: 'unproven',
    mcpConfigOwnershipConfidence: 'low',
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
    mcpReadSupport: 'native',
    mcpPlanSupport: 'native',
    mcpApplySupport: 'write-ready',
    mcpRestoreSupport: 'write-ready',
    mcpConfigOwnershipConfidence: 'high',
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
    mcpReadSupport: 'native',
    mcpPlanSupport: 'observe-only',
    mcpApplySupport: 'observe-only',
    mcpRestoreSupport: 'unproven',
    mcpConfigOwnershipConfidence: 'low',
  });
});

test('describeAgentSupport returns MCP readiness fields for baseline agents', () => {
  const cc = describeAgentSupport('claude-code');
  assert.equal(cc.mcpReadSupport, 'native');
  assert.equal(cc.mcpPlanSupport, 'native');
  assert.equal(cc.mcpApplySupport, 'write-ready');
  assert.equal(cc.mcpRestoreSupport, 'write-ready');
  assert.equal(cc.mcpConfigOwnershipConfidence, 'high');

  const oc = describeAgentSupport('opencode');
  assert.equal(oc.mcpReadSupport, 'native');
  assert.equal(oc.mcpPlanSupport, 'native');
  assert.equal(oc.mcpApplySupport, 'write-ready');
  assert.equal(oc.mcpRestoreSupport, 'write-ready');
  assert.equal(oc.mcpConfigOwnershipConfidence, 'high');

  const cx = describeAgentSupport('codex');
  assert.equal(cx.mcpReadSupport, 'native');
  assert.equal(cx.mcpPlanSupport, 'native');
  assert.equal(cx.mcpApplySupport, 'write-ready');
  assert.equal(cx.mcpRestoreSupport, 'write-ready');
  assert.equal(cx.mcpConfigOwnershipConfidence, 'high');
});

test('describeAgentSupport returns conservative MCP readiness for research agents', () => {
  const trae = describeAgentSupport('trae');
  assert.equal(trae.mcpReadSupport, 'native');
  assert.equal(trae.mcpPlanSupport, 'observe-only');
  assert.equal(trae.mcpApplySupport, 'observe-only');
  assert.equal(trae.mcpRestoreSupport, 'unproven');
  assert.equal(trae.mcpConfigOwnershipConfidence, 'low');

  const qoder = describeAgentSupport('qoder');
  assert.equal(qoder.mcpReadSupport, 'native');
  assert.equal(qoder.mcpPlanSupport, 'observe-only');
  assert.equal(qoder.mcpApplySupport, 'observe-only');
  assert.equal(qoder.mcpRestoreSupport, 'unproven');
  assert.equal(qoder.mcpConfigOwnershipConfidence, 'low');
});

test('describeAgentSupport returns safe MCP readiness defaults for unknown agents', () => {
  const unknown = describeAgentSupport('future-agent');
  assert.equal(unknown.mcpReadSupport, 'observe-only');
  assert.equal(unknown.mcpPlanSupport, 'observe-only');
  assert.equal(unknown.mcpApplySupport, 'observe-only');
  assert.equal(unknown.mcpRestoreSupport, 'unproven');
  assert.equal(unknown.mcpConfigOwnershipConfidence, 'low');
});
