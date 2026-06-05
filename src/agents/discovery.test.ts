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

test('discoverAgents confirms qoder-work from observed qoderworkcn root', async () => {
  const root = await makeTempRoot();
  const qoderWorkRoot = join(root, '.qoderworkcn');

  await mkdir(qoderWorkRoot, { recursive: true });
  await writeFile(join(qoderWorkRoot, '.qoder.json'), '{}', 'utf-8');

  const report = await discoverAgents({
    generatedAt: '2026-06-06T00:00:00.000Z',
    roots: [root],
  });

  const candidate = report.candidates.find(item => item.agentId === 'qoder-work');

  assert.equal(candidate?.status, 'confirmed');
  assert.equal(candidate?.path, qoderWorkRoot);
  assert.equal(candidate?.reason, 'Found .qoder.json');
});

test('discoverAgents continues past unconfirmed qoderworkcn root to confirmed legacy qoder-work root', async () => {
  const root = await makeTempRoot();
  const qoderWorkCnRoot = join(root, '.qoderworkcn');
  const legacyQoderWorkRoot = join(root, '.qoder-work');

  await mkdir(qoderWorkCnRoot, { recursive: true });
  await mkdir(legacyQoderWorkRoot, { recursive: true });
  await writeFile(join(legacyQoderWorkRoot, 'config.json'), '{}', 'utf-8');

  const report = await discoverAgents({
    generatedAt: '2026-06-06T00:00:00.000Z',
    roots: [root],
  });

  const candidate = report.candidates.find(item => item.agentId === 'qoder-work');

  assert.equal(candidate?.status, 'confirmed');
  assert.equal(candidate?.path, legacyQoderWorkRoot);
  assert.equal(candidate?.reason, 'Found config.json');
});

test('discoverAgents marks qoder-work as candidate when both qoder-work roots are confirmed', async () => {
  const root = await makeTempRoot();
  const qoderWorkCnRoot = join(root, '.qoderworkcn');
  const legacyQoderWorkRoot = join(root, '.qoder-work');

  await mkdir(qoderWorkCnRoot, { recursive: true });
  await mkdir(legacyQoderWorkRoot, { recursive: true });
  await writeFile(join(qoderWorkCnRoot, '.qoder.json'), '{}', 'utf-8');
  await writeFile(join(legacyQoderWorkRoot, 'config.json'), '{}', 'utf-8');

  const report = await discoverAgents({
    generatedAt: '2026-06-06T00:00:00.000Z',
    roots: [root],
  });

  const candidate = report.candidates.find(item => item.agentId === 'qoder-work');

  assert.equal(candidate?.status, 'candidate');
  assert.equal(candidate?.path, undefined);
  assert.deepEqual(candidate?.paths, [qoderWorkCnRoot, legacyQoderWorkRoot]);
  assert.equal(candidate?.reason, 'Multiple known config roots were confirmed; manual review needed');
});

test('discoverAgents marks qoder-work as candidate when confirmed roots exist across multiple search roots', async () => {
  const rootA = await makeTempRoot();
  const rootB = await makeTempRoot();
  const legacyQoderWorkRoot = join(rootA, '.qoder-work');
  const qoderWorkCnRoot = join(rootB, '.qoderworkcn');

  await mkdir(legacyQoderWorkRoot, { recursive: true });
  await mkdir(qoderWorkCnRoot, { recursive: true });
  await writeFile(join(legacyQoderWorkRoot, 'config.json'), '{}', 'utf-8');
  await writeFile(join(qoderWorkCnRoot, '.qoder.json'), '{}', 'utf-8');

  const report = await discoverAgents({
    generatedAt: '2026-06-06T00:00:00.000Z',
    roots: [rootA, rootB],
  });

  const candidate = report.candidates.find(item => item.agentId === 'qoder-work');

  assert.equal(candidate?.status, 'candidate');
  assert.equal(candidate?.path, undefined);
  assert.deepEqual(candidate?.paths, [legacyQoderWorkRoot, qoderWorkCnRoot]);
  assert.equal(candidate?.reason, 'Multiple known config roots were confirmed; manual review needed');
});

test('discoverAgents keeps first confirmed path for non-qoder-work multi-root confirmation', async () => {
  const rootA = await makeTempRoot();
  const rootB = await makeTempRoot();
  const qoderRootA = join(rootA, '.qoder');
  const qoderRootB = join(rootB, '.qoder');

  await mkdir(qoderRootA, { recursive: true });
  await mkdir(qoderRootB, { recursive: true });
  await writeFile(join(qoderRootA, 'config.json'), '{}', 'utf-8');
  await writeFile(join(qoderRootB, 'config.json'), '{}', 'utf-8');

  const report = await discoverAgents({
    generatedAt: '2026-06-06T00:00:00.000Z',
    roots: [rootA, rootB],
    specs: [
      { agentId: 'qoder', displayName: 'Qoder', relativePaths: ['.qoder'], confirmFiles: ['config.json'] },
    ],
  });

  const candidate = report.candidates.find(item => item.agentId === 'qoder');

  assert.equal(candidate?.status, 'confirmed');
  assert.equal(candidate?.path, qoderRootA);
  assert.equal(candidate?.paths, undefined);
  assert.equal(candidate?.reason, 'Found config.json');
});

test('discoverAgents does not treat .qoder.json as a confirm file for legacy qoder-work root', async () => {
  const root = await makeTempRoot();
  const legacyQoderWorkRoot = join(root, '.qoder-work');

  await mkdir(legacyQoderWorkRoot, { recursive: true });
  await writeFile(join(legacyQoderWorkRoot, '.qoder.json'), '{}', 'utf-8');

  const report = await discoverAgents({
    generatedAt: '2026-06-06T00:00:00.000Z',
    roots: [root],
  });

  const candidate = report.candidates.find(item => item.agentId === 'qoder-work');

  assert.equal(candidate?.status, 'candidate');
  assert.equal(candidate?.path, legacyQoderWorkRoot);
  assert.equal(candidate?.reason, 'Directory exists but no known config file was found');
});

test('discoverAgents confirms qoder-work from observed QoderWork CN AppData root', async () => {
  const root = await makeTempRoot();
  const qoderWorkCnAppDataRoot = join(root, 'AppData', 'Roaming', 'QoderWork CN');

  await mkdir(qoderWorkCnAppDataRoot, { recursive: true });
  await writeFile(join(qoderWorkCnAppDataRoot, '.builtin-defaults-state-v3.json'), '{}', 'utf-8');

  const report = await discoverAgents({
    generatedAt: '2026-06-06T00:00:00.000Z',
    roots: [root],
  });

  const candidate = report.candidates.find(item => item.agentId === 'qoder-work');

  assert.equal(candidate?.status, 'confirmed');
  assert.equal(candidate?.path, qoderWorkCnAppDataRoot);
  assert.equal(candidate?.reason, 'Found .builtin-defaults-state-v3.json');
});
