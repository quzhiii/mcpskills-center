import { join } from 'node:path';
import type { Inventory, Skill, SyncAction, SyncPlan } from '../types/index.js';

export interface PlanSkillSyncOptions {
  canonicalSkillsDir: string;
  strategy: 'symlink' | 'copy';
  agentNames: string[];
}

export function planSkillSync(inventory: Inventory, options: PlanSkillSyncOptions): SyncPlan {
  const actions: SyncAction[] = [];

  for (const skill of inventory.skills) {
    if (!skill.hasSkillMd || !skill.frontmatterValid) {
      actions.push(createAction({
        index: actions.length,
        type: 'manual-review',
        skill,
        reason: !skill.hasSkillMd
          ? 'Skill is missing SKILL.md and must be reviewed before synchronization'
          : 'Skill has invalid frontmatter and must be reviewed before synchronization',
        requiresWrite: false,
      }));
      continue;
    }

    if (skill.agentInstallPaths.length <= 1) {
      actions.push(createAction({
        index: actions.length,
        type: 'skip',
        skill,
        sourcePath: skill.sourcePath,
        reason: 'Skill is installed in only one location',
        requiresWrite: false,
      }));
      continue;
    }

    const canonicalPath = join(options.canonicalSkillsDir, skill.id);
    const canonicalSource = skill.sourcePath || skill.agentInstallPaths[0];

    actions.push(createAction({
      index: actions.length,
      type: 'copy-to-canonical',
      skill,
      sourcePath: canonicalSource,
      targetPath: canonicalPath,
      reason: 'Copy one reviewed skill instance into the canonical store',
      requiresWrite: true,
    }));

    for (const installPath of skill.agentInstallPaths) {
      actions.push(createAction({
        index: actions.length,
        type: options.strategy === 'symlink' ? 'link-to-agent' : 'copy-to-agent',
        skill,
        agentName: detectAgentName(installPath, options.agentNames),
        sourcePath: canonicalPath,
        targetPath: installPath,
        reason: options.strategy === 'symlink'
          ? 'Replace duplicate install location with a link to the canonical store'
          : 'Copy canonical skill contents to the agent install location',
        requiresWrite: true,
      }));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    canonicalSkillsDir: options.canonicalSkillsDir,
    strategy: options.strategy,
    actions,
  };
}

function createAction(args: Omit<SyncAction, 'id' | 'skillId'> & { index: number; skill: Skill }): SyncAction {
  return {
    id: `${args.type}:${args.skill.id}:${args.index}`,
    type: args.type,
    skillId: args.skill.id,
    agentName: args.agentName,
    sourcePath: args.sourcePath,
    targetPath: args.targetPath,
    reason: args.reason,
    requiresWrite: args.requiresWrite,
  };
}

function detectAgentName(path: string, agentNames: string[]): string | undefined {
  const normalized = path.toLowerCase();
  return agentNames.find(agentName => normalized.includes(agentName.replace('-', '').toLowerCase()))
    ?? agentNames.find(agentName => normalized.includes(agentName.toLowerCase()));
}
