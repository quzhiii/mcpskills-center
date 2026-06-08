import type { AgentSupportMetadata } from '../agents/support.js';

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
  support?: AgentSupportMetadata;
}

export interface AgentRegistry {
  agents: AgentConfig[];
}

export type AgentDiscoveryStatus = 'confirmed' | 'candidate' | 'missing' | 'unsupported';

export interface AgentDiscoveryCandidate {
  agentId: string;
  displayName: string;
  status: AgentDiscoveryStatus;
  path?: string;
  paths?: string[];
  reason: string;
  support?: AgentSupportMetadata;
}

export interface AgentDiscoveryReport {
  generatedAt: string;
  candidates: AgentDiscoveryCandidate[];
}

export interface AgentDiscoverySpec {
  agentId: string;
  displayName: string;
  relativePaths: string[];
  confirmFiles: string[];
  confirmFilesByPath?: Record<string, string[]>;
  manualReviewOnMultipleConfirmed?: boolean;
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
  definitions?: MCPServerDefinition[];
  transport: 'stdio' | 'http' | 'sse' | 'unknown';
  command?: string;
  host?: string;
  isDuplicate: boolean;
  isEnabled: boolean;
  canStart: boolean | null;
  hasSensitiveEnv: boolean;
}

export interface MCPServerDefinition {
  agentName: string;
  transport: MCPServer['transport'];
  command?: string;
  host?: string;
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
  type: 'promote-canonical' | 'distribute' | 'repair-metadata' | 'dedupe' | 'skip' | 'manual-review';
  skillId: string;
  agentName?: string;
  sourcePath?: string;
  targetPath?: string;
  sourceKind?: 'canonical-store' | 'agent-install' | 'external-import' | 'unknown';
  targetKind?: 'canonical-store' | 'agent-install' | 'unknown';
  mode?: 'symlink' | 'copy';
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

export type CapabilityPresence = 'present' | 'missing';

export interface CapabilityMatrixRow {
  capabilityId: string;
  capabilityType: 'skill' | 'mcp-server';
  presentAgents: string[];
  missingAgents: string[];
  agentStates: Record<string, CapabilityPresence>;
  isShared: boolean;
}

export interface CapabilityMatrix {
  generatedAt: string;
  agents: string[];
  skills: CapabilityMatrixRow[];
  mcpServers: CapabilityMatrixRow[];
  summary: {
    totalSkillCapabilities: number;
    totalMcpCapabilities: number;
    sharedSkills: number;
    sharedMcps: number;
  };
}
