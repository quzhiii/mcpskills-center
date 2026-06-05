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
  {
    agentId: 'qoder',
    displayName: 'Qoder',
    relativePaths: ['.qoder', 'AppData/Roaming/Qoder', 'AppData/Local/Qoder', '.config/qoder'],
    confirmFiles: ['config.json', 'settings.json'],
    confirmFilesByPath: {
      'AppData/Roaming/Qoder': ['User/settings.json', 'User/app.json'],
    },
  },
  {
    agentId: 'qoder-work',
    displayName: 'Qoder Work',
    relativePaths: ['.qoderworkcn', '.qoder-work', 'AppData/Roaming/QoderWork CN', 'AppData/Roaming/Qoder Work', 'AppData/Local/Qoder Work', '.config/qoder-work'],
    confirmFiles: ['config.json', 'settings.json'],
    confirmFilesByPath: {
      '.qoderworkcn': ['.qoder.json'],
      'AppData/Roaming/QoderWork CN': ['.builtin-defaults-state-v3.json', 'versions.json'],
    },
    manualReviewOnMultipleConfirmed: true,
  },
  { agentId: 'codebuddy', displayName: 'CodeBuddy', relativePaths: ['.codebuddy', 'AppData/Roaming/CodeBuddy', 'AppData/Local/CodeBuddy', '.config/codebuddy'], confirmFiles: ['config.json', 'settings.json'] },
  { agentId: 'workbuddy', displayName: 'WorkBuddy', relativePaths: ['.workbuddy', 'AppData/Roaming/WorkBuddy', 'AppData/Local/WorkBuddy', '.config/workbuddy'], confirmFiles: ['config.json', 'settings.json'] },
  {
    agentId: 'trae',
    displayName: 'Trae',
    relativePaths: ['.trae', 'AppData/Roaming/Trae', 'AppData/Local/Trae', '.config/trae'],
    confirmFiles: ['config.json', 'settings.json'],
    confirmFilesByPath: {
      'AppData/Roaming/Trae': ['User/settings.json'],
      'AppData/Local/Trae': ['User/settings.json'],
    },
  },
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
  const checkedPaths = roots.flatMap(root => spec.relativePaths.map(relativePath => ({
    relativePath,
    candidatePath: join(root, relativePath),
  })));
  let firstCandidatePath: string | null = null;
  const confirmedPaths: Array<{ path: string; confirmFile: string }> = [];
  const ambiguousRelativePaths = new Set(['.qoderworkcn', '.qoder-work']);

  for (const { relativePath, candidatePath } of checkedPaths) {
    if (!(await pathExists(candidatePath))) continue;

    const pathSpecificConfirmFiles = spec.confirmFilesByPath?.[relativePath] ?? [];
    const confirmFiles = [...pathSpecificConfirmFiles, ...spec.confirmFiles];
    const foundConfirmFile = await findConfirmFile(candidatePath, confirmFiles);
    if (foundConfirmFile) {
      if (!spec.manualReviewOnMultipleConfirmed) {
        return {
          agentId: spec.agentId,
          displayName: spec.displayName,
          status: 'confirmed',
          path: candidatePath,
          reason: `Found ${foundConfirmFile}`,
        };
      }

      confirmedPaths.push({ path: candidatePath, confirmFile: foundConfirmFile });
      continue;
    }

    firstCandidatePath ??= candidatePath;
  }

  if (confirmedPaths.length === 1) {
    return {
      agentId: spec.agentId,
      displayName: spec.displayName,
      status: 'confirmed',
      path: confirmedPaths[0].path,
      reason: `Found ${confirmedPaths[0].confirmFile}`,
    };
  }

  if (confirmedPaths.length > 1) {
    const shouldManualReview = spec.manualReviewOnMultipleConfirmed
      && confirmedPaths.some(item => ambiguousRelativePaths.has(extractRelativePath(item.path, checkedPaths)));

    if (!shouldManualReview) {
      return {
        agentId: spec.agentId,
        displayName: spec.displayName,
        status: 'confirmed',
        path: confirmedPaths[0].path,
        reason: `Found ${confirmedPaths[0].confirmFile}`,
      };
    }

    return {
      agentId: spec.agentId,
      displayName: spec.displayName,
      status: 'candidate',
      paths: confirmedPaths.map(item => item.path),
      reason: 'Multiple known config roots were confirmed; manual review needed',
    };
  }

  if (firstCandidatePath) {
    return {
      agentId: spec.agentId,
      displayName: spec.displayName,
      status: 'candidate',
      path: firstCandidatePath,
      reason: 'Directory exists but no known config file was found',
    };
  }

    return {
      agentId: spec.agentId,
      displayName: spec.displayName,
      status: 'missing',
      path: checkedPaths[0]?.candidatePath ?? '',
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

function extractRelativePath(
  candidatePath: string,
  checkedPaths: Array<{ relativePath: string; candidatePath: string }>
): string {
  return checkedPaths.find(item => item.candidatePath === candidatePath)?.relativePath ?? '';
}
