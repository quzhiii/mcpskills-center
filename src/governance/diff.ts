import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface PlanDiffResult {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: string[];
}

interface ActionFields {
  id: string;
  type: string;
  reason?: string;
  canonicalAgentName?: string;
  envRiskPolicy?: string;
}

export async function diffGovernancePlans(
  reportsDir: string,
): Promise<PlanDiffResult> {
  const currentSync = await readPlanJson(join(reportsDir, 'sync-plan-current.json'));
  const currentMcp = await readPlanJson(join(reportsDir, 'mcp-governance-plan-current.json'));
  const prevSync = await readPlanJson(join(reportsDir, 'sync-plan-previous.json'));
  const prevMcp = await readPlanJson(join(reportsDir, 'mcp-governance-plan-previous.json'));

  const currentActions = extractActions(currentSync).concat(extractActions(currentMcp));
  const prevActions = extractActions(prevSync).concat(extractActions(prevMcp));

  const currentMap = new Map(currentActions.map(a => [a.id, a]));
  const prevMap = new Map(prevActions.map(a => [a.id, a]));

  const added = currentActions.filter(a => !prevMap.has(a.id)).map(a => a.id);
  const removed = prevActions.filter(a => !currentMap.has(a.id)).map(a => a.id);
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const [id, current] of currentMap) {
    const prev = prevMap.get(id);
    if (!prev) continue;
    if (
      current.type !== prev.type ||
      current.reason !== prev.reason ||
      current.canonicalAgentName !== prev.canonicalAgentName
    ) {
      changed.push(id);
    } else {
      unchanged.push(id);
    }
  }

  return { added, removed, changed, unchanged };
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

function extractActions(plan: Record<string, unknown> | null): ActionFields[] {
  if (!plan || !plan.actions) return [];
  return (plan.actions as Array<Record<string, unknown>>).map(a => ({
    id: a.id as string,
    type: a.type as string,
    reason: a.reason as string | undefined,
    canonicalAgentName: a.canonicalAgentName as string | undefined,
    envRiskPolicy: a.envRiskPolicy as string | undefined,
  }));
}
