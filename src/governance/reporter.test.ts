import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeGovernanceReports } from './reporter.js';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('writeGovernanceReports writes combined JSON report', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'governance-report-'));
  const reportsDir = join(tmpDir, 'reports');

  await writeGovernanceReports({
    generatedAt: '2026-06-11T00:00:00Z',
    skills: { totalSkills: 5, syncActions: 3, writeActions: 1 },
    mcp: { totalServers: 10, governanceActions: 8, canonicalCandidates: 2 },
  }, reportsDir);

  const jsonContent = await readFile(join(reportsDir, 'governance-current.json'), 'utf-8');
  const parsed = JSON.parse(jsonContent);
  assert.equal(parsed.skills.totalSkills, 5);
  assert.equal(parsed.mcp.totalServers, 10);
});

test('writeGovernanceReports writes combined Markdown report', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'governance-report-'));
  const reportsDir = join(tmpDir, 'reports');

  await writeGovernanceReports({
    generatedAt: '2026-06-11T00:00:00Z',
    skills: { totalSkills: 5, syncActions: 3, writeActions: 1 },
    mcp: { totalServers: 10, governanceActions: 8, canonicalCandidates: 2 },
  }, reportsDir);

  const mdContent = await readFile(join(reportsDir, 'governance-current.md'), 'utf-8');
  assert.ok(mdContent.includes('Governance Report'));
  assert.ok(mdContent.includes('Skills Sync'));
  assert.ok(mdContent.includes('MCP Governance'));
});
