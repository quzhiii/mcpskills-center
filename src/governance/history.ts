import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export interface GovernanceHistoryEntry {
  timestamp: string;
  operation: 'apply' | 'restore';
  domain: 'skills' | 'mcp' | 'unified';
  actionCount: number;
  manifestPath?: string;
  summary: string;
}

export interface GovernanceHistory {
  entries: GovernanceHistoryEntry[];
}

const HISTORY_FILE = 'governance-history.json';

export async function readHistory(reportsDir: string): Promise<GovernanceHistory> {
  const path = join(reportsDir, HISTORY_FILE);
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { entries: [] };
  }
}

export async function appendHistoryEntry(
  reportsDir: string,
  entry: GovernanceHistoryEntry,
): Promise<void> {
  const history = await readHistory(reportsDir);
  history.entries.push(entry);
  const path = join(reportsDir, HISTORY_FILE);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(history, null, 2), 'utf-8');
}

export function formatHistory(history: GovernanceHistory): string {
  if (history.entries.length === 0) {
    return 'No governance operations recorded yet.';
  }
  const lines = ['Governance Operation History:', ''];
  for (const entry of history.entries.slice().reverse()) {
    lines.push(
      `  ${entry.timestamp}  ${entry.operation.padEnd(8)}  ${entry.domain.padEnd(10)}  ${entry.actionCount} actions  ${entry.summary}`,
    );
    if (entry.manifestPath) {
      lines.push(`    manifest: ${entry.manifestPath}`);
    }
  }
  return lines.join('\n');
}
