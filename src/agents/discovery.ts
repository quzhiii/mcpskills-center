import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentDiscoveryCandidate, AgentDiscoveryReport, AgentDiscoverySpec } from '../types/index.js';

export interface DiscoverAgentsOptions {
  generatedAt?: string;
  roots?: string[];
  specs?: AgentDiscoverySpec[];
}

export const DEFAULT_AGENT_DISCOVERY_SPECS: AgentDiscoverySpec[] = [
  { agentId: 'qoder', displayName: 'Qoder', relativePaths: ['.qoder', 'AppData/Roaming/Qoder', 'AppData/Local/Qoder', '.config/qoder'], confirmFiles: ['config.json', 'settings.json'] },
  { agentId: 'qoder-work', displayName: 'Qoder Work', relativePaths: ['.qoder-work', 'AppData/Roaming/Qoder Work', 'AppData/Local/Qoder Work', '.config/qoder-work'], confirmFiles: ['config.json', 'settings.json'] },
  { agentId: 'codebuddy', displayName: 'CodeBuddy', relativePaths: ['.codebuddy', 'AppData/Roaming/CodeBuddy', 'AppData/Local/CodeBuddy', '.config/codebuddy'], confirmFiles: ['config.json', 'settings.json'] },
  { agentId: 'workbuddy', displayName: 'WorkBuddy', relativePaths: ['.workbuddy', 'AppData/Roaming/WorkBuddy', 'AppData/Local/WorkBuddy', '.config/workbuddy'], confirmFiles: ['config.json', 'settings.json'] },
  { agentId: 'trae', displayName: 'Trae', relativePaths: ['.trae', 'AppData/Roaming/Trae', 'AppData/Local/Trae', '.config/trae'], confirmFiles: ['config.json', 'settings.json'] },
];

export async function discoverAgents(options: DiscoverAgentsOptions = {}): Promise<AgentDiscoveryReport> {
  const roots = options.roots ?? [homedir()];
  const specs = options.specs ?? DEFAULT_AGENT_DISCOVERY_SPECS;
  const candidates: AgentDiscoveryCandidate[] = [];

  for (const spec of specs) {
    candidates.push(await discoverSpec(spec, roots));
  }

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    candidates,
  };
}

async function discoverSpec(spec: AgentDiscoverySpec, roots: string[]): Promise<AgentDiscoveryCandidate> {
  const checkedPaths = roots.flatMap(root => spec.relativePaths.map(relativePath => join(root, relativePath)));

  for (const candidatePath of checkedPaths) {
    if (!(await pathExists(candidatePath))) continue;

    const foundConfirmFile = await findConfirmFile(candidatePath, spec.confirmFiles);
    if (foundConfirmFile) {
      return {
        agentId: spec.agentId,
        displayName: spec.displayName,
        status: 'confirmed',
        path: candidatePath,
        reason: `Found ${foundConfirmFile}`,
      };
    }

    return {
      agentId: spec.agentId,
      displayName: spec.displayName,
      status: 'candidate',
      path: candidatePath,
      reason: 'Directory exists but no known config file was found',
    };
  }

  return {
    agentId: spec.agentId,
    displayName: spec.displayName,
    status: 'missing',
    path: checkedPaths[0] ?? '',
    reason: 'No known path exists',
  };
}

async function findConfirmFile(root: string, confirmFiles: string[]): Promise<string | null> {
  for (const fileName of confirmFiles) {
    if (await pathExists(join(root, fileName))) return fileName;
  }

  return null;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
