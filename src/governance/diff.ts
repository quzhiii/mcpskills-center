import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PlanDiffResult {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: string[];
}

export async function diffGovernancePlans(
  reportsDir: string,
): Promise<PlanDiffResult> {
  const currentSync = await readPlanJson(join(reportsDir, 'sync-plan-current.json'));
  const currentMcp = await readPlanJson(join(reportsDir, 'mcp-governance-plan-current.json'));
  const prevSync = await readPlanJson(join(reportsDir, 'sync-plan-previous.json'));
  const prevMcp = await readPlanJson(join(reportsDir, 'mcp-governance-plan-previous.json'));

  const currentActions = extractActionIds(currentSync).concat(extractActionIds(currentMcp));
  const prevActions = extractActionIds(prevSync).concat(extractActionIds(prevMcp));

  const currentSet = new Set(currentActions);
  const prevSet = new Set(prevActions);

  return {
    added: currentActions.filter(a => !prevSet.has(a)),
    removed: prevActions.filter(a => !currentSet.has(a)),
    changed: [],
    unchanged: currentActions.filter(a => prevSet.has(a)),
  };
}

export function formatPlanDiff(diff: PlanDiffResult): string {
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
    return 'No changes since last plan.';
  }
  const lines = ['Governance Plan Diff:', ''];
  if (diff.added.length > 0) {
    lines.push(`  Added (${diff.added.length}):`);
    for (const id of diff.added) lines.push(`    + ${id}`);
  }
  if (diff.removed.length > 0) {
    lines.push(`  Removed (${diff.removed.length}):`);
    for (const id of diff.removed) lines.push(`    - ${id}`);
  }
  if (diff.changed.length > 0) {
    lines.push(`  Changed (${diff.changed.length}):`);
    for (const id of diff.changed) lines.push(`    ~ ${id}`);
  }
  lines.push('', `  Unchanged: ${diff.unchanged.length}`);
  return lines.join('\n');
}

async function readPlanJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

function extractActionIds(plan: Record<string, unknown> | null): string[] {
  if (!plan || !plan.actions) return [];
  return (plan.actions as Array<{ id: string }>).map((a: { id: string }) => a.id);
}
