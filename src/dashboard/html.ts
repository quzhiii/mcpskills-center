import { resolveAgentSupport } from '../agents/support.js';
import type { AuditReport, Inventory } from '../types/index.js';

export function renderDashboardHtml(inventory: Inventory, audit: AuditReport): string {
  const recommendations = audit.recommendations.slice(0, 20);
  const issues = audit.issues.slice(0, 20);
  const skills = inventory.skills.slice(0, 20);
  const agents = inventory.agents.slice(0, 20);
  const generatedAt = escapeHtml(audit.generatedAt);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCPskills Center Dashboard</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f3ea; color: #1d2433; }
    main { max-width: 1180px; margin: 0 auto; padding: 40px 24px 56px; }
    header { display: grid; gap: 8px; margin-bottom: 28px; }
    .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font-size: clamp(32px, 5vw, 56px); letter-spacing: -0.05em; }
    h2 { margin: 0 0 14px; font-size: 22px; letter-spacing: -0.02em; }
    p { margin: 0; color: #5d6678; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin: 24px 0; }
    .card { background: #fffdf8; border: 1px solid #d8cfbd; border-radius: 18px; padding: 18px; box-shadow: 0 16px 36px rgba(29, 36, 51, 0.08); }
    .metric strong { display: block; font-size: 34px; line-height: 1; letter-spacing: -0.04em; }
    .metric span { display: block; margin-top: 8px; color: #5d6678; font-size: 14px; }
    section { margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; overflow: hidden; border-radius: 14px; }
    th, td { padding: 11px 12px; text-align: left; border-bottom: 1px solid #e5ddcf; vertical-align: top; }
    th { background: #1d2433; color: #fffdf8; font-weight: 650; }
    tr:last-child td { border-bottom: 0; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #ede5d7; font-size: 12px; }
    .severity-error { background: #ffe0df; color: #9f1d19; }
    .severity-warning { background: #fff1ca; color: #79520b; }
    .severity-info { background: #dfeafe; color: #214c9a; }
    .language-toggle { display: inline-flex; gap: 8px; align-items: center; border: 1px solid #d8cfbd; border-radius: 999px; padding: 6px; background: #fffdf8; box-shadow: 0 8px 18px rgba(29, 36, 51, 0.06); }
    .language-toggle button { border: 0; border-radius: 999px; padding: 8px 12px; background: transparent; color: #5d6678; cursor: pointer; font: inherit; }
    .language-toggle button[aria-pressed="true"] { background: #1d2433; color: #fffdf8; }
    [data-lang] { display: none; }
    html[data-language="zh-CN"] [data-lang="zh-CN"] { display: inline; }
    html[data-language="en"] [data-lang="en"] { display: inline; }
    html[data-language="zh-CN"] [data-lang-block="zh-CN"] { display: block; }
    html[data-language="en"] [data-lang-block="en"] { display: block; }
    [data-lang-block] { display: none; }
    @media (max-width: 820px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } table { font-size: 13px; } }
    @media (max-width: 560px) { main { padding: 24px 14px 36px; } .grid { grid-template-columns: 1fr; } th, td { padding: 9px; } .header-row { flex-direction: column; } }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="header-row">
        <div>
          <h1><span data-lang="en">MCPskills Center Dashboard</span><span data-lang="zh-CN">MCPskills Center 仪表盘</span></h1>
          <p><span data-lang="en">Generated ${generatedAt}. Local-only static report; no external assets.</span><span data-lang="zh-CN">生成时间 ${generatedAt}。纯本地静态报告，不依赖外部资源。</span></p>
        </div>
        <div class="language-toggle" aria-label="language-toggle">
          <button type="button" data-language-switch="zh-CN" aria-pressed="true">中文</button>
          <button type="button" data-language-switch="en" aria-pressed="false">EN</button>
        </div>
      </div>
    </header>

    <section class="grid" aria-label="Summary">
      ${metricCard('Total Skills', '技能总数', inventory.skills.length)}
      ${metricCard('Total MCP Servers', 'MCP 服务总数', inventory.mcpServers.length)}
      ${metricCard('Issues', '问题数', audit.issues.length)}
      ${metricCard('Recommendations', '建议数', audit.recommendations.length)}
    </section>

    <section class="card">
      <h2><span data-lang="en">Recommendations</span><span data-lang="zh-CN">建议动作</span></h2>
      ${renderRecommendationsTable(recommendations)}
    </section>

    <section class="card">
      <h2><span data-lang="en">Agent Support</span><span data-lang="zh-CN">支持状态</span></h2>
      ${renderAgentSupportTable(agents)}
    </section>

    <section class="card">
      <h2><span data-lang="en">Skills</span><span data-lang="zh-CN">Skills</span></h2>
      ${renderSkillsTable(skills)}
    </section>

    <section class="card">
      <h2><span data-lang="en">Issues</span><span data-lang="zh-CN">问题</span></h2>
      ${renderIssuesTable(issues)}
    </section>
  </main>
  <script>
    (() => {
      const root = document.documentElement;
      const buttons = Array.from(document.querySelectorAll('[data-language-switch]'));
      const setLanguage = (language) => {
        root.setAttribute('data-language', language);
        root.setAttribute('lang', language);
        buttons.forEach((button) => {
          button.setAttribute('aria-pressed', button.getAttribute('data-language-switch') === language ? 'true' : 'false');
        });
      };

      buttons.forEach((button) => {
        button.addEventListener('click', () => setLanguage(button.getAttribute('data-language-switch') || 'zh-CN'));
      });

      setLanguage('zh-CN');
    })();
  </script>
</body>
</html>`;
}

function metricCard(labelEn: string, labelZh: string, value: number): string {
  return `<article class="card metric"><strong>${value}</strong><span><span data-lang="en">${escapeHtml(labelEn)}</span><span data-lang="zh-CN">${escapeHtml(labelZh)}</span></span></article>`;
}

function renderSkillsTable(skills: Inventory['skills']): string {
  if (skills.length === 0) return '<p><span data-lang="en">No skills found.</span><span data-lang="zh-CN">未发现 skills。</span></p>';

  const rows = skills.map(skill => `
    <tr>
      <td>${escapeHtml(skill.id)}</td>
      <td>${escapeHtml(String(skill.agentInstallPaths.length))}</td>
      <td>${renderBooleanText(skill.hasSkillMd)}</td>
      <td>${renderBooleanText(skill.frontmatterValid)}</td>
    </tr>`).join('');

  return `<table>
    <thead><tr><th><span data-lang="en">Skill</span><span data-lang="zh-CN">Skill</span></th><th><span data-lang="en">Installs</span><span data-lang="zh-CN">安装数</span></th><th>SKILL.md</th><th><span data-lang="en">Frontmatter</span><span data-lang="zh-CN">Frontmatter</span></th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>`;
}

function renderAgentSupportTable(agents: Inventory['agents']): string {
  if (agents.length === 0) return '<p><span data-lang="en">No agents found.</span><span data-lang="zh-CN">未发现 agents。</span></p>';

  const rows = agents.map(agent => `
    <tr>
      <td>${escapeHtml(agent.id ?? agent.name)}</td>
      <td>${escapeHtml(agent.scannerType ?? agent.name)}</td>
      <td>${renderDualText(resolveAgentSupport(agent).currentLevel, translateSupportLevel(resolveAgentSupport(agent).currentLevel))}</td>
      <td>${renderDualText(resolveAgentSupport(agent).sourceOfTruthConfidence, translateConfidence(resolveAgentSupport(agent).sourceOfTruthConfidence))}</td>
    </tr>`).join('');

  return `<table>
    <thead><tr><th><span data-lang="en">Agent</span><span data-lang="zh-CN">Agent</span></th><th><span data-lang="en">Scanner</span><span data-lang="zh-CN">Scanner</span></th><th><span data-lang="en">Support</span><span data-lang="zh-CN">支持级别</span></th><th><span data-lang="en">Source-of-Truth Confidence</span><span data-lang="zh-CN">来源可信度</span></th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>`;
}

function renderRecommendationsTable(recommendations: AuditReport['recommendations']): string {
  if (recommendations.length === 0) return '<p><span data-lang="en">No recommendations.</span><span data-lang="zh-CN">暂无建议动作。</span></p>';

  const rows = recommendations.map(recommendation => `
    <tr>
      <td>${renderDualText(recommendation.category, translateRecommendationCategory(recommendation.category))}</td>
      <td>${escapeHtml(`${recommendation.targetType}: ${recommendation.targetId}`)}</td>
      <td><span class="pill severity-${escapeHtml(recommendation.severity)}">${renderDualText(recommendation.severity, translateSeverity(recommendation.severity))}</span></td>
      <td>${renderBooleanText(recommendation.requiresWrite)}</td>
      <td>${renderDualText(recommendation.suggestedAction, translateSuggestedAction(recommendation.suggestedAction))}</td>
    </tr>`).join('');

  return `<table>
    <thead><tr><th><span data-lang="en">Category</span><span data-lang="zh-CN">类别</span></th><th><span data-lang="en">Target</span><span data-lang="zh-CN">目标</span></th><th><span data-lang="en">Severity</span><span data-lang="zh-CN">严重度</span></th><th><span data-lang="en">Requires Write</span><span data-lang="zh-CN">需要写入</span></th><th><span data-lang="en">Action</span><span data-lang="zh-CN">动作</span></th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>`;
}

function renderIssuesTable(issues: AuditReport['issues']): string {
  if (issues.length === 0) return '<p><span data-lang="en">No issues found.</span><span data-lang="zh-CN">未发现问题。</span></p>';

  const rows = issues.map(issue => `
    <tr>
      <td>${escapeHtml(issue.type)}</td>
      <td>${escapeHtml(issue.item)}</td>
      <td><span class="pill severity-${escapeHtml(issue.severity)}">${renderDualText(issue.severity, translateSeverity(issue.severity))}</span></td>
      <td>${escapeHtml(issue.description)}</td>
    </tr>`).join('');

  return `<table>
    <thead><tr><th><span data-lang="en">Type</span><span data-lang="zh-CN">类型</span></th><th><span data-lang="en">Item</span><span data-lang="zh-CN">对象</span></th><th><span data-lang="en">Severity</span><span data-lang="zh-CN">严重度</span></th><th><span data-lang="en">Description</span><span data-lang="zh-CN">说明</span></th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDualText(labelEn: string, labelZh: string): string {
  return `<span data-lang="en">${escapeHtml(labelEn)}</span><span data-lang="zh-CN">${escapeHtml(labelZh)}</span>`;
}

function renderBooleanText(value: boolean): string {
  return renderDualText(value ? 'yes' : 'no', value ? '是' : '否');
}

function translateSeverity(severity: string): string {
  switch (severity) {
    case 'error':
      return '错误';
    case 'warning':
      return '警告';
    case 'info':
      return '提示';
    default:
      return severity;
  }
}

function translateConfidence(confidence: string): string {
  switch (confidence) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
      return '低';
    default:
      return confidence;
  }
}

function translateRecommendationCategory(category: string): string {
  switch (category) {
    case 'manual-review':
      return '人工复核';
    case 'merge':
      return '合并';
    case 'remove':
      return '移除';
    default:
      return category;
  }
}

function translateSuggestedAction(action: string): string {
  switch (action) {
    case 'Review without executing HTML':
      return '在不执行 HTML 的前提下检查';
    default:
      return action;
  }
}

function translateSupportLevel(level: string): string {
  switch (level) {
    case 'dedicated read-only plus write-ready workflow support':
      return '专用只读扫描，外加可写工作流支持';
    case 'undocumented/unknown':
      return '未文档化/未知';
    default:
      return level;
  }
}
