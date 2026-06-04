import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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
    '| Agent | Display Name | Status | Path | Reason |',
    '|---|---|---|---|---|',
  ];

  for (const candidate of report.candidates) {
    lines.push(`| ${escapeMarkdownTableCell(candidate.agentId)} | ${escapeMarkdownTableCell(candidate.displayName)} | ${candidate.status} | \`${escapeMarkdownTableCell(candidate.path)}\` | ${escapeMarkdownTableCell(candidate.reason)} |`);
  }

  lines.push('');
  return lines.join('\n');
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
