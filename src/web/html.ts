export function renderWebDashboard(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCPskills Center</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; }
    .header { background: #161b22; border-bottom: 1px solid #30363d; padding: 16px 24px; display: flex; align-items: center; gap: 16px; }
    .header h1 { color: #58a6ff; font-size: 18px; }
    .header .version { color: #8b949e; font-size: 12px; }
    .nav { background: #161b22; border-bottom: 1px solid #30363d; padding: 0 24px; display: flex; gap: 4px; }
    .nav button { background: none; border: none; color: #8b949e; padding: 12px 16px; cursor: pointer; font-size: 14px; border-bottom: 2px solid transparent; }
    .nav button.active { color: #58a6ff; border-bottom-color: #58a6ff; }
    .nav button:hover { color: #c9d1d9; }
    .content { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
    .card h2 { color: #58a6ff; font-size: 14px; text-transform: uppercase; margin-bottom: 12px; }
    .stat { font-size: 32px; font-weight: bold; color: #f0f6fc; }
    .stat-label { color: #8b949e; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-size: 12px; text-transform: uppercase; }
    td { font-size: 14px; }
    .loading { color: #8b949e; }
    .error { color: #f85149; }
    .btn { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn:hover { background: #30363d; }
    .btn-primary { background: #238636; border-color: #2ea043; }
    .btn-primary:hover { background: #2ea043; }
    pre { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 12px; overflow-x: auto; font-size: 13px; }
    .section { display: none; }
    .section.active { display: block; }
  </style>
</head>
<body>
  <div class="header">
    <h1>MCPskills Center</h1>
    <span class="version">Web Console</span>
  </div>
  <div class="nav">
    <button class="active" onclick="showSection('overview')">Overview</button>
    <button onclick="showSection('governance')">Governance</button>
    <button onclick="showSection('history')">History</button>
    <button onclick="showSection('agents')">Agents</button>
    <button onclick="showSection('route')">Route</button>
  </div>
  <div class="content">
    <div id="overview" class="section active">
      <div class="grid" id="stats"></div>
      <div class="card"><h2>Recent Operations</h2><div id="recent-ops"><span class="loading">Loading...</span></div></div>
    </div>
    <div id="governance" class="section">
      <div class="card"><h2>Governance Plan</h2><div id="governance-plan"><span class="loading">Loading...</span></div></div>
    </div>
    <div id="history" class="section">
      <div class="card"><h2>Operation History</h2><div id="history-list"><span class="loading">Loading...</span></div></div>
    </div>
    <div id="agents" class="section">
      <div class="card"><h2>Registered Agents</h2><div id="agents-list"><span class="loading">Loading...</span></div></div>
    </div>
    <div id="route" class="section">
      <div class="card">
        <h2>Route Task</h2>
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <input type="text" id="task-input" placeholder="Describe your task..." style="flex:1;background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:8px 12px;border-radius:6px;font-size:14px;">
          <button class="btn btn-primary" onclick="routeTask()">Route</button>
        </div>
        <div id="route-result"></div>
      </div>
    </div>
  </div>
  <script>
    function showSection(name) {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
      document.getElementById(name).classList.add('active');
      event.target.classList.add('active');
      if (name === 'overview') loadOverview();
      if (name === 'governance') loadGovernance();
      if (name === 'history') loadHistory();
      if (name === 'agents') loadAgents();
    }
    async function loadOverview() {
      try {
        const inv = await (await fetch('/api/inventory')).json();
        document.getElementById('stats').innerHTML =
          '<div class="card"><div class="stat">' + inv.skills + '</div><div class="stat-label">Skills</div></div>' +
          '<div class="card"><div class="stat">' + inv.mcpServers + '</div><div class="stat-label">MCP Servers</div></div>' +
          '<div class="card"><div class="stat">' + inv.agents + '</div><div class="stat-label">Agents</div></div>';
        const hist = await (await fetch('/api/history')).json();
        const rows = hist.entries.slice(0, 5).map(e =>
          '<tr><td>' + e.timestamp + '</td><td>' + e.operation + '</td><td>' + e.domain + '</td><td>' + e.summary + '</td></tr>'
        ).join('');
        document.getElementById('recent-ops').innerHTML = rows ?
          '<table><thead><tr><th>Time</th><th>Op</th><th>Domain</th><th>Summary</th></tr></thead><tbody>' + rows + '</tbody></table>' :
          '<p style="color:#8b949e">No operations recorded yet.</p>';
      } catch(e) { document.getElementById('stats').innerHTML = '<p class="error">' + e.message + '</p>'; }
    }
    async function loadGovernance() {
      try {
        const g = await (await fetch('/api/governance')).json();
        const rows = g.actions.map(a =>
          '<tr><td>' + a.id + '</td><td>' + a.type + '</td><td>' + a.mcpId + '</td><td>' + a.reason + '</td></tr>'
        ).join('');
        document.getElementById('governance-plan').innerHTML = rows ?
          '<table><thead><tr><th>ID</th><th>Type</th><th>MCP</th><th>Reason</th></tr></thead><tbody>' + rows + '</tbody></table>' :
          '<p style="color:#8b949e">No governance actions.</p>';
      } catch(e) { document.getElementById('governance-plan').innerHTML = '<p class="error">' + e.message + '</p>'; }
    }
    async function loadHistory() {
      try {
        const h = await (await fetch('/api/history')).json();
        const rows = h.entries.map(e =>
          '<tr><td>' + e.timestamp + '</td><td>' + e.operation + '</td><td>' + e.domain + '</td><td>' + e.actionCount + '</td><td>' + e.summary + '</td></tr>'
        ).join('');
        document.getElementById('history-list').innerHTML = rows ?
          '<table><thead><tr><th>Time</th><th>Op</th><th>Domain</th><th>Actions</th><th>Summary</th></tr></thead><tbody>' + rows + '</tbody></table>' :
          '<p style="color:#8b949e">No operations recorded yet.</p>';
      } catch(e) { document.getElementById('history-list').innerHTML = '<p class="error">' + e.message + '</p>'; }
    }
    async function loadAgents() {
      try {
        const a = await (await fetch('/api/agents')).json();
        const rows = a.agents.map(ag =>
          '<tr><td>' + ag.name + '</td><td>' + ag.enabled + '</td><td>' + ag.scannerType + '</td></tr>'
        ).join('');
        document.getElementById('agents-list').innerHTML =
          '<table><thead><tr><th>Agent</th><th>Enabled</th><th>Scanner</th></tr></thead><tbody>' + rows + '</tbody></table>';
      } catch(e) { document.getElementById('agents-list').innerHTML = '<p class="error">' + e.message + '</p>'; }
    }
    async function routeTask() {
      const task = document.getElementById('task-input').value;
      if (!task) return;
      try {
        const r = await (await fetch('/api/route?task=' + encodeURIComponent(task))).json();
        document.getElementById('route-result').innerHTML =
          '<div class="card"><div class="stat">' + r.recommendedAgent + '</div><div class="stat-label">Recommended Agent</div>' +
          '<p style="margin-top:8px;color:#8b949e">Category: ' + r.category + '</p>' +
          '<p style="color:#8b949e">Alternatives: ' + (r.alternatives.join(', ') || 'none') + '</p>' +
          '<p style="margin-top:8px">' + r.reasoning + '</p></div>';
      } catch(e) { document.getElementById('route-result').innerHTML = '<p class="error">' + e.message + '</p>'; }
    }
    loadOverview();
  </script>
</body>
</html>`;
}
