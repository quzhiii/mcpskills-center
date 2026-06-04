import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAudit } from './index.js';
import type { Inventory } from '../types/index.js';

function makeInventory(): Inventory {
  return {
    generatedAt: '2026-06-03T00:00:00.000Z',
    agents: [
      {
        name: 'claude-code',
        configDir: 'C:/Users/quzhi/.claude',
        skillsDir: 'C:/Users/quzhi/.claude/skills',
      },
    ],
    skills: [
      {
        id: 'duplicate-skill',
        displayName: 'duplicate-skill',
        sourcePath: 'C:/skills/duplicate-skill',
        agentInstallPaths: ['C:/skills/claude/duplicate-skill', 'C:/skills/opencode/duplicate-skill'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: true,
      },
      {
        id: 'missing-skill-md',
        displayName: 'missing-skill-md',
        sourcePath: 'C:/skills/missing-skill-md',
        agentInstallPaths: ['C:/skills/claude/missing-skill-md'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: false,
        frontmatterValid: false,
        isDuplicate: false,
      },
      {
        id: 'invalid-frontmatter',
        displayName: 'invalid-frontmatter',
        sourcePath: 'C:/skills/invalid-frontmatter',
        agentInstallPaths: ['C:/skills/claude/invalid-frontmatter'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: false,
        isDuplicate: false,
      },
      {
        id: 'symlink-skill',
        displayName: 'symlink-skill',
        sourcePath: 'C:/skills/symlink-skill',
        agentInstallPaths: ['C:/skills/claude/symlink-skill'],
        isCanonical: false,
        isSymlink: true,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: false,
      },
    ],
    mcpServers: [
      {
        id: 'duplicate-mcp',
        agentSources: ['claude-code', 'opencode'],
        transport: 'stdio',
        command: 'npx',
        isDuplicate: true,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
      {
        id: 'sensitive-mcp',
        agentSources: ['codex'],
        transport: 'stdio',
        command: 'npx',
        isDuplicate: false,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: true,
      },
    ],
    profiles: [],
  };
}

test('runAudit adds actionable recommendations alongside issues', () => {
  const report = runAudit(makeInventory());

  assert.equal(report.issues.length, 6);
  assert.equal(report.recommendations.length, 6);
  assert.equal(report.recommendations.some(r => r.category === 'merge' && r.targetId === 'duplicate-skill'), true);
  assert.equal(report.recommendations.some(r => r.category === 'remove' && r.targetId === 'missing-skill-md'), true);
  assert.equal(report.recommendations.some(r => r.category === 'manual-review' && r.targetId === 'invalid-frontmatter'), true);
  assert.equal(report.recommendations.some(r => r.category === 'manual-review' && r.targetId === 'symlink-skill'), true);
  assert.equal(report.recommendations.some(r => r.category === 'merge' && r.targetId === 'duplicate-mcp'), true);
  assert.equal(report.recommendations.some(r => r.category === 'manual-review' && r.targetId === 'sensitive-mcp'), true);
});
