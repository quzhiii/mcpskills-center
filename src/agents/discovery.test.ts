import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverAgents } from './discovery.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-agent-discovery-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('discoverAgents marks confirmed, candidate, and missing agent paths without writing', async () => {
  const root = await makeTempRoot();
  const qoderRoot = join(root, '.qoder');
  const traeRoot = join(root, '.trae');

  await mkdir(qoderRoot, { recursive: true });
  await writeFile(join(qoderRoot, 'config.json'), '{}', 'utf-8');
  await mkdir(traeRoot, { recursive: true });

  const report = await discoverAgents({
    generatedAt: '2026-06-04T00:00:00.000Z',
    roots: [root],
    specs: [
      { agentId: 'qoder', displayName: 'Qoder', relativePaths: ['.qoder'], confirmFiles: ['config.json'] },
      { agentId: 'trae', displayName: 'Trae', relativePaths: ['.trae'], confirmFiles: ['config.json'] },
      { agentId: 'codebuddy', displayName: 'CodeBuddy', relativePaths: ['.codebuddy'], confirmFiles: ['config.json'] },
    ],
  });

  assert.equal(report.candidates.length, 3);
  assert.equal(report.candidates.find(candidate => candidate.agentId === 'qoder')?.status, 'confirmed');
  assert.equal(report.candidates.find(candidate => candidate.agentId === 'trae')?.status, 'candidate');
  assert.equal(report.candidates.find(candidate => candidate.agentId === 'codebuddy')?.status, 'missing');
});
