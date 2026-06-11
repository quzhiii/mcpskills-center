import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeMarkdownTableCell } from '../reporting/format.js';
import type { AgentDiscoveryReport } from '../types/index.js';

export async function writeAgentDiscoveryReports(report: AgentDiscoveryReport, reportsDir: string): Promise<void> {
  await mkdir(reportsDir, { recursive: true });
  await Promise.all([
    writeFile(join(reportsDir, 'agent-discovery-current.json'), JSON.stringify(report, null, 2), 'utf-8'),
    writeFile(join(reportsDir, 'agent-discovery-current.md'), renderAgentDiscoveryMarkdown(report), 'utf-8'),
  ]);
}

export function renderAgentDiscoveryMarkdown(report: AgentDiscoveryReport): string {
  const lines = [
    '# Agent Discovery Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '| Agent | Display Name | Status | Support | Source-of-Truth Confidence | Path | Reason |',
    '|---|---|---|---|---|---|---|',
  ];

  for (const candidate of report.candidates) {
    const pathText = candidate.paths?.length ? candidate.paths.join(' ; ') : (candidate.path ?? '');
    lines.push(`| ${escapeMarkdownTableCell(candidate.agentId)} | ${escapeMarkdownTableCell(candidate.displayName)} | ${candidate.status} | ${escapeMarkdownTableCell(candidate.support?.currentLevel ?? '')} | ${escapeMarkdownTableCell(candidate.support?.sourceOfTruthConfidence ?? '')} | \`${escapeMarkdownTableCell(pathText)}\` | ${escapeMarkdownTableCell(candidate.reason)} |`);
  }

  lines.push('');
  return lines.join('\n');
}
