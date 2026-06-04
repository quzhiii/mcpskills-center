import type { AuditReport, Inventory } from '../types/index.js';

export function renderDashboardHtml(inventory: Inventory, audit: AuditReport): string {
  const recommendations = audit.recommendations.slice(0, 20);
  const issues = audit.issues.slice(0, 20);
  const skills = inventory.skills.slice(0, 20);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCPskills Center Dashboard</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f3ea; color: #1d2433; }
    main { max-width: 1180px; margin: 0 auto; padding: 40px 24px 56px; }
    header { display: grid; gap: 8px; margin-bottom: 28px; }
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
    @media (max-width: 820px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } table { font-size: 13px; } }
    @media (max-width: 560px) { main { padding: 24px 14px 36px; } .grid { grid-template-columns: 1fr; } th, td { padding: 9px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>MCPskills Center Dashboard</h1>
      <p>Generated ${escapeHtml(audit.generatedAt)}. Local-only static report; no external assets.</p>
    </header>

    <section class="grid" aria-label="Summary">
      ${metricCard('Total Skills', inventory.skills.length)}
      ${metricCard('Total MCP Servers', inventory.mcpServers.length)}
      ${metricCard('Issues', audit.issues.length)}
      ${metricCard('Recommendations', audit.recommendations.length)}
    </section>

    <section class="card">
      <h2>Recommendations</h2>
      ${renderRecommendationsTable(recommendations)}
    </section>

    <section class="card">
      <h2>Skills</h2>
      ${renderSkillsTable(skills)}
    </section>

    <section class="card">
      <h2>Issues</h2>
      ${renderIssuesTable(issues)}
    </section>
  </main>
</body>
</html>`;
}

function metricCard(label: string, value: number): string {
  return `<article class="card metric"><strong>${value}</strong><span>${escapeHtml(label)}</span></article>`;
}

function renderSkillsTable(skills: Inventory['skills']): string {
  if (skills.length === 0) return '<p>No skills found.</p>';

  const rows = skills.map(skill => `
    <tr>
      <td>${escapeHtml(skill.id)}</td>
      <td>${escapeHtml(String(skill.agentInstallPaths.length))}</td>
      <td>${skill.hasSkillMd ? 'yes' : 'no'}</td>
      <td>${skill.frontmatterValid ? 'yes' : 'no'}</td>
    </tr>`).join('');

  return `<table>
    <thead><tr><th>Skill</th><th>Installs</th><th>SKILL.md</th><th>Frontmatter</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>`;
}

function renderRecommendationsTable(recommendations: AuditReport['recommendations']): string {
  if (recommendations.length === 0) return '<p>No recommendations.</p>';

  const rows = recommendations.map(recommendation => `
    <tr>
      <td>${escapeHtml(recommendation.category)}</td>
      <td>${escapeHtml(`${recommendation.targetType}: ${recommendation.targetId}`)}</td>
      <td><span class="pill severity-${escapeHtml(recommendation.severity)}">${escapeHtml(recommendation.severity)}</span></td>
      <td>${recommendation.requiresWrite ? 'yes' : 'no'}</td>
      <td>${escapeHtml(recommendation.suggestedAction)}</td>
    </tr>`).join('');

  return `<table>
    <thead><tr><th>Category</th><th>Target</th><th>Severity</th><th>Requires Write</th><th>Action</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>`;
}

function renderIssuesTable(issues: AuditReport['issues']): string {
  if (issues.length === 0) return '<p>No issues found.</p>';

  const rows = issues.map(issue => `
    <tr>
      <td>${escapeHtml(issue.type)}</td>
      <td>${escapeHtml(issue.item)}</td>
      <td><span class="pill severity-${escapeHtml(issue.severity)}">${escapeHtml(issue.severity)}</span></td>
      <td>${escapeHtml(issue.description)}</td>
    </tr>`).join('');

  return `<table>
    <thead><tr><th>Type</th><th>Item</th><th>Severity</th><th>Description</th></tr></thead>
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
