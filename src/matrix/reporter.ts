import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CapabilityMatrix } from '../types/index.js';

export async function writeCapabilityMatrixReports(matrix: CapabilityMatrix, reportsDir: string): Promise<void> {
  await mkdir(reportsDir, { recursive: true });
  await Promise.all([
    writeFile(join(reportsDir, 'capability-matrix-current.json'), JSON.stringify(matrix, null, 2), 'utf-8'),
    writeFile(join(reportsDir, 'capability-matrix-current.md'), renderCapabilityMatrixMarkdown(matrix), 'utf-8'),
  ]);
}

export function renderCapabilityMatrixMarkdown(matrix: CapabilityMatrix): string {
  const lines: string[] = [];
  lines.push('# Capability Matrix Report');
  lines.push('');
  lines.push(`Generated: ${matrix.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total Skill Capabilities: ${matrix.summary.totalSkillCapabilities}`);
  lines.push(`- Total MCP Capabilities: ${matrix.summary.totalMcpCapabilities}`);
  lines.push(`- Shared Skills: ${matrix.summary.sharedSkills}`);
  lines.push(`- Shared MCPs: ${matrix.summary.sharedMcps}`);
  lines.push('');
  lines.push('## Skills');
  lines.push('');
  lines.push(renderMatrixTable(matrix.agents, matrix.skills));
  lines.push('');
  lines.push('## MCP Servers');
  lines.push('');
  lines.push(renderMatrixTable(matrix.agents, matrix.mcpServers));
  lines.push('');
  return lines.join('\n');
}

function renderMatrixTable(agents: string[], rows: CapabilityMatrix['skills']): string {
  const headers = ['Capability', ...agents.map(escapeCell), 'Shared'];
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
  ];

  for (const row of rows) {
    lines.push(`| ${escapeCell(row.capabilityId)} | ${agents.map(agent => row.agentStates[agent] === 'present' ? 'present' : 'missing').join(' | ')} | ${row.isShared ? 'yes' : 'no'} |`);
  }

  return lines.join('\n');
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
