import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeAgentDiscoveryReports } from './reporter.js';
import type { AgentDiscoveryReport } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

test('writeAgentDiscoveryReports writes JSON and Markdown reports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-agent-discovery-report-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const report: AgentDiscoveryReport = {
    generatedAt: '2026-06-04T00:00:00.000Z',
    candidates: [
      {
        agentId: 'qoder',
        displayName: 'Qoder',
        status: 'confirmed',
        path: 'C:/Users/example/.qoder',
        reason: 'Found config.json',
      },
      {
        agentId: 'trae',
        displayName: 'Trae',
        status: 'missing',
        path: 'C:/Users/example/.trae',
        reason: 'No known path exists',
      },
    ],
  };

  await writeAgentDiscoveryReports(report, root);

  const json = JSON.parse(await readFile(join(root, 'agent-discovery-current.json'), 'utf-8')) as AgentDiscoveryReport;
  const markdown = await readFile(join(root, 'agent-discovery-current.md'), 'utf-8');

  assert.equal(json.candidates.length, 2);
  assert.match(markdown, /# Agent Discovery Report/);
  assert.match(markdown, /\| qoder \| Qoder \| confirmed \| `C:\/Users\/example\/.qoder` \| Found config.json \|/);
});

test('writeAgentDiscoveryReports renders all ambiguous discovery paths in Markdown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-agent-discovery-ambiguous-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const report: AgentDiscoveryReport = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    candidates: [
      {
        agentId: 'qoder-work',
        displayName: 'Qoder Work',
        status: 'candidate',
        path: 'C:/Users/example/.qoderworkcn',
        paths: ['C:/Users/example/.qoderworkcn', 'C:/Users/example/.qoder-work'],
        reason: 'Multiple known config roots were confirmed; manual review needed',
      },
    ],
  };

  await writeAgentDiscoveryReports(report, root);

  const markdown = await readFile(join(root, 'agent-discovery-current.md'), 'utf-8');

  assert.match(markdown, /`C:\/Users\/example\/.qoderworkcn ; C:\/Users\/example\/.qoder-work`/);
});
