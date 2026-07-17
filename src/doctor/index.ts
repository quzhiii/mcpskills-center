import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { DefaultPaths } from '../config/paths.js';
import { loadAgentRegistry } from '../config/agents.js';
import { resolveEffectiveConfigPaths } from '../config/user-config.js';
import { validateConfiguration, type ConfigDiagnostic, type DiagnosticStatus } from '../config/validate.js';
import type { AgentConfig } from '../types/index.js';

export interface DoctorDiagnostic {
  id: string;
  status: DiagnosticStatus;
  message: string;
  remediation?: string;
}

export interface DoctorReport {
  diagnostics: DoctorDiagnostic[];
}

export interface DoctorOptions {
  nodeVersion: string;
  defaultAgents: AgentConfig[];
}

export async function runDoctor(paths: DefaultPaths, options: DoctorOptions): Promise<DoctorReport> {
  const diagnostics: DoctorDiagnostic[] = [checkNodeVersion(options.nodeVersion)];
  const configDiagnostics = await validateConfiguration(paths, options.defaultAgents);
  diagnostics.push(...configDiagnostics.map(toDoctorDiagnostic));

  const storageChecks: Array<[string, string]> = [
    ['storage.reports', paths.reportsDir],
    ['storage.backups', paths.backupsDir],
    ['storage.data', paths.dataDir],
    ['storage.canonical-skills', paths.canonicalSkillsDir],
  ];
  for (const [id, path] of storageChecks) {
    diagnostics.push(await checkStoragePath(id, path));
  }

  const effective = await resolveEffectiveConfigPaths(paths);
  try {
    const agents = effective.agents.path
      ? (await loadAgentRegistry(effective.agents.path, options.defaultAgents, {
          baseDir: dirname(effective.agents.path),
          homeDir: paths.homeDir,
        })).agents
      : options.defaultAgents;
    for (const agent of agents) diagnostics.push(await checkAgent(agent));
  } catch {
    diagnostics.push({
      id: 'agents.status',
      status: 'skipped',
      message: 'Agent installation checks were skipped because the effective registry is invalid.',
      remediation: 'Repair the effective agents configuration first.',
    });
  }

  diagnostics.push({
    id: 'privacy.secrets',
    status: 'ok',
    message: 'No secret values were inspected or included.',
  });

  return { diagnostics };
}

export function renderDoctorReport(report: DoctorReport): string {
  const counts: Record<DiagnosticStatus, number> = { ok: 0, warning: 0, error: 0, skipped: 0 };
  for (const diagnostic of report.diagnostics) counts[diagnostic.status] += 1;

  return [
    'MCPskills Center doctor:',
    ...report.diagnostics.map(diagnostic => {
      const remediation = diagnostic.remediation ? ` Fix: ${diagnostic.remediation}` : '';
      return `   [${diagnostic.status.toUpperCase()}] ${diagnostic.message}${remediation}`;
    }),
    '',
    `Summary: ${counts.ok} ok, ${counts.warning} warning, ${counts.error} error, ${counts.skipped} skipped`,
  ].join('\n');
}

function checkNodeVersion(version: string): DoctorDiagnostic {
  const match = /^v?(\d+)/.exec(version);
  const major = match ? Number(match[1]) : Number.NaN;
  if ([20, 22, 24].includes(major)) {
    return { id: 'runtime.node', status: 'ok', message: `Node.js ${major} is supported and covered by CI.` };
  }
  if ([23, 25, 26].includes(major)) {
    return {
      id: 'runtime.node',
      status: 'warning',
      message: `Node.js ${major} is supported but is not covered by the CI matrix.`,
      remediation: 'Prefer Node.js 20, 22, or 24 for the most tested experience.',
    };
  }
  return {
    id: 'runtime.node',
    status: 'error',
    message: 'The current Node.js major version is unsupported or could not be determined.',
    remediation: 'Install Node.js 20, 22, or 24.',
  };
}

async function checkStoragePath(id: string, path: string): Promise<DoctorDiagnostic> {
  try {
    const existing = await findExistingAncestor(path);
    const info = await stat(existing);
    if (!info.isDirectory()) throw new Error('Not a directory');
    await access(existing, constants.W_OK);
    return {
      id,
      status: 'ok',
      message: existing === path
        ? `Storage directory is writable: ${path}`
        : `Storage directory can be created under writable parent: ${existing}`,
    };
  } catch {
    return {
      id,
      status: 'error',
      message: `Storage path is not writable or accessible: ${path}`,
      remediation: 'Check the path and parent directory permissions.',
    };
  }
}

async function findExistingAncestor(path: string): Promise<string> {
  let candidate = path;
  while (true) {
    try {
      await stat(candidate);
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const parent = dirname(candidate);
      if (parent === candidate) throw error;
      candidate = parent;
    }
  }
}

async function checkAgent(agent: AgentConfig): Promise<DoctorDiagnostic> {
  const id = agent.id ?? agent.name;
  try {
    const info = await stat(agent.configDir);
    if (!info.isDirectory()) throw new Error('Not a directory');
    await access(agent.configDir, constants.R_OK);
    return { id: `agent.${id}`, status: 'ok', message: `Agent ${id} configuration directory is readable.` };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { id: `agent.${id}`, status: 'skipped', message: `Optional agent ${id} is not installed at its configured path.` };
    }
    return {
      id: `agent.${id}`,
      status: 'error',
      message: `Agent ${id} configuration directory is inaccessible.`,
      remediation: 'Check the configured path and filesystem permissions.',
    };
  }
}

function toDoctorDiagnostic(diagnostic: ConfigDiagnostic): DoctorDiagnostic {
  return {
    id: diagnostic.id,
    status: diagnostic.status,
    message: diagnostic.message,
    remediation: diagnostic.remediation,
  };
}
