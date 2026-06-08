import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderSyncPlanMarkdown, writeSyncPlanReports } from './reporter.js';
import type { SyncPlan } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

function makePlan(): SyncPlan {
  return {
    generatedAt: '2026-06-03T00:00:00.000Z',
    canonicalSkillsDir: 'C:/canonical-skills',
    strategy: 'symlink',
    actions: [
      {
        id: 'promote-canonical:duplicate-skill:0',
        type: 'promote-canonical',
        skillId: 'duplicate-skill',
        sourcePath: 'C:/Users/quzhi/.claude/skills/duplicate-skill',
        targetPath: 'C:/canonical-skills/duplicate-skill',
        reason: 'Promote one reviewed skill instance into the canonical store',
        requiresWrite: true,
      },
      {
        id: 'distribute:duplicate-skill:1',
        type: 'distribute',
        skillId: 'duplicate-skill',
        agentName: 'claude-code',
        sourcePath: 'C:/canonical-skills/duplicate-skill',
        targetPath: 'C:/Users/quzhi/.claude/skills/duplicate-skill',
        mode: 'symlink',
        reason: 'Distribute canonical skill to the agent install as a symlink',
        requiresWrite: true,
      },
      {
        id: 'distribute:duplicate-skill:2',
        type: 'distribute',
        skillId: 'duplicate-skill',
        agentName: 'opencode',
        sourcePath: 'C:/canonical-skills/duplicate-skill',
        targetPath: 'C:/Users/quzhi/.opencode/skills/duplicate-skill',
        mode: 'symlink',
        reason: 'Distribute canonical skill to the agent install as a symlink',
        requiresWrite: true,
      },
      {
        id: 'manual-review:broken-skill:3',
        type: 'manual-review',
        skillId: 'broken-skill',
        reason: 'Skill is missing SKILL.md and must be reviewed before synchronization',
        requiresWrite: false,
      },
    ],
  };
}

test('renderSyncPlanMarkdown renders governance summaries and sync actions', () => {
  const markdown = renderSyncPlanMarkdown(makePlan());

  assert.match(markdown, /# Sync Dry-Run Plan/);
  assert.match(markdown, /Strategy: `symlink`/);
  assert.match(markdown, /Canonical Skills Dir: `C:\/canonical-skills`/);
  assert.match(markdown, /Actions: 4/);
  assert.match(markdown, /Write Actions: 3/);
  assert.match(markdown, /## Action Type Summary/);
  assert.match(markdown, /\| Action Type \| Actions \| Write Actions \|/);
  assert.match(markdown, /\| promote-canonical \| 1 \| 1 \|/);
  assert.match(markdown, /\| distribute \| 2 \| 2 \|/);
  assert.match(markdown, /\| manual-review \| 1 \| 0 \|/);
  assert.match(markdown, /## Agent Impact/);
  assert.match(markdown, /\| Agent \| Actions \| Write Actions \| Action Types \|/);
  assert.match(markdown, /\| claude-code \| 1 \| 1 \| distribute: 1 \|/);
  assert.match(markdown, /\| opencode \| 1 \| 1 \| distribute: 1 \|/);
  assert.match(markdown, /## Manual Review Required/);
  assert.match(markdown, /\| broken-skill \| Skill is missing SKILL\.md and must be reviewed before synchronization \|/);
  assert.match(markdown, /\| Type \| Skill \| Requires Write \| Source \| Target \| Reason \|/);
  assert.match(markdown, /\| promote-canonical \| duplicate-skill \| yes \| `C:\/Users\/quzhi\/.claude\/skills\/duplicate-skill` \| `C:\/canonical-skills\/duplicate-skill` \| Promote one reviewed skill instance into the canonical store \|/);
  assert.match(markdown, /\| manual-review \| broken-skill \| no \| - \| - \| Skill is missing SKILL\.md and must be reviewed before synchronization \|/);
});

test('writeSyncPlanReports writes JSON with governance summary counts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-sync-report-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  await writeSyncPlanReports(makePlan(), root);
  const json = JSON.parse(await readFile(join(root, 'sync-plan-current.json'), 'utf-8'));

  assert.equal(json.summary.totalActions, 4);
  assert.equal(json.summary.writeActions, 3);
  assert.equal(json.summary.actionTypes['promote-canonical'].actions, 1);
  assert.equal(json.summary.actionTypes.distribute.writeActions, 2);
  assert.equal(json.summary.actionTypes['manual-review'].writeActions, 0);
  assert.equal(json.summary.agentImpact['claude-code'].actions, 1);
  assert.equal(json.summary.agentImpact['claude-code'].writeActions, 1);
});
