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

function makeRichAudit(inventory: Inventory): AuditReport {
  return {
    ...makeAudit(inventory),
    recommendations: [
      {
        category: 'remove',
        targetType: 'skill',
        targetId: 'beautiful-html-templates',
        severity: 'error',
        reason: 'incomplete skill',
        suggestedAction: 'Remove the incomplete skill or add a valid SKILL.md after manual review',
        requiresWrite: true,
      },
      {
        category: 'merge',
        targetType: 'skill',
        targetId: 'hv-analysis',
        severity: 'warning',
        reason: 'duplicate skill',
        suggestedAction: 'Plan consolidation through a canonical skills store before changing files',
        requiresWrite: true,
      },
      {
        category: 'manual-review',
        targetType: 'mcp-server',
        targetId: 'global:zai-mcp-server',
        severity: 'warning',
        reason: 'sensitive env',
        suggestedAction: 'Confirm secrets are stored securely and never copied into generated reports',
        requiresWrite: false,
      },
      {
        category: 'merge',
        targetType: 'mcp-server',
        targetId: 'agentmemory',
        severity: 'info',
        reason: 'duplicate mcp',
        suggestedAction: 'Decide whether this MCP should stay duplicated or be managed by a shared profile',
        requiresWrite: false,
      },
    ],
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
  assert.match(html, /<span data-lang="en">no<\/span><span data-lang="zh-CN">否<\/span>/);
  assert.match(html, /<span data-lang="en">warning<\/span><span data-lang="zh-CN">警告<\/span>/);
  assert.match(html, /<span data-lang="en">Review without executing HTML<\/span><span data-lang="zh-CN">在不执行 HTML 的前提下检查<\/span>/);
  assert.match(html, /<span data-lang="en">Skill<\/span><span data-lang="zh-CN">技能<\/span>/);
  assert.match(html, /<span data-lang="en">Agent<\/span><span data-lang="zh-CN">代理<\/span>/);
  assert.match(html, /<span data-lang="en">Scanner<\/span><span data-lang="zh-CN">扫描器<\/span>/);
  assert.match(html, /<span data-lang="en">SKILL\.md<\/span><span data-lang="zh-CN">说明文件<\/span>/);
  assert.match(html, /<span data-lang="en">Frontmatter<\/span><span data-lang="zh-CN">元数据<\/span>/);
});

test('renderDashboardHtml translates known recommendation actions and fallback support copy', () => {
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

  const html = renderDashboardHtml(inventory, makeRichAudit(inventory));

  assert.match(html, /<span data-lang="en">undocumented\/unknown<\/span><span data-lang="zh-CN">未文档化\/未知<\/span>/);
  assert.match(html, /<span data-lang="en">low<\/span><span data-lang="zh-CN">低<\/span>/);
  assert.match(html, /<span data-lang="en">Remove the incomplete skill or add a valid SKILL\.md after manual review<\/span><span data-lang="zh-CN">移除不完整的 skill，或在人工复核后补齐有效的 SKILL\.md<\/span>/);
  assert.match(html, /<span data-lang="en">Plan consolidation through a canonical skills store before changing files<\/span><span data-lang="zh-CN">在变更文件前，先基于规范技能仓规划整合<\/span>/);
  assert.match(html, /<span data-lang="en">Confirm secrets are stored securely and never copied into generated reports<\/span><span data-lang="zh-CN">确认密钥已安全存储，且绝不会被复制进生成报告<\/span>/);
  assert.match(html, /<span data-lang="en">Decide whether this MCP should stay duplicated or be managed by a shared profile<\/span><span data-lang="zh-CN">决定这个 MCP 是保留重复安装，还是改由共享 profile 管理<\/span>/);
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
