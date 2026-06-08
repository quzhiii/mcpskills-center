import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SyncAction, SyncPlan } from '../types/index.js';

export interface SyncPlanSummary {
  totalActions: number;
  writeActions: number;
  actionTypes: Record<string, SyncPlanSummaryCount>;
  agentImpact: Record<string, SyncPlanSummaryCount>;
}

export interface SyncPlanSummaryCount {
  actions: number;
  writeActions: number;
  actionTypes: Record<string, number>;
}

export function buildSyncPlanSummary(plan: SyncPlan): SyncPlanSummary {
  const summary: SyncPlanSummary = {
    totalActions: plan.actions.length,
    writeActions: plan.actions.filter(action => action.requiresWrite).length,
    actionTypes: {},
    agentImpact: {},
  };

  for (const action of plan.actions) {
    incrementSummary(summary.actionTypes, action.type, action);
    if (action.agentName) incrementSummary(summary.agentImpact, action.agentName, action);
  }

  return summary;
}

export function renderSyncPlanMarkdown(plan: SyncPlan): string {
  const lines: string[] = [];
  const summary = buildSyncPlanSummary(plan);

  lines.push('# Sync Dry-Run Plan');
  lines.push('');
  lines.push(`Generated: ${plan.generatedAt}`);
  lines.push(`Strategy: \`${plan.strategy}\``);
  lines.push(`Canonical Skills Dir: \`${plan.canonicalSkillsDir}\``);
  lines.push('');
  lines.push(`Actions: ${plan.actions.length}`);
  lines.push(`Write Actions: ${summary.writeActions}`);
  lines.push('');
  lines.push('## Action Type Summary');
  lines.push('');
  lines.push('| Action Type | Actions | Write Actions |');
  lines.push('|-------------|---------|---------------|');
  for (const [actionType, count] of Object.entries(summary.actionTypes)) {
    lines.push(`| ${escapeMarkdownTableCell(actionType)} | ${count.actions} | ${count.writeActions} |`);
  }
  lines.push('');
  lines.push('## Agent Impact');
  lines.push('');
  if (Object.keys(summary.agentImpact).length > 0) {
    lines.push('| Agent | Actions | Write Actions | Action Types |');
    lines.push('|-------|---------|---------------|--------------|');
    for (const [agentName, count] of Object.entries(summary.agentImpact)) {
      lines.push(`| ${escapeMarkdownTableCell(agentName)} | ${count.actions} | ${count.writeActions} | ${formatActionTypeCounts(count.actionTypes)} |`);
    }
  } else {
    lines.push('No agent-specific actions.');
  }
  lines.push('');
  lines.push('## Manual Review Required');
  lines.push('');
  const manualReviewActions = plan.actions.filter(action => action.type === 'manual-review');
  if (manualReviewActions.length > 0) {
    lines.push('| Skill | Reason |');
    lines.push('|-------|--------|');
    for (const action of manualReviewActions) {
      lines.push(`| ${escapeMarkdownTableCell(action.skillId)} | ${escapeMarkdownTableCell(action.reason)} |`);
    }
  } else {
    lines.push('No manual review actions.');
  }
  lines.push('');
  lines.push('## Actions');
  lines.push('');
  lines.push('| Type | Skill | Requires Write | Source | Target | Reason |');
  lines.push('|------|-------|----------------|--------|--------|--------|');
  for (const action of plan.actions) {
    lines.push(
      `| ${escapeMarkdownTableCell(action.type)} | ${escapeMarkdownTableCell(action.skillId)} | ${action.requiresWrite ? 'yes' : 'no'} | ${formatPath(action.sourcePath)} | ${formatPath(action.targetPath)} | ${escapeMarkdownTableCell(action.reason)} |`
    );
  }
  lines.push('');

  return lines.join('\n');
}

export async function writeSyncPlanReports(plan: SyncPlan, reportsDir: string): Promise<void> {
  const jsonPath = join(reportsDir, 'sync-plan-current.json');
  const markdownPath = join(reportsDir, 'sync-plan-current.md');

  await mkdir(dirname(jsonPath), { recursive: true });
  await Promise.all([
    writeFile(jsonPath, JSON.stringify({ ...plan, summary: buildSyncPlanSummary(plan) }, null, 2), 'utf-8'),
    writeFile(markdownPath, renderSyncPlanMarkdown(plan), 'utf-8'),
  ]);
}

function incrementSummary(target: Record<string, SyncPlanSummaryCount>, key: string, action: SyncAction): void {
  target[key] ??= { actions: 0, writeActions: 0, actionTypes: {} };
  target[key].actions += 1;
  if (action.requiresWrite) target[key].writeActions += 1;
  target[key].actionTypes[action.type] = (target[key].actionTypes[action.type] ?? 0) + 1;
}

function formatActionTypeCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([actionType, count]) => `${escapeMarkdownTableCell(actionType)}: ${count}`)
    .join(', ');
}

function formatPath(value: string | undefined): string {
  return value ? `\`${escapeMarkdownTableCell(value)}\`` : '-';
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
