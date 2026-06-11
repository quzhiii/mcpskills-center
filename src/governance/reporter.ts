import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface GovernanceReportData {
  generatedAt: string;
  skills: {
    totalSkills: number;
    syncActions: number;
    writeActions: number;
  };
  mcp: {
    totalServers: number;
    governanceActions: number;
    canonicalCandidates: number;
  };
}

export async function writeGovernanceReports(data: GovernanceReportData, reportsDir: string): Promise<void> {
  await mkdir(reportsDir, { recursive: true });

  // JSON report
  const jsonPath = join(reportsDir, 'governance-current.json');
  await writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

  // Markdown report
  const mdPath = join(reportsDir, 'governance-current.md');
  const md = [
    '# Governance Report',
    '',
    `Generated: ${data.generatedAt}`,
    '',
    '## Skills Sync',
    '',
    `| Metric | Value |`,
    `|---|---|`,
    `| Total Skills | ${data.skills.totalSkills} |`,
    `| Sync Actions | ${data.skills.syncActions} |`,
    `| Write Actions | ${data.skills.writeActions} |`,
    '',
    '## MCP Governance',
    '',
    `| Metric | Value |`,
    `|---|---|`,
    `| Total MCP Servers | ${data.mcp.totalServers} |`,
    `| Governance Actions | ${data.mcp.governanceActions} |`,
    `| Canonical Candidates | ${data.mcp.canonicalCandidates} |`,
  ].join('\n');
  await writeFile(mdPath, md, 'utf-8');
}
