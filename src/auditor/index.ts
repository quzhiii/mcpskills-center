import type { Inventory, AuditReport, AuditIssue, AuditRecommendation } from '../types/index.js';

export function runAudit(inventory: Inventory): AuditReport {
  const issues: AuditIssue[] = [];
  const recommendations: AuditRecommendation[] = [];

  // Check duplicate skills
  for (const skill of inventory.skills) {
    if (skill.agentInstallPaths.length > 1) {
      issues.push({
        type: 'duplicate-skill',
        severity: 'warning',
        item: skill.id,
        agents: skill.agentInstallPaths.map(p => extractAgentName(p)),
        description: `Skill "${skill.id}" is installed in ${skill.agentInstallPaths.length} agents`,
        suggestion: 'Consider using canonical store with symlinks to avoid duplication',
      });
      recommendations.push({
        category: 'merge',
        targetType: 'skill',
        targetId: skill.id,
        severity: 'warning',
        reason: `Skill is installed in ${skill.agentInstallPaths.length} agent locations`,
        suggestedAction: 'Plan consolidation through a canonical skills store before changing files',
        requiresWrite: true,
      });
    }

    if (!skill.hasSkillMd) {
      issues.push({
        type: 'missing-skill-md',
        severity: 'error',
        item: skill.id,
        agents: skill.agentInstallPaths.map(p => extractAgentName(p)),
        description: `Skill "${skill.id}" is missing SKILL.md`,
        suggestion: 'Add a valid SKILL.md file or remove the incomplete skill',
      });
      recommendations.push({
        category: 'remove',
        targetType: 'skill',
        targetId: skill.id,
        severity: 'error',
        reason: 'Skill directory is incomplete because SKILL.md is missing',
        suggestedAction: 'Remove the incomplete skill or add a valid SKILL.md after manual review',
        requiresWrite: true,
      });
    }

    if (skill.hasSkillMd && !skill.frontmatterValid) {
      issues.push({
        type: 'invalid-frontmatter',
        severity: 'warning',
        item: skill.id,
        agents: skill.agentInstallPaths.map(p => extractAgentName(p)),
        description: `Skill "${skill.id}" has invalid or missing frontmatter in SKILL.md`,
        suggestion: 'Ensure SKILL.md starts with valid YAML frontmatter containing name and description',
      });
      recommendations.push({
        category: 'manual-review',
        targetType: 'skill',
        targetId: skill.id,
        severity: 'warning',
        reason: 'SKILL.md exists but frontmatter is invalid or incomplete',
        suggestedAction: 'Review SKILL.md and add name/description frontmatter before synchronization',
        requiresWrite: true,
      });
    }

    if (skill.isSymlink) {
      issues.push({
        type: 'broken-symlink',
        severity: 'info',
        item: skill.id,
        agents: skill.agentInstallPaths.map(p => extractAgentName(p)),
        description: `Skill "${skill.id}" is a symlink`,
        suggestion: 'Verify symlink target is valid and accessible',
      });
      recommendations.push({
        category: 'manual-review',
        targetType: 'skill',
        targetId: skill.id,
        severity: 'info',
        reason: 'Skill path is a symlink and target validity is not yet checked',
        suggestedAction: 'Verify the symlink target before applying canonical-store changes',
        requiresWrite: false,
      });
    }
  }

  // Check duplicate MCPs
  for (const mcp of inventory.mcpServers) {
    if (mcp.agentSources.length > 1) {
      issues.push({
        type: 'duplicate-mcp',
        severity: 'info',
        item: mcp.id,
        agents: mcp.agentSources,
        description: `MCP server "${mcp.id}" is configured in ${mcp.agentSources.length} agents`,
        suggestion: 'Review if all agents need this MCP or if it should be consolidated',
      });
      recommendations.push({
        category: 'merge',
        targetType: 'mcp-server',
        targetId: mcp.id,
        severity: 'info',
        reason: `MCP server is configured in ${mcp.agentSources.length} agents`,
        suggestedAction: 'Decide whether this MCP should stay duplicated or be managed by a shared profile',
        requiresWrite: false,
      });
    }

    if (mcp.hasSensitiveEnv) {
      issues.push({
        type: 'sensitive-env',
        severity: 'warning',
        item: mcp.id,
        agents: mcp.agentSources,
        description: `MCP server "${mcp.id}" has sensitive environment variables`,
        suggestion: 'Review env vars for exposed keys; ensure they are managed securely',
      });
      recommendations.push({
        category: 'manual-review',
        targetType: 'mcp-server',
        targetId: mcp.id,
        severity: 'warning',
        reason: 'MCP server has environment variable names that look sensitive',
        suggestedAction: 'Confirm secrets are stored securely and never copied into generated reports',
        requiresWrite: false,
      });
    }
  }

  const duplicateSkills = issues.filter(i => i.type === 'duplicate-skill').length;
  const duplicateMcps = issues.filter(i => i.type === 'duplicate-mcp').length;
  const missingSkillMds = issues.filter(i => i.type === 'missing-skill-md').length;
  const brokenSymlinks = issues.filter(i => i.type === 'broken-symlink').length;
  const sensitiveEnvs = issues.filter(i => i.type === 'sensitive-env').length;

  return {
    generatedAt: new Date().toISOString(),
    inventory,
    issues,
    recommendations,
    summary: {
      totalSkills: inventory.skills.length,
      totalMcpServers: inventory.mcpServers.length,
      duplicateSkills,
      duplicateMcps,
      missingSkillMds,
      brokenSymlinks,
      sensitiveEnvs,
    },
  };
}

function extractAgentName(path: string): string {
  if (path.includes('claude')) return 'claude-code';
  if (path.includes('opencode')) return 'opencode';
  if (path.includes('codex')) return 'codex';
  return 'unknown';
}
