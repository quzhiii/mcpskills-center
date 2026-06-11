import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGovernanceConsoleHtml, writeGovernanceConsole } from './console.js';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('renderGovernanceConsoleHtml produces valid HTML', () => {
  const html = renderGovernanceConsoleHtml({
    generatedAt: '2026-06-11T00:00:00Z',
    skills: { totalSkills: 10, syncActions: 5, writeActions: 2, actionBreakdown: { symlink: 3, 'manual-review': 2 } },
    mcp: { totalServers: 8, governanceActions: 6, canonicalCandidates: 1, manualReview: 0, actionBreakdown: { 'add-mcp': 4, 'remove-mcp': 2 } },
    history: [],
  });
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('Governance Console'));
  assert.ok(html.includes('10'));
  assert.ok(html.includes('8'));
  assert.ok(html.includes('symlink: 3'));
  assert.ok(html.includes('add-mcp: 4'));
});

test('renderGovernanceConsoleHtml renders history entries', () => {
  const html = renderGovernanceConsoleHtml({
    generatedAt: '2026-06-11T00:00:00Z',
    skills: { totalSkills: 0, syncActions: 0, writeActions: 0, actionBreakdown: {} },
    mcp: { totalServers: 0, governanceActions: 0, canonicalCandidates: 0, manualReview: 0, actionBreakdown: {} },
    history: [{ timestamp: '2026-06-11T00:00:00Z', operation: 'apply', domain: 'unified', actionCount: 5, summary: 'Applied 5' }],
  });
  assert.ok(html.includes('Applied 5'));
  assert.ok(html.includes('2026-06-11T00:00:00Z'));
});

test('renderGovernanceConsoleHtml shows empty history message', () => {
  const html = renderGovernanceConsoleHtml({
    generatedAt: '2026-06-11T00:00:00Z',
    skills: { totalSkills: 0, syncActions: 0, writeActions: 0, actionBreakdown: {} },
    mcp: { totalServers: 0, governanceActions: 0, canonicalCandidates: 0, manualReview: 0, actionBreakdown: {} },
    history: [],
  });
  assert.ok(html.includes('No operations recorded yet.'));
});

test('renderGovernanceConsoleHtml escapes HTML in history', () => {
  const html = renderGovernanceConsoleHtml({
    generatedAt: '2026-06-11T00:00:00Z',
    skills: { totalSkills: 0, syncActions: 0, writeActions: 0, actionBreakdown: {} },
    mcp: { totalServers: 0, governanceActions: 0, canonicalCandidates: 0, manualReview: 0, actionBreakdown: {} },
    history: [{ timestamp: '<script>', operation: 'apply', domain: 'unified', actionCount: 1, summary: '<b>xss</b>' }],
  });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('writeGovernanceConsole writes HTML file', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'console-test-'));
  const path = await writeGovernanceConsole({
    generatedAt: '2026-06-11T00:00:00Z',
    skills: { totalSkills: 0, syncActions: 0, writeActions: 0, actionBreakdown: {} },
    mcp: { totalServers: 0, governanceActions: 0, canonicalCandidates: 0, manualReview: 0, actionBreakdown: {} },
    history: [],
  }, tmpDir);
  const content = await readFile(path, 'utf-8');
  assert.ok(content.includes('Governance Console'));
  assert.ok(path.endsWith('governance-console.html'));
});
