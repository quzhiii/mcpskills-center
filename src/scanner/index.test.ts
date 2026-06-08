import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BaseScanner } from './base.js';
import { runInventory } from './index.js';
import type { AgentConfig, MCPServer, Skill } from '../types/index.js';
import type { ScannerRegistry } from './registry.js';

class StubScanner extends BaseScanner {
  constructor(
    config: AgentConfig,
    private readonly mcpServers: MCPServer[]
  ) {
    super(config);
  }

  async scanSkills(): Promise<Skill[]> {
    return [];
  }

  async scanMCP(): Promise<MCPServer[]> {
    return this.mcpServers;
  }
}

function makeAgent(name: string): AgentConfig {
  return {
    name,
    configDir: `C:/${name}`,
    skillsDir: `C:/${name}/skills`,
  };
}

function makeMcp(agentName: string, command: string): MCPServer {
  return {
    id: 'filesystem',
    agentSources: [agentName],
    transport: 'stdio',
    command,
    isDuplicate: false,
    isEnabled: true,
    canStart: null,
    hasSensitiveEnv: false,
  };
}

test('runInventory preserves per-agent MCP definition evidence when deduplicating servers', async () => {
  const agents = [makeAgent('claude-code'), makeAgent('opencode')];
  const mcpByAgent: Record<string, MCPServer[]> = {
    'claude-code': [makeMcp('claude-code', 'npx')],
    opencode: [makeMcp('opencode', 'node')],
  };
  const registry: ScannerRegistry = {
    createScanner(agent: AgentConfig): BaseScanner {
      return new StubScanner(agent, mcpByAgent[agent.name] ?? []);
    },
  };

  const inventory = await runInventory(agents, registry);

  assert.equal(inventory.mcpServers.length, 1);
  const [mcp] = inventory.mcpServers;
  assert.equal(mcp.id, 'filesystem');
  assert.equal(mcp.isDuplicate, true);
  assert.deepEqual(mcp.agentSources, ['claude-code', 'opencode']);
  assert.deepEqual(
    mcp.definitions?.map(definition => ({
      agentName: definition.agentName,
      transport: definition.transport,
      command: definition.command,
      host: definition.host,
      isEnabled: definition.isEnabled,
      canStart: definition.canStart,
      hasSensitiveEnv: definition.hasSensitiveEnv,
    })),
    [
      {
        agentName: 'claude-code',
        transport: 'stdio',
        command: 'npx',
        host: undefined,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
      {
        agentName: 'opencode',
        transport: 'stdio',
        command: 'node',
        host: undefined,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
    ]
  );
});
