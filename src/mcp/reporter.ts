import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { McpGovernanceAction, McpGovernancePlan } from '../types/index.js';

export interface McpGovernancePlanSummary {
  totalActions: number;
  writeActions: number;
  canonicalCandidates: number;
  manualReviewActions: number;
  actionTypes: Record<string, McpGovernancePlanSummaryCount>;
  agentImpact: Record<string, McpGovernancePlanSummaryCount>;
  envRiskPolicies: Record<string, number>;
}

export interface McpGovernancePlanSummaryCount {
  actions: number;
  writeActions: number;
  actionTypes: Record<string, number>;
}

export function buildMcpGovernancePlanSummary(plan: McpGovernancePlan): McpGovernancePlanSummary {
  const summary: McpGovernancePlanSummary = {
    totalActions: plan.actions.length,
    writeActions: plan.actions.filter(action => action.requiresWrite).length,
    canonicalCandidates: 0,
    manualReviewActions: 0,
    actionTypes: {},
    agentImpact: {},
    envRiskPolicies: {},
  };

  for (const action of plan.actions) {
    incrementSummary(summary.actionTypes, action.type, action);
    if (action.type === 'canonical-candidate') summary.canonicalCandidates += 1;
    if (action.type === 'manual-review') summary.manualReviewActions += 1;
    summary.envRiskPolicies[action.envRiskPolicy] = (summary.envRiskPolicies[action.envRiskPolicy] ?? 0) + 1;
    for (const agentName of action.agentNames) {
      incrementSummary(summary.agentImpact, agentName, action);
    }
  }

  return summary;
}

export function renderMcpGovernancePlanMarkdown(plan: McpGovernancePlan): string {
  const lines: string[] = [];
  const summary = buildMcpGovernancePlanSummary(plan);

  lines.push('# MCP Governance Dry-Run Plan');
  lines.push('');
  lines.push(`Generated: ${plan.generatedAt}`);
  lines.push('Mode: `dry-run`');
  lines.push('');
  lines.push(`Actions: ${plan.actions.length}`);
  lines.push(`Write Actions: ${summary.writeActions}`);
  lines.push('');
  lines.push('## Action Type Summary');
  lines.push('');
  lines.push('| Action Type | Actions | Write Actions |');
  lines.push('|-------------|---------|---------------|');
  for (const [actionType, count] of Object.entries(summary.actionTypes)) {
    lines.push(`| ${escapeMarkdownTableCell(actionType)} | ${count.actions} | ${count.writeActions} |`);
  }
  lines.push('');
  lines.push('## Manual Review Required');
  lines.push('');
  const manualReviewActions = plan.actions.filter(action => action.type === 'manual-review');
  if (manualReviewActions.length > 0) {
    lines.push('| MCP | Agents | Reason |');
    lines.push('|-----|--------|--------|');
    for (const action of manualReviewActions) {
      lines.push(`| ${escapeMarkdownTableCell(action.mcpId)} | ${escapeMarkdownTableCell(action.agentNames.join(', '))} | ${escapeMarkdownTableCell(action.reason)} |`);
    }
  } else {
    lines.push('No manual review actions.');
  }
  lines.push('');
  lines.push('## Canonical Profile Candidates');
  lines.push('');
  const canonicalCandidateActions = plan.actions.filter(action => action.canonicalProfileCandidate);
  if (canonicalCandidateActions.length > 0) {
    lines.push('| Profile | MCP | Source Agent | Target Agents | Blocked By Env Risk |');
    lines.push('|---------|-----|--------------|---------------|---------------------|');
    for (const action of canonicalCandidateActions) {
      const candidate = action.canonicalProfileCandidate;
      if (!candidate) continue;
      lines.push(`| ${escapeMarkdownTableCell(candidate.profileId)} | ${escapeMarkdownTableCell(candidate.mcpId)} | ${escapeMarkdownTableCell(candidate.sourceAgentName)} | ${escapeMarkdownTableCell(candidate.agentNames.join(', '))} | ${candidate.blockedByEnvRisk ? 'yes' : 'no'} |`);
    }
  } else {
    lines.push('No canonical profile candidates.');
  }
  lines.push('');
  lines.push('## Per-Agent Definitions');
  lines.push('');
  lines.push('| MCP | Agent | Transport | Command | Host | Sensitive Env |');
  lines.push('|-----|-------|-----------|---------|------|---------------|');
  for (const action of plan.actions) {
    for (const definition of action.definitions ?? []) {
      lines.push(`| ${escapeMarkdownTableCell(action.mcpId)} | ${escapeMarkdownTableCell(definition.agentName)} | ${escapeMarkdownTableCell(definition.transport)} | ${formatValue(definition.command)} | ${formatValue(definition.host)} | ${definition.hasSensitiveEnv ? 'yes' : 'no'} |`);
    }
  }
  lines.push('');
  lines.push('## Actions');
  lines.push('');
  lines.push('| Type | MCP | Agents | Canonical Candidate | Env Risk Policy | Requires Write | Reason |');
  lines.push('|------|-----|--------|---------------------|-----------------|----------------|--------|');
  for (const action of plan.actions) {
    lines.push(`| ${escapeMarkdownTableCell(action.type)} | ${escapeMarkdownTableCell(action.mcpId)} | ${escapeMarkdownTableCell(action.agentNames.join(', '))} | ${escapeMarkdownTableCell(action.canonicalAgentName ?? '-')} | ${escapeMarkdownTableCell(action.envRiskPolicy)} | ${action.requiresWrite ? 'yes' : 'no'} | ${escapeMarkdownTableCell(action.reason)} |`);
  }
  lines.push('');

  return lines.join('\n');
}

export async function writeMcpGovernancePlanReports(plan: McpGovernancePlan, reportsDir: string): Promise<void> {
  const jsonPath = join(reportsDir, 'mcp-governance-plan-current.json');
  const markdownPath = join(reportsDir, 'mcp-governance-plan-current.md');

  await mkdir(dirname(jsonPath), { recursive: true });
  await Promise.all([
    writeFile(jsonPath, JSON.stringify({ ...plan, summary: buildMcpGovernancePlanSummary(plan) }, null, 2), 'utf-8'),
    writeFile(markdownPath, renderMcpGovernancePlanMarkdown(plan), 'utf-8'),
  ]);
}

function incrementSummary(target: Record<string, McpGovernancePlanSummaryCount>, key: string, action: McpGovernanceAction): void {
  target[key] ??= { actions: 0, writeActions: 0, actionTypes: {} };
  target[key].actions += 1;
  if (action.requiresWrite) target[key].writeActions += 1;
  target[key].actionTypes[action.type] = (target[key].actionTypes[action.type] ?? 0) + 1;
}

function formatValue(value: string | undefined): string {
  return value ? `\`${escapeMarkdownTableCell(value)}\`` : '-';
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
