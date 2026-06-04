import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { planSkillSync } from './planner.js';
import type { Inventory, Skill } from '../types/index.js';

function makeSkill(overrides: Partial<Skill>): Skill {
  return {
    id: 'skill',
    displayName: 'skill',
    sourcePath: 'C:/skills/skill',
    agentInstallPaths: ['C:/Users/quzhi/.claude/skills/skill'],
    isCanonical: false,
    isSymlink: false,
    hasSkillMd: true,
    frontmatterValid: true,
    isDuplicate: false,
    ...overrides,
  };
}

function makeInventory(skills: Skill[]): Inventory {
  return {
    generatedAt: '2026-06-03T00:00:00.000Z',
    agents: [],
    skills,
    mcpServers: [],
    profiles: [],
  };
}

test('planSkillSync plans symlink consolidation for duplicate skills', () => {
  const canonicalSkillsDir = 'C:/canonical-skills';
  const inventory = makeInventory([
    makeSkill({
      id: 'duplicate-skill',
      displayName: 'duplicate-skill',
      sourcePath: 'C:/Users/quzhi/.claude/skills/duplicate-skill',
      agentInstallPaths: [
        'C:/Users/quzhi/.claude/skills/duplicate-skill',
        'C:/Users/quzhi/.opencode/skills/duplicate-skill',
      ],
      isDuplicate: true,
    }),
  ]);

  const plan = planSkillSync(inventory, {
    canonicalSkillsDir,
    strategy: 'symlink',
    agentNames: ['claude-code', 'opencode'],
  });

  assert.equal(plan.strategy, 'symlink');
  assert.equal(plan.canonicalSkillsDir, canonicalSkillsDir);
  assert.deepEqual(
    plan.actions.map(action => action.type),
    ['copy-to-canonical', 'link-to-agent', 'link-to-agent']
  );
  assert.equal(plan.actions[0].sourcePath, 'C:/Users/quzhi/.claude/skills/duplicate-skill');
  assert.equal(plan.actions[0].targetPath, join(canonicalSkillsDir, 'duplicate-skill'));
  assert.equal(plan.actions.every(action => action.skillId === 'duplicate-skill'), true);
});

test('planSkillSync plans copy strategy without symlink actions', () => {
  const inventory = makeInventory([
    makeSkill({
      id: 'duplicate-skill',
      agentInstallPaths: [
        'C:/Users/quzhi/.claude/skills/duplicate-skill',
        'C:/Users/quzhi/.codex/skills/duplicate-skill',
      ],
      isDuplicate: true,
    }),
  ]);

  const plan = planSkillSync(inventory, {
    canonicalSkillsDir: 'C:/canonical-skills',
    strategy: 'copy',
    agentNames: ['claude-code', 'codex'],
  });

  assert.deepEqual(
    plan.actions.map(action => action.type),
    ['copy-to-canonical', 'copy-to-agent', 'copy-to-agent']
  );
});

test('planSkillSync emits manual-review for incomplete skills', () => {
  const inventory = makeInventory([
    makeSkill({
      id: 'incomplete-skill',
      hasSkillMd: false,
      frontmatterValid: false,
    }),
  ]);

  const plan = planSkillSync(inventory, {
    canonicalSkillsDir: 'C:/canonical-skills',
    strategy: 'symlink',
    agentNames: ['claude-code'],
  });

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'manual-review');
  assert.equal(plan.actions[0].requiresWrite, false);
});
