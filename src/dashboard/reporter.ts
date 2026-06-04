import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { renderDashboardHtml } from './html.js';
import type { Inventory, AuditReport } from '../types/index.js';

export async function writeInventoryJson(inventory: Inventory, outPath: string): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(inventory, null, 2), 'utf-8');
}

export async function writeInventoryMarkdown(inventory: Inventory, outPath: string): Promise<void> {
  const lines: string[] = [];
  lines.push('# MCP/skills Inventory Report');
  lines.push('');
  lines.push(`Generated: ${inventory.generatedAt}`);
  lines.push('');

  // Agents
  lines.push('## Agents');
  lines.push('');
  for (const agent of inventory.agents) {
    lines.push(`- **${agent.name}**`);
    lines.push(`  - Config: \`${agent.configDir}\``);
    lines.push(`  - Skills: \`${agent.skillsDir}\``);
    if (agent.mcpConfigFile) lines.push(`  - MCP: \`${agent.mcpConfigFile}\``);
  }
  lines.push('');

  // Skills
  lines.push('## Skills');
  lines.push('');
  lines.push(`Total: ${inventory.skills.length}`);
  lines.push('');
  lines.push('| Skill | Agents | Has SKILL.md | Frontmatter | Symlink |');
  lines.push('|-------|--------|--------------|-------------|---------|');
  for (const skill of inventory.skills.sort((a, b) => a.id.localeCompare(b.id))) {
    const agents = skill.agentInstallPaths.map(p => p.includes('claude') ? 'CC' : p.includes('opencode') ? 'OC' : p.includes('codex') ? 'CD' : '?').join(', ');
    lines.push(`| ${skill.id} | ${agents} | ${skill.hasSkillMd ? '✅' : '❌'} | ${skill.frontmatterValid ? '✅' : '❌'} | ${skill.isSymlink ? '🔗' : ''} |`);
  }
  lines.push('');

  // MCP Servers
  lines.push('## MCP Servers');
  lines.push('');
  lines.push(`Total: ${inventory.mcpServers.length}`);
  lines.push('');
  lines.push('| Server | Agents | Transport | Command | Sensitive Env |');
  lines.push('|--------|--------|-----------|---------|---------------|');
  for (const mcp of inventory.mcpServers.sort((a, b) => a.id.localeCompare(b.id))) {
    const agents = mcp.agentSources.map(s => s === 'claude-code' ? 'CC' : s === 'opencode' ? 'OC' : s === 'codex' ? 'CD' : '?').join(', ');
    const cmd = mcp.command ? mcp.command.split(' ')[0] : '-';
    lines.push(`| ${mcp.id} | ${agents} | ${mcp.transport} | \`${cmd}\` | ${mcp.hasSensitiveEnv ? '⚠️' : ''} |`);
  }
  lines.push('');

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, lines.join('\n'), 'utf-8');
}

export async function writeAuditMarkdown(report: AuditReport, outPath: string): Promise<void> {
  const lines: string[] = [];
  lines.push('# Audit Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total Skills: ${report.summary.totalSkills}`);
  lines.push(`- Total MCP Servers: ${report.summary.totalMcpServers}`);
  lines.push(`- Duplicate Skills: ${report.summary.duplicateSkills}`);
  lines.push(`- Duplicate MCPs: ${report.summary.duplicateMcps}`);
  lines.push(`- Missing SKILL.md: ${report.summary.missingSkillMds}`);
  lines.push(`- Broken Symlinks: ${report.summary.brokenSymlinks}`);
  lines.push(`- Sensitive Env Vars: ${report.summary.sensitiveEnvs}`);
  lines.push('');

  // Issues
  if (report.issues.length > 0) {
    lines.push('## Issues');
    lines.push('');

    const bySeverity = {
      error: report.issues.filter(i => i.severity === 'error'),
      warning: report.issues.filter(i => i.severity === 'warning'),
      info: report.issues.filter(i => i.severity === 'info'),
    };

    for (const [severity, issues] of Object.entries(bySeverity)) {
      if (issues.length === 0) continue;
      lines.push(`### ${severity.toUpperCase()} (${issues.length})`);
      lines.push('');
      for (const issue of issues) {
        lines.push(`- **${issue.item}** (${issue.agents.join(', ')})`);
        lines.push(`  - ${issue.description}`);
        lines.push(`  - Suggestion: ${issue.suggestion}`);
        lines.push('');
      }
    }
  } else {
    lines.push('## Issues');
    lines.push('');
    lines.push('No issues found.');
    lines.push('');
  }

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');
  if (report.recommendations.length > 0) {
    lines.push('| Category | Target | Severity | Requires Write | Action |');
    lines.push('|----------|--------|----------|----------------|--------|');
    for (const recommendation of report.recommendations) {
      const target = `${recommendation.targetType}: ${recommendation.targetId}`;
      lines.push(
        `| ${escapeMarkdownTableCell(recommendation.category)} | ${escapeMarkdownTableCell(target)} | ${escapeMarkdownTableCell(recommendation.severity)} | ${recommendation.requiresWrite ? 'yes' : 'no'} | ${escapeMarkdownTableCell(recommendation.suggestedAction)} |`
      );
    }
    lines.push('');
  } else {
    lines.push('No recommendations.');
    lines.push('');
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, lines.join('\n'), 'utf-8');
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export async function writeAllReports(inventory: Inventory, audit: AuditReport, baseDir: string): Promise<void> {
  await Promise.all([
    writeInventoryJson(inventory, join(baseDir, 'inventory-current.json')),
    writeInventoryMarkdown(inventory, join(baseDir, 'inventory-current.md')),
    writeAuditMarkdown(audit, join(baseDir, 'audit-current.md')),
    writeDashboardHtml(inventory, audit, join(baseDir, 'dashboard.html')),
  ]);
}

export async function writeDashboardHtml(inventory: Inventory, audit: AuditReport, outPath: string): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, renderDashboardHtml(inventory, audit), 'utf-8');
}
