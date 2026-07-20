import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultPaths } from '../config/paths.js';
import { renderDoctorReport, runDoctor } from './index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function makeDoctorFixture(agentPathExists = false) {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-doctor-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const paths = createDefaultPaths(join(root, 'package', 'dist'), {
    platform: 'linux',
    homeDir: join(root, 'home'),
    xdgDataHome: join(root, 'data-root'),
  });
  const agentDir = join(root, 'home', '.agent');
  const skillsDir = join(agentDir, 'skills');
  await mkdir(paths.bundledProfilesDir, { recursive: true });
  if (agentPathExists) await mkdir(skillsDir, { recursive: true });
  await Promise.all([
    writeFile(paths.bundledAgentConfigPath, JSON.stringify({
      agents: [{ id: 'agent', scannerType: 'generic', configDir: agentDir, skillsDir }],
    })),
    writeFile(paths.bundledRoutingPolicyPath, JSON.stringify({
      version: '1', taskCategories: [], fallbackOrder: ['agent'],
    })),
  ]);
  return paths;
}

test('runDoctor is read-only and skips an agent that is not installed', async () => {
  const paths = await makeDoctorFixture();

  const report = await runDoctor(paths, { nodeVersion: 'v22.10.0', defaultAgents: [] });

  assert.ok(report.diagnostics.some(item => item.id === 'runtime.node' && item.status === 'ok'));
  assert.ok(report.diagnostics.some(item => item.id === 'agent.agent' && item.status === 'skipped'));
  assert.equal(report.diagnostics.some(item => item.status === 'error'), false);
  await assert.rejects(() => access(paths.userDataRoot), { code: 'ENOENT' });
  await assert.rejects(() => access(paths.governanceDbPath), { code: 'ENOENT' });
});

test('runDoctor recognizes installed agents without scanning them', async () => {
  const paths = await makeDoctorFixture(true);

  const report = await runDoctor(paths, { nodeVersion: 'v22.10.0', defaultAgents: [] });

  assert.ok(report.diagnostics.some(item => item.id === 'agent.agent' && item.status === 'ok'));
});

test('runDoctor warns for supported Node versions outside the CI matrix', async () => {
  const paths = await makeDoctorFixture();

  const report = await runDoctor(paths, { nodeVersion: 'v25.1.0', defaultAgents: [] });

  assert.ok(report.diagnostics.some(item => item.id === 'runtime.node' && item.status === 'warning'));
  assert.equal(report.diagnostics.some(item => item.status === 'error'), false);
});

test('runDoctor reports unsupported Node and invalid config without leaking values', async () => {
  const paths = await makeDoctorFixture();
  await mkdir(paths.userConfigDir, { recursive: true });
  await writeFile(paths.userAgentConfigPath, '{"token":"secret-value"}');

  const report = await runDoctor(paths, { nodeVersion: 'v19.0.0', defaultAgents: [] });
  const output = renderDoctorReport(report);

  assert.ok(report.diagnostics.some(item => item.id === 'runtime.node' && item.status === 'error'));
  assert.ok(report.diagnostics.some(item => item.id === 'agents.config' && item.status === 'error'));
  assert.equal(output.includes('secret-value'), false);
  assert.match(output, /No secret values were inspected or included/);
});

test('renderDoctorReport includes diagnostic identifiers for actionable output', () => {
  const output = renderDoctorReport({
    diagnostics: [{
      id: 'runtime.node',
      status: 'warning',
      message: 'Node.js 25 is supported but is not covered by the CI matrix.',
      remediation: 'Prefer Node.js 20, 22, or 24.',
    }],
  });

  assert.match(output, /\[WARNING\] runtime\.node: Node\.js 25/);
  assert.match(output, /Fix: Prefer Node\.js 20, 22, or 24\./);
});
