import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BaseScanner } from './base.js';
import { createScannerRegistry, createDefaultScannerRegistry } from './registry.js';
import { runInventory } from './index.js';
import type { AgentConfig, MCPServer, Skill } from '../types/index.js';

class StubScanner extends BaseScanner {
  async scanSkills(): Promise<Skill[]> {
    return [
      {
        id: `${this.getAgentConfig().name}-skill`,
        displayName: `${this.getAgentConfig().name}-skill`,
        sourcePath: `${this.getAgentConfig().skillsDir}/skill`,
        agentInstallPaths: [`${this.getAgentConfig().skillsDir}/skill`],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: false,
      },
    ];
  }

  async scanMCP(): Promise<MCPServer[]> {
    return [];
  }
}

const agent: AgentConfig = {
  name: 'stub-agent',
  scannerType: 'stub',
  configDir: 'C:/stub/config',
  skillsDir: 'C:/stub/skills',
};

test('createScannerRegistry resolves registered scanner factories', () => {
  const registry = createScannerRegistry([
    ['stub', config => new StubScanner(config)],
  ]);

  const scanner = registry.createScanner(agent);

  assert.ok(scanner instanceof StubScanner);
  assert.equal(scanner.getAgentConfig().name, 'stub-agent');
});

test('createScannerRegistry returns null for unknown scanner types', () => {
  const registry = createScannerRegistry([]);

  const scanner = registry.createScanner(agent);

  assert.equal(scanner, null);
});

test('createDefaultScannerRegistry includes built-in scanners', () => {
  const registry = createDefaultScannerRegistry();

  assert.notEqual(registry.createScanner({ ...agent, name: 'claude-code', scannerType: 'claude-code' }), null);
  assert.notEqual(registry.createScanner({ ...agent, name: 'opencode', scannerType: 'opencode' }), null);
  assert.notEqual(registry.createScanner({ ...agent, name: 'codex', scannerType: 'codex' }), null);
  assert.notEqual(registry.createScanner({ ...agent, name: 'codebuddy', scannerType: 'codebuddy' }), null);
  assert.notEqual(registry.createScanner({ ...agent, name: 'workbuddy', scannerType: 'workbuddy' }), null);
  assert.notEqual(registry.createScanner({ ...agent, name: 'trae', scannerType: 'trae' }), null);
  assert.notEqual(registry.createScanner({ ...agent, name: 'qoder', scannerType: 'generic' }), null);
});

test('runInventory uses injected scanner registry and skips unknown scanners', async () => {
  const registry = createScannerRegistry([
    ['stub', config => new StubScanner(config)],
  ]);
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message?: unknown) => { warnings.push(String(message)); };

  try {
    const inventory = await runInventory([
      agent,
      { name: 'unknown-agent', scannerType: 'unknown', configDir: 'C:/unknown', skillsDir: 'C:/unknown/skills' },
    ], registry);

    assert.deepEqual(inventory.skills.map(skill => skill.id), ['stub-agent-skill']);
    assert.deepEqual(inventory.agents.map(item => item.name), ['stub-agent', 'unknown-agent']);
    assert.deepEqual(warnings, ['Unknown scanner type for agent: unknown-agent']);
  } finally {
    console.warn = originalWarn;
  }
});
