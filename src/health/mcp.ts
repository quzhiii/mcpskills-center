import { spawn } from 'node:child_process';
import type { EventEmitter } from 'node:events';
import type { MCPServer } from '../types/index.js';

export interface MCPHealthResult {
  serverId: string;
  mode: 'passive' | 'active';
  status: 'ok' | 'warning' | 'error';
  canStart: boolean | null;
  hasSensitiveEnv: boolean;
  reasons: string[];
}

export interface ActiveMCPHealthOptions {
  allowCommands: string[];
  timeoutMs: number;
}

export type SpawnLike = (command: string, args: string[]) => EventEmitter & { kill: () => void };

export function evaluateMcpHealth(mcp: MCPServer): MCPHealthResult {
  const reasons: string[] = [];
  let status: MCPHealthResult['status'] = 'ok';
  let canStart: boolean | null = true;

  switch (mcp.transport) {
    case 'stdio':
      if (mcp.command) {
        status = 'warning';
        canStart = null;
        reasons.push('stdio command is configured; active check is required to prove it can start');
      } else {
        status = 'error';
        canStart = false;
        reasons.push('stdio MCP server is missing a command');
      }
      break;

    case 'http':
    case 'sse':
      if (!mcp.host) {
        status = 'warning';
        canStart = null;
        reasons.push(`${mcp.transport} MCP server is missing a URL/host`);
      } else if (isValidHttpUrl(mcp.host)) {
        reasons.push(`${mcp.transport} URL is valid`);
      } else {
        status = 'error';
        canStart = false;
        reasons.push(`${mcp.transport} MCP server has an invalid URL/host`);
      }
      break;

    case 'unknown':
      status = 'error';
      canStart = false;
      reasons.push('Unknown transport cannot be health checked');
      break;
  }

  if (mcp.hasSensitiveEnv) {
    reasons.push('Sensitive env keys are configured; values are not inspected or printed');
    if (status === 'ok') status = 'warning';
  }

  return {
    serverId: mcp.id,
    mode: 'passive',
    status,
    canStart,
    hasSensitiveEnv: mcp.hasSensitiveEnv,
    reasons,
  };
}

export async function runActiveMcpHealth(
  mcp: MCPServer,
  options: ActiveMCPHealthOptions,
  spawnLike: SpawnLike = defaultSpawn
): Promise<MCPHealthResult> {
  if (!mcp.command) {
    return createActiveResult(mcp, 'error', false, ['MCP server is missing a command']);
  }

  if (!options.allowCommands.includes(mcp.command)) {
    return createActiveResult(mcp, 'error', false, [`Command "${mcp.command}" is not in active health check allowlist`]);
  }

  const exitCode = await runVersionProbe(mcp.command, options.timeoutMs, spawnLike);
  if (exitCode === 0) {
    return createActiveResult(mcp, 'ok', true, ['Allowlisted command responded to --version']);
  }

  if (exitCode === null) {
    return createActiveResult(mcp, 'error', false, [`Allowlisted command timed out after ${options.timeoutMs}ms`]);
  }

  return createActiveResult(mcp, 'error', false, [`Allowlisted command exited with code ${exitCode}`]);
}

function createActiveResult(
  mcp: MCPServer,
  status: MCPHealthResult['status'],
  canStart: boolean,
  reasons: string[]
): MCPHealthResult {
  return {
    serverId: mcp.id,
    mode: 'active',
    status,
    canStart,
    hasSensitiveEnv: mcp.hasSensitiveEnv,
    reasons: mcp.hasSensitiveEnv
      ? [...reasons, 'Sensitive env keys are configured; values are not inspected or printed']
      : reasons,
  };
}

function runVersionProbe(command: string, timeoutMs: number, spawnLike: SpawnLike): Promise<number | null> {
  return new Promise(resolve => {
    let settled = false;
    const child = spawnLike(command, ['--version']);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      resolve(null);
    }, timeoutMs);

    child.once('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(typeof code === 'number' ? code : 1);
    });

    child.once('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(1);
    });
  });
}

function defaultSpawn(command: string, args: string[]): EventEmitter & { kill: () => void } {
  return spawn(command, args, {
    shell: false,
    stdio: 'ignore',
    windowsHide: true,
  });
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
