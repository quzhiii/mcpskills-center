import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { resolveAgentSupport } from '../agents/support.js';
import type { AgentConfig, McpGovernanceAction, McpGovernancePlan } from '../types/index.js';

export interface McpGovernancePlanSummary {
  totalActions: number;
  writeActions: number;
  canonicalCandidates: number;
  manualReviewActions: number;
  canonicalProfileEligible: number;
  canonicalProfileBlocked: number;
  canonicalProfileBlockers: Record<string, number>;
  writeReadyCandidates: number;
  restoreUnprovenAgentCount: number;
  lowOwnershipAgentCount: number;
  actionTypes: Record<string, McpGovernancePlanSummaryCount>;
  agentImpact: Record<string, McpGovernancePlanSummaryCount>;
  envRiskPolicies: Record<string, number>;
  canonicalTargetPolicies: Record<string, number>;
}

export interface McpGovernancePlanSummaryCount {
  actions: number;
  writeActions: number;
  actionTypes: Record<string, number>;
}

export function buildMcpGovernancePlanSummary(
  plan: McpGovernancePlan,
  agents: AgentConfig[] = []
): McpGovernancePlanSummary {
  const summary: McpGovernancePlanSummary = {
    totalActions: plan.actions.length,
    writeActions: plan.actions.filter(action => action.requiresWrite).length,
    canonicalCandidates: 0,
    manualReviewActions: 0,
    canonicalProfileEligible: 0,
    canonicalProfileBlocked: 0,
    canonicalProfileBlockers: {},
    writeReadyCandidates: 0,
    restoreUnprovenAgentCount: 0,
    lowOwnershipAgentCount: 0,
    actionTypes: {},
    agentImpact: {},
    envRiskPolicies: {},
    canonicalTargetPolicies: {},
  };

  const seenAgents = new Set<string>();
  const agentsByName = new Map(agents.map(agent => [agent.name, agent]));

  for (const action of plan.actions) {
    incrementSummary(summary.actionTypes, action.type, action);
    if (action.type === 'canonical-candidate') summary.canonicalCandidates += 1;
    if (action.type === 'manual-review') summary.manualReviewActions += 1;
    if (action.canonicalProfileCandidate) summary.canonicalProfileEligible += 1;
    if (action.type === 'canonical-candidate') {
      const allWriteReady = action.agentNames.every(agentName => {
        const support = resolveGovernanceAgentSupport(agentName, agentsByName);
        return support.mcpApplySupport === 'write-ready' && support.mcpRestoreSupport === 'write-ready';
      });
      if (allWriteReady) summary.writeReadyCandidates += 1;
    }
    if (action.canonicalProfileBlockers && action.canonicalProfileBlockers.length > 0) {
      summary.canonicalProfileBlocked += 1;
      for (const blocker of action.canonicalProfileBlockers) {
        summary.canonicalProfileBlockers[blocker] = (summary.canonicalProfileBlockers[blocker] ?? 0) + 1;
      }
    }
    summary.envRiskPolicies[action.envRiskPolicy] = (summary.envRiskPolicies[action.envRiskPolicy] ?? 0) + 1;
    if (action.canonicalTargetPolicy) {
      summary.canonicalTargetPolicies[action.canonicalTargetPolicy] = (summary.canonicalTargetPolicies[action.canonicalTargetPolicy] ?? 0) + 1;
    }
    for (const agentName of action.agentNames) {
      if (!seenAgents.has(agentName)) {
        seenAgents.add(agentName);
        const support = resolveGovernanceAgentSupport(agentName, agentsByName);
        if (support.mcpRestoreSupport === 'unproven') summary.restoreUnprovenAgentCount += 1;
        if (support.mcpConfigOwnershipConfidence === 'low') summary.lowOwnershipAgentCount += 1;
      }
      incrementSummary(summary.agentImpact, agentName, action);
    }
  }

  return summary;
}

export function renderMcpGovernancePlanMarkdown(
  plan: McpGovernancePlan,
  agents: AgentConfig[] = []
): string {
  const lines: string[] = [];
  const summary = buildMcpGovernancePlanSummary(plan, agents);

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
    lines.push('| MCP | Agents | Scope Policy | Canonical Profile Blockers | Reason |');
    lines.push('|-----|--------|--------------|----------------------------|--------|');
    for (const action of manualReviewActions) {
      lines.push(`| ${escapeMarkdownTableCell(action.mcpId)} | ${escapeMarkdownTableCell(action.agentNames.join(', '))} | ${escapeMarkdownTableCell(action.scopePolicy ?? '-')} | ${escapeMarkdownTableCell(formatBlockers(action.canonicalProfileBlockers))} | ${escapeMarkdownTableCell(action.reason)} |`);
    }
  } else {
    lines.push('No manual review actions.');
  }
  lines.push('');
  lines.push('## Canonical Profile Candidates');
  lines.push('');
  const canonicalCandidateActions = plan.actions.filter(action => action.canonicalProfileCandidate);
  if (canonicalCandidateActions.length > 0) {
    lines.push('| Profile | MCP | Source Agent | Target Agents | Status | Scope | Env Policy | Scope Policy | Canonical Target Policy | Canonical Target Reason | Eligibility Reason |');
    lines.push('|---------|-----|--------------|---------------|--------|-------|------------|--------------|-------------------------|-------------------------|--------------------|');
    for (const action of canonicalCandidateActions) {
      const candidate = action.canonicalProfileCandidate;
      if (!candidate) continue;
      lines.push(`| ${escapeMarkdownTableCell(candidate.profileId)} | ${escapeMarkdownTableCell(candidate.mcpId)} | ${escapeMarkdownTableCell(candidate.sourceAgentName)} | ${escapeMarkdownTableCell(candidate.agentNames.join(', '))} | ${escapeMarkdownTableCell(candidate.status ?? '-')} | ${escapeMarkdownTableCell(formatScope(candidate.scope))} | ${escapeMarkdownTableCell(candidate.envRiskPolicy ?? '-')} | ${escapeMarkdownTableCell(candidate.scopePolicy ?? '-')} | ${escapeMarkdownTableCell(action.canonicalTargetPolicy ?? candidate.canonicalTargetPolicy ?? '-')} | ${escapeMarkdownTableCell(action.canonicalTargetReason ?? candidate.canonicalTargetReason ?? '-')} | ${escapeMarkdownTableCell(candidate.eligibilityReason ?? '-')} |`);
    }
  } else {
    lines.push('No canonical profile candidates.');
  }
  lines.push('');
  lines.push('## Per-Agent Definitions');
  lines.push('');
  lines.push('| MCP | Agent | Transport | Command | Host | Sensitive Env | Scope |');
  lines.push('|-----|-------|-----------|---------|------|---------------|-------|');
  for (const action of plan.actions) {
    for (const definition of action.definitions ?? []) {
      lines.push(`| ${escapeMarkdownTableCell(action.mcpId)} | ${escapeMarkdownTableCell(definition.agentName)} | ${escapeMarkdownTableCell(definition.transport)} | ${formatValue(definition.command)} | ${formatValue(definition.host)} | ${definition.hasSensitiveEnv ? 'yes' : 'no'} | ${escapeMarkdownTableCell(formatScope(definition.scope))} |`);
    }
  }
  lines.push('');
  lines.push('## Actions');
  lines.push('');
  lines.push('| Type | MCP | Agents | Canonical Candidate | Env Risk Policy | Scope Policy | Canonical Profile Blockers | Requires Write | Reason |');
  lines.push('|------|-----|--------|---------------------|-----------------|--------------|----------------------------|----------------|--------|');
  for (const action of plan.actions) {
    lines.push(`| ${escapeMarkdownTableCell(action.type)} | ${escapeMarkdownTableCell(action.mcpId)} | ${escapeMarkdownTableCell(action.agentNames.join(', '))} | ${escapeMarkdownTableCell(action.canonicalAgentName ?? '-')} | ${escapeMarkdownTableCell(action.envRiskPolicy)} | ${escapeMarkdownTableCell(action.scopePolicy ?? '-')} | ${escapeMarkdownTableCell(formatBlockers(action.canonicalProfileBlockers))} | ${action.requiresWrite ? 'yes' : 'no'} | ${escapeMarkdownTableCell(action.reason)} |`);
  }
  lines.push('');
  lines.push('## Future Write Readiness');
  lines.push('');
  lines.push(`Write-ready candidates: ${summary.writeReadyCandidates}`);
  lines.push(`Restore-unproven agents: ${summary.restoreUnprovenAgentCount}`);
  lines.push(`Low-ownership agents: ${summary.lowOwnershipAgentCount}`);
  lines.push('');

  return lines.join('\n');
}

export async function writeMcpGovernancePlanReports(
  plan: McpGovernancePlan,
  reportsDir: string,
  agents: AgentConfig[] = []
): Promise<void> {
  const jsonPath = join(reportsDir, 'mcp-governance-plan-current.json');
  const markdownPath = join(reportsDir, 'mcp-governance-plan-current.md');

  await mkdir(dirname(jsonPath), { recursive: true });
  await Promise.all([
    writeFile(jsonPath, JSON.stringify({ ...plan, summary: buildMcpGovernancePlanSummary(plan, agents) }, null, 2), 'utf-8'),
    writeFile(markdownPath, renderMcpGovernancePlanMarkdown(plan, agents), 'utf-8'),
  ]);
}

function resolveGovernanceAgentSupport(
  agentName: string,
  agentsByName: ReadonlyMap<string, AgentConfig>
) {
  const agent = agentsByName.get(agentName);
  if (agent) return resolveAgentSupport(agent);

  return resolveAgentSupport({ name: agentName, id: agentName, scannerType: agentName });
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

function formatScope(scope: { kind: string; id?: string } | undefined): string {
  if (!scope) return '-';
  return scope.id ? `${scope.kind}:${scope.id}` : scope.kind;
}

function formatBlockers(blockers: string[] | undefined): string {
  return blockers && blockers.length > 0 ? blockers.join(', ') : 'none';
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
