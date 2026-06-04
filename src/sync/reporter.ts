import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { SyncPlan } from '../types/index.js';

export function renderSyncPlanMarkdown(plan: SyncPlan): string {
  const lines: string[] = [];

  lines.push('# Sync Dry-Run Plan');
  lines.push('');
  lines.push(`Generated: ${plan.generatedAt}`);
  lines.push(`Strategy: \`${plan.strategy}\``);
  lines.push(`Canonical Skills Dir: \`${plan.canonicalSkillsDir}\``);
  lines.push('');
  lines.push(`Actions: ${plan.actions.length}`);
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
    writeFile(jsonPath, JSON.stringify(plan, null, 2), 'utf-8'),
    writeFile(markdownPath, renderSyncPlanMarkdown(plan), 'utf-8'),
  ]);
}

function formatPath(value: string | undefined): string {
  return value ? `\`${escapeMarkdownTableCell(value)}\`` : '-';
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
