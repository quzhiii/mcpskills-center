import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderMcpGovernancePlanMarkdown, writeMcpGovernancePlanReports } from './reporter.js';
import type { McpGovernancePlan } from '../types/index.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

function makePlan(): McpGovernancePlan {
  return {
    generatedAt: '2026-06-08T00:00:00.000Z',
    actions: [
      {
        id: 'canonical-candidate:filesystem:0',
        type: 'canonical-candidate',
        mcpId: 'filesystem',
        agentNames: ['claude-code', 'opencode'],
        canonicalAgentName: 'claude-code',
        definitions: [
          {
            agentName: 'claude-code',
            transport: 'stdio',
            command: 'npx',
            isEnabled: true,
            canStart: null,
            hasSensitiveEnv: false,
          },
          {
            agentName: 'opencode',
            transport: 'stdio',
            command: 'npx',
            isEnabled: true,
            canStart: null,
            hasSensitiveEnv: false,
          },
        ],
        reason: 'MCP server has equivalent duplicate definitions and is a canonical profile candidate',
        requiresWrite: false,
      },
      {
        id: 'manual-review:memory:1',
        type: 'manual-review',
        mcpId: 'memory',
        agentNames: ['claude-code', 'codex'],
        definitions: [
          {
            agentName: 'claude-code',
            transport: 'stdio',
            command: 'npx',
            isEnabled: true,
            canStart: null,
            hasSensitiveEnv: false,
          },
          {
            agentName: 'codex',
            transport: 'stdio',
            command: 'node',
            isEnabled: true,
            canStart: null,
            hasSensitiveEnv: false,
          },
        ],
        reason: 'MCP duplicate definitions drift across agents and require manual review',
        requiresWrite: false,
      },
      {
        id: 'skip:single:2',
        type: 'skip',
        mcpId: 'single',
        agentNames: ['opencode'],
        definitions: [
          {
            agentName: 'opencode',
            transport: 'http',
            host: 'https://example.test/mcp',
            isEnabled: true,
            canStart: null,
            hasSensitiveEnv: false,
          },
        ],
        reason: 'MCP server is configured in only one agent; no governance action is needed',
        requiresWrite: false,
      },
    ],
  };
}

test('renderMcpGovernancePlanMarkdown renders summary, manual review, and definitions', () => {
  const markdown = renderMcpGovernancePlanMarkdown(makePlan());

  assert.match(markdown, /# MCP Governance Dry-Run Plan/);
  assert.match(markdown, /Actions: 3/);
  assert.match(markdown, /Write Actions: 0/);
  assert.match(markdown, /## Action Type Summary/);
  assert.match(markdown, /\| canonical-candidate \| 1 \| 0 \|/);
  assert.match(markdown, /\| manual-review \| 1 \| 0 \|/);
  assert.match(markdown, /\| skip \| 1 \| 0 \|/);
  assert.match(markdown, /## Manual Review Required/);
  assert.match(markdown, /\| memory \| claude-code, codex \| MCP duplicate definitions drift across agents and require manual review \|/);
  assert.match(markdown, /## Per-Agent Definitions/);
  assert.match(markdown, /\| filesystem \| claude-code \| stdio \| `npx` \| - \| no \|/);
  assert.match(markdown, /\| memory \| codex \| stdio \| `node` \| - \| no \|/);
  assert.match(markdown, /\| single \| opencode \| http \| - \| `https:\/\/example\.test\/mcp` \| no \|/);
  assert.match(markdown, /\| Type \| MCP \| Agents \| Canonical Candidate \| Requires Write \| Reason \|/);
});

test('writeMcpGovernancePlanReports writes JSON with dry-run summary counts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-mcp-report-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  await writeMcpGovernancePlanReports(makePlan(), root);
  const json = JSON.parse(await readFile(join(root, 'mcp-governance-plan-current.json'), 'utf-8'));
  const markdown = await readFile(join(root, 'mcp-governance-plan-current.md'), 'utf-8');

  assert.equal(json.summary.totalActions, 3);
  assert.equal(json.summary.writeActions, 0);
  assert.equal(json.summary.actionTypes['canonical-candidate'].actions, 1);
  assert.equal(json.summary.actionTypes['manual-review'].actions, 1);
  assert.equal(json.summary.agentImpact['claude-code'].actions, 2);
  assert.match(markdown, /# MCP Governance Dry-Run Plan/);
});
