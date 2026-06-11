import { resolve } from 'node:path';
import { normalizeRoot } from '../fs-utils.js';
import { describeAgentSupport } from '../agents/support.js';

interface McpApplyTarget {
  targetConfigPath: string;
}

export function assertMcpApplyConfirm(confirm: boolean): void {
  if (!confirm) {
    throw new Error('Applying an MCP plan requires --confirm');
  }
}

export function assertMcpApplyPathsWithinApprovedRoots(
  targets: McpApplyTarget[],
  approvedRoots: string[],
): void {
  const resolvedRoots = approvedRoots.map(r => normalizeRoot(r));
  for (const target of targets) {
    const resolvedTarget = resolve(target.targetConfigPath).toLowerCase();
    const isWithinRoot = resolvedRoots.some(root => resolvedTarget === root || resolvedTarget.startsWith(root + '\\') || resolvedTarget.startsWith(root + '/'));
    if (!isWithinRoot) {
      throw new Error(
        `MCP apply target path outside approved roots: ${target.targetConfigPath}`
      );
    }
  }
}

export function assertMcpWriteBoundaryAllowed(agentName: string): void {
  const support = describeAgentSupport(agentName);
  if (support.mcpApplySupport !== 'write-ready') {
    throw new Error(
      `Agent "${agentName}" is not eligible for MCP writes (mcpApplySupport: ${support.mcpApplySupport})`
    );
  }
}
