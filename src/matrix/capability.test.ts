import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCapabilityMatrix } from './capability.js';
import type { Inventory } from '../types/index.js';

function makeInventory(): Inventory {
  return {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      { name: 'claude-code', configDir: 'C:/claude', skillsDir: 'C:/claude/skills' },
      { name: 'opencode', configDir: 'C:/opencode', skillsDir: 'C:/opencode/skills' },
      { name: 'qoder', configDir: 'C:/qoder', skillsDir: 'C:/qoder/skills' },
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
      {
        id: 'skill-b',
        displayName: 'skill-b',
        sourcePath: 'C:/qoder/skills/skill-b',
        agentInstallPaths: ['C:/qoder/skills/skill-b'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: false,
      },
    ],
    mcpServers: [
      {
        id: 'agentmemory',
        agentSources: ['claude-code', 'opencode'],
        transport: 'stdio',
        command: 'npx',
        isDuplicate: true,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
      {
        id: 'web-reader',
        agentSources: ['claude-code'],
        transport: 'http',
        host: 'https://example.com',
        isDuplicate: false,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
    ],
    profiles: [],
  };
}

test('buildCapabilityMatrix groups skills and MCPs across agents', () => {
  const matrix = buildCapabilityMatrix(makeInventory());

  assert.deepEqual(matrix.agents, ['claude-code', 'opencode', 'qoder']);
  assert.deepEqual(matrix.skills.map(item => item.capabilityId), ['skill-a', 'skill-b']);
  assert.deepEqual(matrix.mcpServers.map(item => item.capabilityId), ['agentmemory', 'web-reader']);
  assert.deepEqual(matrix.skills[0].agentStates, {
    'claude-code': 'present',
    'opencode': 'present',
    'qoder': 'missing',
  });
  assert.equal(matrix.skills[0].presentAgents.length, 2);
  assert.equal(matrix.skills[0].isShared, true);
  assert.equal(matrix.skills[1].isShared, false);
  assert.equal(matrix.mcpServers[0].isShared, true);
  assert.equal(matrix.summary.totalSkillCapabilities, 2);
  assert.equal(matrix.summary.totalMcpCapabilities, 2);
  assert.equal(matrix.summary.sharedSkills, 1);
  assert.equal(matrix.summary.sharedMcps, 1);
});

test('buildCapabilityMatrix maps skills to agents by skillsDir ownership instead of path substrings', () => {
  const inventory: Inventory = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      { name: 'alpha-agent', configDir: 'C:/agents/alpha-config', skillsDir: 'D:/shared/skills-alpha' },
      { name: 'beta-agent', configDir: 'C:/agents/beta-config', skillsDir: 'D:/shared/skills-beta' },
      { name: 'gamma-agent', configDir: 'C:/agents/gamma-config', skillsDir: 'D:/shared/skills-gamma' },
    ],
    skills: [
      {
        id: 'shared-skill',
        displayName: 'shared-skill',
        sourcePath: 'D:/shared/skills-alpha/shared-skill',
        agentInstallPaths: [
          'D:/shared/skills-alpha/shared-skill',
          'D:/shared/skills-beta/shared-skill',
          'C:/canonical/shared-skill',
        ],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: true,
      },
    ],
    mcpServers: [],
    profiles: [],
  };

  const matrix = buildCapabilityMatrix(inventory);

  assert.deepEqual(matrix.agents, ['alpha-agent', 'beta-agent', 'gamma-agent']);
  assert.deepEqual(matrix.skills[0].presentAgents, ['alpha-agent', 'beta-agent']);
  assert.deepEqual(matrix.skills[0].missingAgents, ['gamma-agent']);
  assert.deepEqual(matrix.skills[0].agentStates, {
    'alpha-agent': 'present',
    'beta-agent': 'present',
    'gamma-agent': 'missing',
  });
  assert.equal(matrix.skills[0].isShared, true);
  assert.equal(matrix.summary.sharedSkills, 1);
});

test('buildCapabilityMatrix ignores unknown MCP agentSources', () => {
  const inventory: Inventory = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      { name: 'alpha-agent', configDir: 'C:/agents/alpha-config', skillsDir: 'C:/agents/alpha-skills' },
      { name: 'beta-agent', configDir: 'C:/agents/beta-config', skillsDir: 'C:/agents/beta-skills' },
    ],
    skills: [],
    mcpServers: [
      {
        id: 'shared-mcp',
        agentSources: ['alpha-agent', 'stale-agent'],
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

  const matrix = buildCapabilityMatrix(inventory);

  assert.deepEqual(matrix.mcpServers[0].presentAgents, ['alpha-agent']);
  assert.deepEqual(matrix.mcpServers[0].missingAgents, ['beta-agent']);
  assert.deepEqual(matrix.mcpServers[0].agentStates, {
    'alpha-agent': 'present',
    'beta-agent': 'missing',
  });
  assert.equal(matrix.mcpServers[0].isShared, false);
  assert.equal(matrix.summary.sharedMcps, 0);
});

test('buildCapabilityMatrix can match case-insensitive skill ownership when configured', () => {
  const inventory: Inventory = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      { name: 'windows-agent', configDir: 'C:/Agents/Windows', skillsDir: 'C:/Users/Alice/Skills' },
      { name: 'other-agent', configDir: 'C:/Agents/Other', skillsDir: 'C:/Tools/OtherSkills' },
    ],
    skills: [
      {
        id: 'shared-skill',
        displayName: 'shared-skill',
        sourcePath: 'c:/users/alice/skills/shared-skill',
        agentInstallPaths: ['c:/users/alice/skills/shared-skill'],
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

  const matrix = (buildCapabilityMatrix as typeof buildCapabilityMatrix & ((inventory: Inventory, options: { caseInsensitivePaths: boolean }) => ReturnType<typeof buildCapabilityMatrix>))(inventory, {
    caseInsensitivePaths: true,
  });

  assert.deepEqual(matrix.skills[0].presentAgents, ['windows-agent']);
  assert.deepEqual(matrix.skills[0].missingAgents, ['other-agent']);
  assert.deepEqual(matrix.skills[0].agentStates, {
    'other-agent': 'missing',
    'windows-agent': 'present',
  });
  assert.equal(matrix.skills[0].isShared, false);
});

test('buildCapabilityMatrix preserves case-sensitive skill ownership when configured', () => {
  const inventory: Inventory = {
    generatedAt: '2026-06-06T00:00:00.000Z',
    agents: [
      { name: 'upper-agent', configDir: '/Agents/Upper', skillsDir: '/Users/Alice/Skills' },
      { name: 'lower-agent', configDir: '/Agents/Lower', skillsDir: '/users/alice/skills' },
    ],
    skills: [
      {
        id: 'shared-skill',
        displayName: 'shared-skill',
        sourcePath: '/users/alice/skills/shared-skill',
        agentInstallPaths: ['/users/alice/skills/shared-skill'],
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

  const matrix = (buildCapabilityMatrix as typeof buildCapabilityMatrix & ((inventory: Inventory, options: { caseInsensitivePaths: boolean }) => ReturnType<typeof buildCapabilityMatrix>))(inventory, {
    caseInsensitivePaths: false,
  });

  assert.deepEqual(matrix.skills[0].presentAgents, ['lower-agent']);
  assert.deepEqual(matrix.skills[0].missingAgents, ['upper-agent']);
  assert.deepEqual(matrix.skills[0].agentStates, {
    'lower-agent': 'present',
    'upper-agent': 'missing',
  });
});
