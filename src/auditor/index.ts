import type { Inventory, AuditReport, AuditIssue } from '../types/index.js';

export function runAudit(inventory: Inventory): AuditReport {
  const issues: AuditIssue[] = [];

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
