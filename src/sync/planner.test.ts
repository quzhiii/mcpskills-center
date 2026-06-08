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

test('planSkillSync promotes duplicate valid installs and distributes the canonical skill per agent', () => {
  const canonicalSkillsDir = 'C:/canonical-skills';
  const claudeInstall = 'C:/Users/quzhi/.claude/skills/duplicate-skill';
  const opencodeInstall = 'C:/Users/quzhi/.opencode/skills/duplicate-skill';
  const canonicalPath = join(canonicalSkillsDir, 'duplicate-skill');
  const inventory = makeInventory([
    makeSkill({
      id: 'duplicate-skill',
      displayName: 'duplicate-skill',
      sourcePath: claudeInstall,
      agentInstallPaths: [
        claudeInstall,
        opencodeInstall,
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
    ['promote-canonical', 'distribute', 'distribute']
  );
  assert.equal(plan.actions[0].sourcePath, claudeInstall);
  assert.equal(plan.actions[0].targetPath, canonicalPath);
  assert.equal(plan.actions[0].sourceKind, 'agent-install');
  assert.equal(plan.actions[0].targetKind, 'canonical-store');

  assert.deepEqual(
    plan.actions.slice(1).map(action => ({
      agentName: action.agentName,
      sourcePath: action.sourcePath,
      targetPath: action.targetPath,
      sourceKind: action.sourceKind,
      targetKind: action.targetKind,
      mode: action.mode,
      requiresWrite: action.requiresWrite,
    })),
    [
      {
        agentName: 'claude-code',
        sourcePath: canonicalPath,
        targetPath: claudeInstall,
        sourceKind: 'canonical-store',
        targetKind: 'agent-install',
        mode: 'symlink',
        requiresWrite: true,
      },
      {
        agentName: 'opencode',
        sourcePath: canonicalPath,
        targetPath: opencodeInstall,
        sourceKind: 'canonical-store',
        targetKind: 'agent-install',
        mode: 'symlink',
        requiresWrite: true,
      },
    ]
  );
  assert.equal(plan.actions.every(action => action.skillId === 'duplicate-skill'), true);
});

test('planSkillSync records copy distribution mode when copy strategy is selected', () => {
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
    ['promote-canonical', 'distribute', 'distribute']
  );
  assert.deepEqual(plan.actions.slice(1).map(action => action.mode), ['copy', 'copy']);
});

test('planSkillSync skips a single valid install with an explicit reason', () => {
  const inventory = makeInventory([
    makeSkill({
      id: 'single-skill',
      sourcePath: 'C:/Users/quzhi/.claude/skills/single-skill',
      agentInstallPaths: ['C:/Users/quzhi/.claude/skills/single-skill'],
      isDuplicate: false,
    }),
  ]);

  const plan = planSkillSync(inventory, {
    canonicalSkillsDir: 'C:/canonical-skills',
    strategy: 'symlink',
    agentNames: ['claude-code'],
  });

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'skip');
  assert.equal(plan.actions[0].requiresWrite, false);
  assert.equal(plan.actions[0].sourceKind, 'agent-install');
  assert.match(plan.actions[0].reason, /only one valid install/i);
});

test('planSkillSync sends a missing SKILL.md to manual review', () => {
  const inventory = makeInventory([
    makeSkill({
      id: 'missing-skill-md',
      hasSkillMd: false,
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
  assert.match(plan.actions[0].reason, /missing SKILL\.md/i);
});

test('planSkillSync sends invalid frontmatter to manual review', () => {
  const inventory = makeInventory([
    makeSkill({
      id: 'invalid-frontmatter',
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
  assert.match(plan.actions[0].reason, /invalid frontmatter/i);
});

test('planSkillSync skips an already canonical install without a redundant copy', () => {
  const canonicalSkillsDir = 'C:/canonical-skills';
  const canonicalPath = join(canonicalSkillsDir, 'canonical-skill');
  const inventory = makeInventory([
    makeSkill({
      id: 'canonical-skill',
      sourcePath: canonicalPath,
      agentInstallPaths: [canonicalPath],
      isCanonical: true,
    }),
  ]);

  const plan = planSkillSync(inventory, {
    canonicalSkillsDir,
    strategy: 'symlink',
    agentNames: ['claude-code'],
  });

  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].type, 'skip');
  assert.equal(plan.actions[0].sourceKind, 'canonical-store');
  assert.equal(plan.actions[0].requiresWrite, false);
  assert.match(plan.actions[0].reason, /already in the canonical store/i);
});
