export interface AgentConfig {
  name: string;
  id?: string;
  displayName?: string;
  vendor?: string;
  scannerType?: string;
  enabled?: boolean;
  readOnly?: boolean;
  configDir: string;
  skillsDir: string;
  mcpConfigFile?: string;
  pluginsDir?: string;
}

export interface AgentRegistry {
  agents: AgentConfig[];
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
  agents: string[];
  mcpServers: string[];
  skills: string[];
  disabledMcpServers?: string[];
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

export interface AuditRecommendation {
  category: 'keep' | 'merge' | 'remove' | 'manual-review';
  targetType: 'skill' | 'mcp-server';
  targetId: string;
  severity: 'error' | 'warning' | 'info';
  reason: string;
  suggestedAction: string;
  requiresWrite: boolean;
}

export interface AuditReport {
  generatedAt: string;
  inventory: Inventory;
  issues: AuditIssue[];
  recommendations: AuditRecommendation[];
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

export interface SyncPlan {
  generatedAt: string;
  canonicalSkillsDir: string;
  strategy: 'symlink' | 'copy';
  actions: SyncAction[];
}

export interface SyncAction {
  id: string;
  type: 'copy-to-canonical' | 'link-to-agent' | 'copy-to-agent' | 'skip' | 'manual-review';
  skillId: string;
  agentName?: string;
  sourcePath?: string;
  targetPath?: string;
  reason: string;
  requiresWrite: boolean;
}

export interface SyncBackupManifest {
  generatedAt: string;
  entries: SyncBackupEntry[];
}

export interface SyncBackupEntry {
  actionId: string;
  targetPath: string;
  backupPath: string;
  capturedAt: string;
}

export interface ProfilePlan {
  generatedAt: string;
  profileName: string;
  actions: ProfilePlanAction[];
}

export interface ProfilePlanAction {
  id: string;
  type: 'enable' | 'disable' | 'missing' | 'already-present';
  targetType: 'skill' | 'mcp-server';
  targetId: string;
  reason: string;
  requiresWrite: boolean;
}
