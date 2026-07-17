import { dirname } from 'node:path';
import { loadAgentRegistry } from './agents.js';
import { loadSyncConfig } from './sync.js';
import { resolveEffectiveConfigPaths, type ConfigSource } from './user-config.js';
import { loadProfiles } from '../profiles/loader.js';
import { loadRoutingPolicy } from '../routing/policy.js';
import { createDefaultScannerRegistry } from '../scanner/registry.js';
import type { DefaultPaths } from './paths.js';
import type { AgentConfig } from '../types/index.js';

export type DiagnosticStatus = 'ok' | 'warning' | 'error' | 'skipped';
export type ConfigSurface = 'agents' | 'sync' | 'profiles' | 'routing';

export interface ConfigDiagnostic {
  id: string;
  surface: ConfigSurface;
  status: DiagnosticStatus;
  message: string;
  remediation?: string;
}

export async function validateConfiguration(
  paths: DefaultPaths,
  defaultAgents: AgentConfig[],
): Promise<ConfigDiagnostic[]> {
  const effective = await resolveEffectiveConfigPaths(paths);
  const diagnostics: ConfigDiagnostic[] = [];
  let agents: AgentConfig[] = [];

  try {
    agents = effective.agents.path
      ? (await loadAgentRegistry(effective.agents.path, defaultAgents, {
          baseDir: dirname(effective.agents.path),
          homeDir: paths.homeDir,
        })).agents
      : defaultAgents;
    diagnostics.push(ok('agents.config', 'agents', effective.agents.source));
    const scanners = createDefaultScannerRegistry();
    for (const agent of agents) {
      if (!scanners.createScanner(agent)) {
        diagnostics.push({
          id: `agents.scanner.${agent.id ?? agent.name}`,
          surface: 'agents',
          status: 'error',
          message: `Agent ${agent.id ?? agent.name} uses an unregistered scanner type.`,
          remediation: 'Use one of the scanner types bundled with MCPskills Center.',
        });
      }
    }
  } catch {
    diagnostics.push(invalid('agents.config', 'agents', effective.agents.source));
  }

  try {
    if (effective.sync.path) {
      await loadSyncConfig(effective.sync.path, paths.approvedSyncRoots, {
        baseDir: dirname(effective.sync.path),
        homeDir: paths.homeDir,
      });
    }
    diagnostics.push(ok('sync.config', 'sync', effective.sync.source));
  } catch {
    diagnostics.push(invalid('sync.config', 'sync', effective.sync.source));
  }

  try {
    const profiles = await loadProfiles(effective.profiles.path);
    const names = new Set<string>();
    for (const profile of profiles) {
      if (names.has(profile.name)) throw new Error('Duplicate profile name');
      names.add(profile.name);
    }
    diagnostics.push(ok('profiles.config', 'profiles', effective.profiles.source));
  } catch {
    diagnostics.push(invalid('profiles.config', 'profiles', effective.profiles.source));
  }

  try {
    const policy = await loadRoutingPolicy(effective.routingPolicy.path);
    const knownAgents = new Set(agents.map(agent => agent.id ?? agent.name));
    const references = new Set([
      ...policy.fallbackOrder,
      ...policy.taskCategories.flatMap(category => [
        ...category.eligibleAgents,
        ...(category.preferredAgent ? [category.preferredAgent] : []),
      ]),
    ]);
    const unknownReferences = [...references].filter(agent => !knownAgents.has(agent));
    if (unknownReferences.length > 0) {
      diagnostics.push({
        id: 'routing.agent-references',
        surface: 'routing',
        status: 'error',
        message: 'Routing policy references agents that are not enabled in the effective registry.',
        remediation: 'Enable the referenced agents or remove them from the routing policy.',
      });
    } else {
      diagnostics.push(ok('routing.config', 'routing', effective.routingPolicy.source));
    }
  } catch {
    diagnostics.push(invalid('routing.config', 'routing', effective.routingPolicy.source));
  }

  return diagnostics;
}

function ok(id: string, surface: ConfigSurface, source: ConfigSource): ConfigDiagnostic {
  return {
    id,
    surface,
    status: 'ok',
    message: `Effective ${surface} configuration is valid (source: ${source}).`,
  };
}

function invalid(id: string, surface: ConfigSurface, source: ConfigSource): ConfigDiagnostic {
  return {
    id,
    surface,
    status: 'error',
    message: `Effective ${surface} configuration is invalid or unreadable (source: ${source}).`,
    remediation: `Run mcpskills config path and repair the effective ${surface} configuration.`,
  };
}
