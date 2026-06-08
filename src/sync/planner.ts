import { join } from 'node:path';
import type { Inventory, Skill, SyncAction, SyncPlan } from '../types/index.js';

type InstallKind = NonNullable<SyncAction['sourceKind']>;

export interface PlanSkillSyncOptions {
  canonicalSkillsDir: string;
  strategy: 'symlink' | 'copy';
  agentNames: string[];
}

export function planSkillSync(inventory: Inventory, options: PlanSkillSyncOptions): SyncPlan {
  const actions: SyncAction[] = [];

  for (const skill of inventory.skills) {
    const sourceKind = detectInstallKind(skill, options.canonicalSkillsDir);

    if (!skill.hasSkillMd || !skill.frontmatterValid) {
      actions.push(createAction({
        index: actions.length,
        type: 'manual-review',
        skill,
        sourcePath: skill.sourcePath,
        sourceKind,
        reason: !skill.hasSkillMd
          ? 'Skill is missing SKILL.md and must be reviewed before synchronization'
          : 'Skill has invalid frontmatter and must be reviewed before synchronization',
        requiresWrite: false,
      }));
      continue;
    }

    if (skill.isCanonical) {
      actions.push(createAction({
        index: actions.length,
        type: 'skip',
        skill,
        sourcePath: skill.sourcePath,
        sourceKind: 'canonical-store',
        reason: 'Skill is already in the canonical store; no redundant copy is needed',
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
        sourceKind,
        reason: 'Skill has only one valid install; no governance sync is needed',
        requiresWrite: false,
      }));
      continue;
    }

    const canonicalPath = join(options.canonicalSkillsDir, skill.id);
    const canonicalSource = skill.sourcePath || skill.agentInstallPaths[0];

    actions.push(createAction({
      index: actions.length,
      type: 'promote-canonical',
      skill,
      sourcePath: canonicalSource,
      targetPath: canonicalPath,
      sourceKind: detectPathKind(canonicalSource, options.canonicalSkillsDir),
      targetKind: 'canonical-store',
      reason: 'Promote one reviewed skill instance into the canonical store',
      requiresWrite: true,
    }));

    for (const installPath of skill.agentInstallPaths) {
      actions.push(createAction({
        index: actions.length,
        type: 'distribute',
        skill,
        agentName: detectAgentName(installPath, options.agentNames),
        sourcePath: canonicalPath,
        targetPath: installPath,
        sourceKind: 'canonical-store',
        targetKind: 'agent-install',
        mode: options.strategy,
        reason: options.strategy === 'symlink'
          ? 'Distribute canonical skill to the agent install as a symlink'
          : 'Distribute canonical skill to the agent install as a copy',
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
    sourceKind: args.sourceKind,
    targetKind: args.targetKind,
    mode: args.mode,
    reason: args.reason,
    requiresWrite: args.requiresWrite,
  };
}

function detectInstallKind(skill: Skill, canonicalSkillsDir: string): InstallKind {
  if (skill.isCanonical) return 'canonical-store';
  return detectPathKind(skill.sourcePath, canonicalSkillsDir);
}

function detectPathKind(path: string | undefined, canonicalSkillsDir: string): InstallKind {
  if (!path) return 'unknown';
  const normalizedPath = normalizePath(path);
  const normalizedCanonicalRoot = normalizePath(canonicalSkillsDir);
  return normalizedPath === normalizedCanonicalRoot || normalizedPath.startsWith(`${normalizedCanonicalRoot}/`)
    ? 'canonical-store'
    : 'agent-install';
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function detectAgentName(path: string, agentNames: string[]): string | undefined {
  const normalized = path.toLowerCase();
  return agentNames.find(agentName => normalized.includes(agentName.replace('-', '').toLowerCase()))
    ?? agentNames.find(agentName => normalized.includes(agentName.toLowerCase()))
    ?? agentNames.find(agentName => agentName.split('-').some(part => normalized.includes(part.toLowerCase())));
}
