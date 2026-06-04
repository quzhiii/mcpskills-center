import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeAuditMarkdown } from './reporter.js';
import type { AuditReport } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

test('writeAuditMarkdown includes actionable recommendations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-reporter-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const report: AuditReport = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    inventory: {
      generatedAt: '2026-06-03T00:00:00.000Z',
      agents: [],
      skills: [],
      mcpServers: [],
      profiles: [],
    },
    issues: [],
    recommendations: [
      {
        category: 'merge',
        targetType: 'skill',
        targetId: 'duplicate-skill',
        severity: 'warning',
        reason: 'Duplicate skill appears in multiple agents',
        suggestedAction: 'Plan canonical-store consolidation',
        requiresWrite: true,
      },
      {
        category: 'manual-review',
        targetType: 'mcp-server',
        targetId: 'sensitive-mcp',
        severity: 'warning',
        reason: 'Sensitive env names detected',
        suggestedAction: 'Verify secret storage without printing values',
        requiresWrite: false,
      },
    ],
    summary: {
      totalSkills: 0,
      totalMcpServers: 0,
      duplicateSkills: 0,
      duplicateMcps: 0,
      missingSkillMds: 0,
      brokenSymlinks: 0,
      sensitiveEnvs: 0,
    },
  };

  const outPath = join(root, 'audit.md');
  await writeAuditMarkdown(report, outPath);
  const markdown = await readFile(outPath, 'utf-8');

  assert.match(markdown, /## Recommendations/);
  assert.match(markdown, /\| Category \| Target \| Severity \| Requires Write \| Action \|/);
  assert.match(markdown, /\| merge \| skill: duplicate-skill \| warning \| yes \| Plan canonical-store consolidation \|/);
  assert.match(markdown, /\| manual-review \| mcp-server: sensitive-mcp \| warning \| no \| Verify secret storage without printing values \|/);
});
