import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSyncPlanMarkdown } from './reporter.js';
import type { SyncPlan } from '../types/index.js';

test('renderSyncPlanMarkdown renders sync actions', () => {
  const plan: SyncPlan = {
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
        id: 'manual-review:broken-skill:1',
        type: 'manual-review',
        skillId: 'broken-skill',
        reason: 'Skill is missing SKILL.md and must be reviewed before synchronization',
        requiresWrite: false,
      },
    ],
  };

  const markdown = renderSyncPlanMarkdown(plan);

  assert.match(markdown, /# Sync Dry-Run Plan/);
  assert.match(markdown, /Strategy: `symlink`/);
  assert.match(markdown, /Canonical Skills Dir: `C:\/canonical-skills`/);
  assert.match(markdown, /\| Type \| Skill \| Requires Write \| Source \| Target \| Reason \|/);
  assert.match(markdown, /\| promote-canonical \| duplicate-skill \| yes \| `C:\/Users\/quzhi\/.claude\/skills\/duplicate-skill` \| `C:\/canonical-skills\/duplicate-skill` \| Promote one reviewed skill instance into the canonical store \|/);
  assert.match(markdown, /\| manual-review \| broken-skill \| no \| - \| - \| Skill is missing SKILL.md and must be reviewed before synchronization \|/);
});
