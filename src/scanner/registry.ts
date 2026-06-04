import { ClaudeCodeScanner } from './claude-code.js';
import { CodexScanner } from './codex.js';
import { OpenCodeScanner } from './opencode.js';
import type { BaseScanner } from './base.js';
import type { AgentConfig } from '../types/index.js';

export type ScannerFactory = (agent: AgentConfig) => BaseScanner;

export interface ScannerRegistry {
  createScanner(agent: AgentConfig): BaseScanner | null;
}

export function createScannerRegistry(entries: Array<[string, ScannerFactory]>): ScannerRegistry {
  const factories = new Map(entries);

  return {
    createScanner(agent: AgentConfig): BaseScanner | null {
      const scannerType = agent.scannerType ?? agent.name;
      const factory = factories.get(scannerType);
      return factory ? factory(agent) : null;
    },
  };
}

export function createDefaultScannerRegistry(): ScannerRegistry {
  return createScannerRegistry([
    ['claude-code', agent => new ClaudeCodeScanner(agent)],
    ['opencode', agent => new OpenCodeScanner(agent)],
    ['codex', agent => new CodexScanner(agent)],
  ]);
}
