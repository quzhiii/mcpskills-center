import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface GovernanceConsoleData {
  generatedAt: string;
  skills: {
    totalSkills: number;
    syncActions: number;
    writeActions: number;
    actionBreakdown: Record<string, number>;
  };
  mcp: {
    totalServers: number;
    governanceActions: number;
    canonicalCandidates: number;
    manualReview: number;
    actionBreakdown: Record<string, number>;
  };
  history: Array<{
    timestamp: string;
    operation: string;
    domain: string;
    actionCount: number;
    summary: string;
  }>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderActionBreakdown(breakdown: Record<string, number>): string {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return '<span style="color:#8b949e;">none</span>';
  return entries.map(([type, count]) => `<span class="badge badge-apply">${escapeHtml(type)}: ${count}</span>`).join(' ');
}

export function renderGovernanceConsoleHtml(data: GovernanceConsoleData): string {
  const historyRows = data.history.length > 0
    ? data.history.slice().reverse().map(entry =>
        `<tr><td>${escapeHtml(entry.timestamp)}</td><td>${escapeHtml(entry.operation)}</td><td>${escapeHtml(entry.domain)}</td><td>${entry.actionCount}</td><td>${escapeHtml(entry.summary)}</td></tr>`
      ).join('\n')
    : '<tr><td colspan="5" style="color:#8b949e;">No operations recorded yet.</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCPskills Center - Governance Console</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; padding: 24px; }
    h1 { color: #58a6ff; margin-bottom: 8px; }
    .subtitle { color: #8b949e; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; }
    .card h2 { color: #58a6ff; font-size: 14px; text-transform: uppercase; margin-bottom: 12px; }
    .stat { font-size: 32px; font-weight: bold; color: #f0f6fc; }
    .stat-label { color: #8b949e; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-size: 12px; text-transform: uppercase; }
    td { font-size: 14px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin: 2px; }
    .badge-apply { background: #1f6feb33; color: #58a6ff; }
    .badge-restore { background: #23863633; color: #3fb950; }
    pre { color: #8b949e; font-size: 13px; white-space: pre-wrap; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Governance Console</h1>
  <p class="subtitle">Generated: ${escapeHtml(data.generatedAt)}</p>

  <div class="grid">
    <div class="card">
      <h2>Skills Sync</h2>
      <div class="stat">${data.skills.totalSkills}</div>
      <div class="stat-label">Total Skills</div>
      <div style="margin-top: 8px;">
        <span class="stat" style="font-size:20px;">${data.skills.syncActions}</span> <span class="stat-label">actions</span>
        (<span class="stat" style="font-size:20px;">${data.skills.writeActions}</span> <span class="stat-label">writes</span>)
      </div>
      <div style="margin-top: 8px;">${renderActionBreakdown(data.skills.actionBreakdown)}</div>
    </div>
    <div class="card">
      <h2>MCP Governance</h2>
      <div class="stat">${data.mcp.totalServers}</div>
      <div class="stat-label">MCP Servers</div>
      <div style="margin-top: 8px;">
        <span class="stat" style="font-size:20px;">${data.mcp.governanceActions}</span> <span class="stat-label">actions</span>
        (<span class="stat" style="font-size:20px;">${data.mcp.canonicalCandidates}</span> <span class="stat-label">canonical</span>)
      </div>
      <div style="margin-top: 4px;">
        <span class="stat" style="font-size:16px;">${data.mcp.manualReview}</span> <span class="stat-label">manual review</span>
      </div>
      <div style="margin-top: 8px;">${renderActionBreakdown(data.mcp.actionBreakdown)}</div>
    </div>
  </div>

  <div class="card">
    <h2>Operation History</h2>
    <table>
      <thead><tr><th>Timestamp</th><th>Operation</th><th>Domain</th><th>Actions</th><th>Summary</th></tr></thead>
      <tbody>${historyRows}</tbody>
    </table>
  </div>

  <div class="card" style="margin-top: 16px;">
    <h2>CLI Commands</h2>
    <pre>
# View current plan
node dist/index.js governance --dry-run

# Apply changes
node dist/index.js governance --apply --confirm

# View history
node dist/index.js history

# Compare plans
node dist/index.js governance-diff</pre>
  </div>
</body>
</html>`;
}

export async function writeGovernanceConsole(
  data: GovernanceConsoleData,
  reportsDir: string,
): Promise<string> {
  await mkdir(reportsDir, { recursive: true });
  const html = renderGovernanceConsoleHtml(data);
  const path = join(reportsDir, 'governance-console.html');
  await writeFile(path, html, 'utf-8');
  return path;
}
