import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { renderDashboardHtml } from './html.js';
import { resolveAgentSupport } from '../agents/support.js';
import type { Inventory, AuditReport } from '../types/index.js';

export async function writeInventoryJson(inventory: Inventory, outPath: string): Promise<void> {
  const enrichedInventory = withAgentSupport(inventory);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(enrichedInventory, null, 2), 'utf-8');
}

export async function writeInventoryMarkdown(inventory: Inventory, outPath: string): Promise<void> {
  const enrichedInventory = withAgentSupport(inventory);
  const lines: string[] = [];
  lines.push('# MCP/skills Inventory Report');
  lines.push('');
  lines.push(`Generated: ${enrichedInventory.generatedAt}`);
  lines.push('');

  // Agents
  lines.push('## Agents');
  lines.push('');
  for (const agent of enrichedInventory.agents) {
    lines.push(`- **${agent.name}**`);
    lines.push(`  - Config: \`${agent.configDir}\``);
    lines.push(`  - Skills: \`${agent.skillsDir}\``);
    if (agent.mcpConfigFile) lines.push(`  - MCP: \`${agent.mcpConfigFile}\``);
    if (agent.support) lines.push(`  - Support: \`${agent.support.currentLevel}\``);
    if (agent.support) lines.push(`  - Source-of-Truth Confidence: \`${agent.support.sourceOfTruthConfidence}\``);
  }
  lines.push('');

  // Skills
  lines.push('## Skills');
  lines.push('');
  lines.push(`Total: ${enrichedInventory.skills.length}`);
  lines.push('');
  lines.push('| Skill | Agents | Has SKILL.md | Frontmatter | Symlink |');
  lines.push('|-------|--------|--------------|-------------|---------|');
  for (const skill of [...enrichedInventory.skills].sort((a, b) => a.id.localeCompare(b.id))) {
    const agents = skill.agentInstallPaths.map(p => p.includes('claude') ? 'CC' : p.includes('opencode') ? 'OC' : p.includes('codex') ? 'CD' : '?').join(', ');
    lines.push(`| ${skill.id} | ${agents} | ${skill.hasSkillMd ? '✅' : '❌'} | ${skill.frontmatterValid ? '✅' : '❌'} | ${skill.isSymlink ? '🔗' : ''} |`);
  }
  lines.push('');

  // MCP Servers
  lines.push('## MCP Servers');
  lines.push('');
  lines.push(`Total: ${enrichedInventory.mcpServers.length}`);
  lines.push('');
  lines.push('| Server | Agents | Transport | Command | Sensitive Env |');
  lines.push('|--------|--------|-----------|---------|---------------|');
  for (const mcp of [...enrichedInventory.mcpServers].sort((a, b) => a.id.localeCompare(b.id))) {
    const agents = mcp.agentSources.map(s => s === 'claude-code' ? 'CC' : s === 'opencode' ? 'OC' : s === 'codex' ? 'CD' : '?').join(', ');
    const cmd = mcp.command ? mcp.command.split(' ')[0] : '-';
    lines.push(`| ${mcp.id} | ${agents} | ${mcp.transport} | \`${cmd}\` | ${mcp.hasSensitiveEnv ? '⚠️' : ''} |`);
  }
  lines.push('');

  const definitions = [...enrichedInventory.mcpServers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap(mcp => (mcp.definitions ?? []).map(definition => ({ mcpId: mcp.id, definition })));
  if (definitions.length > 0) {
    lines.push('### MCP Definition Evidence');
    lines.push('');
    lines.push('| Server | Agent | Transport | Command | Host | Sensitive Env | Scope |');
    lines.push('|--------|-------|-----------|---------|------|---------------|-------|');
    for (const { mcpId, definition } of definitions) {
      lines.push(`| ${escapeMarkdownTableCell(mcpId)} | ${escapeMarkdownTableCell(definition.agentName)} | ${escapeMarkdownTableCell(definition.transport)} | ${formatValue(definition.command)} | ${formatValue(definition.host)} | ${definition.hasSensitiveEnv ? 'yes' : 'no'} | ${escapeMarkdownTableCell(formatScope(definition.scope))} |`);
    }
    lines.push('');
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, lines.join('\n'), 'utf-8');
}

function withAgentSupport(inventory: Inventory): Inventory {
  return {
    ...inventory,
    agents: inventory.agents.map(agent => ({
      ...agent,
      support: resolveAgentSupport(agent),
    })),
  };
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

function formatValue(value: string | undefined): string {
  return value ? `\`${escapeMarkdownTableCell(value)}\`` : '-';
}

function formatScope(scope: { kind: string; id?: string } | undefined): string {
  if (!scope) return '-';
  return scope.id ? `${scope.kind}:${scope.id}` : scope.kind;
}

export async function writeAllReports(inventory: Inventory, audit: AuditReport, baseDir: string): Promise<void> {
  const enrichedInventory = withAgentSupport(inventory);
  await Promise.all([
    writeInventoryJson(enrichedInventory, join(baseDir, 'inventory-current.json')),
    writeInventoryMarkdown(enrichedInventory, join(baseDir, 'inventory-current.md')),
    writeAuditMarkdown(audit, join(baseDir, 'audit-current.md')),
    writeDashboardHtml(enrichedInventory, audit, join(baseDir, 'dashboard.html')),
  ]);
}

export async function writeDashboardHtml(inventory: Inventory, audit: AuditReport, outPath: string): Promise<void> {
  const enrichedInventory = withAgentSupport(inventory);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, renderDashboardHtml(enrichedInventory, audit), 'utf-8');
}
