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
        canonicalProfileCandidate: {
          profileId: 'filesystem',
          mcpId: 'filesystem',
          sourceAgentName: 'claude-code',
          agentNames: ['claude-code', 'opencode'],
          definition: {
            transport: 'stdio',
            command: 'npx',
            host: undefined,
            isEnabled: true,
            canStart: null,
            hasSensitiveEnv: false,
          },
          blockedByEnvRisk: false,
        },
        envRiskPolicy: 'no-env-risk-detected',
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
        envRiskPolicy: 'no-env-risk-detected',
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
        envRiskPolicy: 'no-env-risk-detected',
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
  assert.match(markdown, /\| memory \| claude-code, codex \| - \| MCP duplicate definitions drift across agents and require manual review \|/);
  assert.match(markdown, /## Canonical Profile Candidates/);
  assert.match(markdown, /\| filesystem \| filesystem \| claude-code \| claude-code, opencode \| no \|/);
  assert.match(markdown, /## Per-Agent Definitions/);
  assert.match(markdown, /\| filesystem \| claude-code \| stdio \| `npx` \| - \| no \| - \|/);
  assert.match(markdown, /\| memory \| codex \| stdio \| `node` \| - \| no \| - \|/);
  assert.match(markdown, /\| single \| opencode \| http \| - \| `https:\/\/example\.test\/mcp` \| no \| - \|/);
  assert.match(markdown, /\| Type \| MCP \| Agents \| Canonical Candidate \| Env Risk Policy \| Scope Policy \| Requires Write \| Reason \|/);
  assert.match(markdown, /\| canonical-candidate \| filesystem \| claude-code, opencode \| claude-code \| no-env-risk-detected \| - \| no \| MCP server has equivalent duplicate definitions and is a canonical profile candidate \|/);
});

test('renderMcpGovernancePlanMarkdown includes scope evidence and scope review policy', () => {
  const plan: McpGovernancePlan = {
    generatedAt: '2026-06-08T00:00:00.000Z',
    actions: [
      {
        id: 'manual-review:filesystem:0',
        type: 'manual-review',
        mcpId: 'filesystem',
        agentNames: ['claude-code', 'opencode'],
        envRiskPolicy: 'no-env-risk-detected',
        scopePolicy: 'scope-conflict-requires-review',
        definitions: [
          {
            agentName: 'claude-code',
            transport: 'stdio',
            command: 'npx',
            isEnabled: true,
            canStart: null,
            hasSensitiveEnv: false,
            scope: { kind: 'global' },
          },
          {
            agentName: 'opencode',
            transport: 'stdio',
            command: 'npx',
            isEnabled: true,
            canStart: null,
            hasSensitiveEnv: false,
            scope: { kind: 'project', id: 'project-one' },
          },
        ],
        reason: 'MCP duplicate definitions have a scope conflict (global, project:project-one) and require manual review',
        requiresWrite: false,
      },
    ],
  };

  const markdown = renderMcpGovernancePlanMarkdown(plan);

  assert.match(markdown, /\| MCP \| Agents \| Scope Policy \| Reason \|/);
  assert.match(markdown, /\| filesystem \| claude-code, opencode \| scope-conflict-requires-review \| MCP duplicate definitions have a scope conflict \(global, project:project-one\) and require manual review \|/);
  assert.match(markdown, /\| MCP \| Agent \| Transport \| Command \| Host \| Sensitive Env \| Scope \|/);
  assert.match(markdown, /\| filesystem \| claude-code \| stdio \| `npx` \| - \| no \| global \|/);
  assert.match(markdown, /\| filesystem \| opencode \| stdio \| `npx` \| - \| no \| project:project-one \|/);
});

test('writeMcpGovernancePlanReports preserves scope evidence when serializing reports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'mcpskills-mcp-scope-report-'));
  cleanups.push(() => rm(root, { recursive: true, force: true }));

  const plan: McpGovernancePlan = {
    generatedAt: '2026-06-08T00:00:00.000Z',
    actions: [
      {
        id: 'manual-review:filesystem:0',
        type: 'manual-review',
        mcpId: 'filesystem',
        agentNames: ['claude-code', 'opencode'],
        envRiskPolicy: 'no-env-risk-detected',
        scopePolicy: 'scope-conflict-requires-review',
        definitions: [
          {
            agentName: 'claude-code',
            transport: 'stdio',
            command: 'npx',
            isEnabled: true,
            canStart: null,
            hasSensitiveEnv: false,
            scope: { kind: 'global' },
          },
          {
            agentName: 'opencode',
            transport: 'stdio',
            command: 'npx',
            isEnabled: true,
            canStart: null,
            hasSensitiveEnv: false,
            scope: { kind: 'project', id: 'project-one' },
          },
        ],
        reason: 'MCP duplicate definitions have a scope conflict (global, project:project-one) and require manual review',
        requiresWrite: false,
      },
    ],
  };

  await writeMcpGovernancePlanReports(plan, root);
  const json = JSON.parse(await readFile(join(root, 'mcp-governance-plan-current.json'), 'utf-8'));
  const markdown = await readFile(join(root, 'mcp-governance-plan-current.md'), 'utf-8');

  assert.deepEqual(json.actions[0].definitions[0].scope, { kind: 'global' });
  assert.deepEqual(json.actions[0].definitions[1].scope, { kind: 'project', id: 'project-one' });
  assert.match(markdown, /project:project-one/);
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
  assert.equal(json.actions[0].envRiskPolicy, 'no-env-risk-detected');
  assert.equal(json.actions[0].canonicalProfileCandidate.profileId, 'filesystem');
  assert.equal(json.actions[0].canonicalProfileCandidate.sourceAgentName, 'claude-code');
  assert.equal(json.actions[0].canonicalProfileCandidate.blockedByEnvRisk, false);
  assert.match(markdown, /# MCP Governance Dry-Run Plan/);
});
