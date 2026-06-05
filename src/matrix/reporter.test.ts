import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCapabilityMatrix } from './capability.js';
import { writeCapabilityMatrixReports } from './reporter.js';
import type { Inventory } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

function makeInventory(): Inventory {
  return {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      { name: 'claude-code', configDir: 'C:/claude', skillsDir: 'C:/claude/skills' },
      { name: 'opencode', configDir: 'C:/opencode', skillsDir: 'C:/opencode/skills' },
    ],
    skills: [
      {
        id: 'skill-a',
        displayName: 'skill-a',
        sourcePath: 'C:/claude/skills/skill-a',
        agentInstallPaths: ['C:/claude/skills/skill-a', 'C:/opencode/skills/skill-a'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: true,
      },
    ],
    mcpServers: [
      {
        id: 'agentmemory',
        agentSources: ['claude-code'],
        transport: 'stdio',
        command: 'npx',
        isDuplicate: false,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
    ],
    profiles: [],
  };
}

test('writeCapabilityMatrixReports writes JSON and Markdown outputs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-matrix-report-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const matrix = buildCapabilityMatrix(makeInventory());
  await writeCapabilityMatrixReports(matrix, root);

  const json = JSON.parse(await readFile(join(root, 'capability-matrix-current.json'), 'utf-8'));
  const markdown = await readFile(join(root, 'capability-matrix-current.md'), 'utf-8');

  assert.equal(json.summary.totalSkillCapabilities, 1);
  assert.match(markdown, /# Capability Matrix Report/);
  assert.match(markdown, /## Skills/);
  assert.match(markdown, /## MCP Servers/);
  assert.match(markdown, /skill-a/);
  assert.match(markdown, /agentmemory/);
});

test('writeCapabilityMatrixReports escapes agent names in Markdown headers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-matrix-header-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const inventory: Inventory = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      { name: 'alpha|beta', configDir: 'C:/alpha', skillsDir: 'C:/alpha/skills' },
      { name: 'gamma', configDir: 'C:/gamma', skillsDir: 'C:/gamma/skills' },
    ],
    skills: [
      {
        id: 'skill-a',
        displayName: 'skill-a',
        sourcePath: 'C:/alpha/skills/skill-a',
        agentInstallPaths: ['C:/alpha/skills/skill-a'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: false,
      },
    ],
    mcpServers: [],
    profiles: [],
  };

  const matrix = buildCapabilityMatrix(inventory);
  await writeCapabilityMatrixReports(matrix, root);
  const markdown = await readFile(join(root, 'capability-matrix-current.md'), 'utf-8');

  assert.match(markdown, /\| Capability \| alpha\\\|beta \| gamma \| Shared \|/);
});
