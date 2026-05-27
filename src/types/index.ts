export interface AgentConfig {
  name: string;
  configDir: string;
  skillsDir: string;
  mcpConfigFile?: string;
  pluginsDir?: string;
}

export interface Skill {
  id: string;
  displayName: string;
  sourcePath: string;
  agentInstallPaths: string[];
  isCanonical: boolean;
  isSymlink: boolean;
  hasSkillMd: boolean;
  frontmatterValid: boolean;
  isDuplicate: boolean;
  lastModified?: Date;
}

export interface MCPServer {
  id: string;
  agentSources: string[];
  transport: 'stdio' | 'http' | 'sse' | 'unknown';
  command?: string;
  host?: string;
  isDuplicate: boolean;
  isEnabled: boolean;
  canStart: boolean | null;
  hasSensitiveEnv: boolean;
}

export interface Profile {
  name: string;
  description: string;
  mcpServers: string[];
  skills: string[];
}

export interface Inventory {
  generatedAt: string;
  agents: AgentConfig[];
  skills: Skill[];
  mcpServers: MCPServer[];
  profiles: Profile[];
}

export interface AuditIssue {
  type: 'duplicate-skill' | 'duplicate-mcp' | 'missing-skill-md' | 'invalid-frontmatter' | 'broken-symlink' | 'sensitive-env' | 'orphaned-skill' | 'unavailable-mcp';
  severity: 'error' | 'warning' | 'info';
  item: string;
  agents: string[];
  description: string;
  suggestion: string;
}

export interface AuditReport {
  generatedAt: string;
  inventory: Inventory;
  issues: AuditIssue[];
  summary: {
    totalSkills: number;
    totalMcpServers: number;
    duplicateSkills: number;
    duplicateMcps: number;
    missingSkillMds: number;
    brokenSymlinks: number;
    sensitiveEnvs: number;
  };
}
