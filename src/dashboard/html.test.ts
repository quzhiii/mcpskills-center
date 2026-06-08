import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDashboardHtml } from './html.js';
import type { AuditReport, Inventory } from '../types/index.js';

function makeInventory(): Inventory {
  return {
    generatedAt: '2026-06-03T00:00:00.000Z',
    agents: [
      {
        name: 'claude-code',
        configDir: 'C:/Users/quzhi/.claude',
        skillsDir: 'C:/Users/quzhi/.claude/skills',
      },
    ],
    skills: [
      {
        id: '<script>alert("x")</script>',
        displayName: '<script>alert("x")</script>',
        sourcePath: 'C:/skills/unsafe',
        agentInstallPaths: ['C:/skills/unsafe'],
        isCanonical: false,
        isSymlink: false,
        hasSkillMd: true,
        frontmatterValid: true,
        isDuplicate: false,
      },
    ],
    mcpServers: [
      {
        id: 'web-reader',
        agentSources: ['claude-code'],
        transport: 'http',
        isDuplicate: false,
        isEnabled: true,
        canStart: null,
        hasSensitiveEnv: false,
      },
    ],
    profiles: [],
  };
}

function makeAudit(inventory: Inventory): AuditReport {
  return {
    generatedAt: '2026-06-03T00:00:00.000Z',
    inventory,
    issues: [
      {
        type: 'duplicate-skill',
        severity: 'warning',
        item: '<script>alert("issue")</script>',
        agents: ['claude-code'],
        description: 'Unsafe issue should be escaped',
        suggestion: 'Review safely',
      },
    ],
    recommendations: [
      {
        category: 'manual-review',
        targetType: 'skill',
        targetId: '<script>alert("recommendation")</script>',
        severity: 'warning',
        reason: 'Unsafe recommendation should be escaped',
        suggestedAction: 'Review without executing HTML',
        requiresWrite: false,
      },
    ],
    summary: {
      totalSkills: 1,
      totalMcpServers: 1,
      duplicateSkills: 1,
      duplicateMcps: 0,
      missingSkillMds: 0,
      brokenSymlinks: 0,
      sensitiveEnvs: 0,
    },
  };
}

test('renderDashboardHtml includes summary counts and recommendations', () => {
  const inventory = makeInventory();
  const html = renderDashboardHtml(inventory, makeAudit(inventory));

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /MCPskills Center Dashboard/);
  assert.match(html, /Total Skills/);
  assert.match(html, /Total MCP Servers/);
  assert.match(html, /Issues/);
  assert.match(html, /Recommendations/);
  assert.match(html, /<strong>1<\/strong>\s*<span><span data-lang="en">Total Skills<\/span><span data-lang="zh-CN">技能总数<\/span><\/span>/);
  assert.match(html, /manual-review/);
  assert.match(html, /Review without executing HTML/);
  assert.match(html, /language-toggle/);
  assert.match(html, /data-lang="en"/);
  assert.match(html, /data-lang="zh-CN"/);
  assert.match(html, /MCPskills Center Dashboard/);
  assert.match(html, /Agent Support/);
  assert.match(html, /支持状态|支持的 Agent|Agent Support/);
});

test('renderDashboardHtml escapes dynamic strings and stays offline', () => {
  const inventory = makeInventory();
  const html = renderDashboardHtml(inventory, makeAudit(inventory));

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<link\s/i);
  assert.doesNotMatch(html, /src=/i);
});

test('renderDashboardHtml fills agent support fallback metadata on direct render', () => {
  const inventory: Inventory = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    agents: [
      {
        name: 'future-agent',
        id: 'future-agent',
        scannerType: 'future',
        configDir: 'C:/future',
        skillsDir: 'C:/future/skills',
        enabled: false,
        readOnly: true,
      },
    ],
    skills: [],
    mcpServers: [],
    profiles: [],
  };

  const html = renderDashboardHtml(inventory, makeAudit(inventory));

  assert.match(html, /Agent Support/);
  assert.match(html, /undocumented\/unknown/);
  assert.match(html, /low/);
});

test('renderDashboardHtml uses scannerType for support fallback when id is absent', () => {
  const inventory: Inventory = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    agents: [
      {
        name: 'custom-claude-install',
        scannerType: 'claude-code',
        configDir: 'C:/custom-claude',
        skillsDir: 'C:/custom-claude/skills',
        enabled: true,
        readOnly: false,
      },
    ],
    skills: [],
    mcpServers: [],
    profiles: [],
  };

  const html = renderDashboardHtml(inventory, makeAudit(inventory));

  assert.match(html, /dedicated read-only plus write-ready workflow support/);
  assert.match(html, /high/);
});

test('renderDashboardHtml prefers scannerType over custom id for support fallback', () => {
  const inventory: Inventory = {
    generatedAt: '2026-06-03T00:00:00.000Z',
    agents: [
      {
        name: 'custom-claude-install',
        id: 'custom-claude-install',
        scannerType: 'claude-code',
        configDir: 'C:/custom-claude',
        skillsDir: 'C:/custom-claude/skills',
        enabled: true,
        readOnly: false,
      },
    ],
    skills: [],
    mcpServers: [],
    profiles: [],
  };

  const html = renderDashboardHtml(inventory, makeAudit(inventory));

  assert.match(html, /dedicated read-only plus write-ready workflow support/);
  assert.match(html, /high/);
});
