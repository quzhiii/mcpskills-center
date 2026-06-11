import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { parse } from 'node:url';
import { renderWebDashboard } from './html.js';
import type { CommandContext } from '../cli/commands.js';
import { normalizeInventory } from '../normalizer/index.js';
import { planMcpGovernance } from '../mcp/planner.js';
import { readGovernanceHistory } from '../db/index.js';
import { routeTask } from '../routing/router.js';
import { join } from 'node:path';

export function startWebServer(port: number, context: CommandContext): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = parse(req.url ?? '/', true);
      const path = url.pathname;

      try {
        if (path === '/') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(renderWebDashboard());
        } else if (path === '/api/inventory') {
          const inventory = await context.runInventory();
          const normalized = normalizeInventory(inventory);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            skills: normalized.skills.length,
            mcpServers: normalized.mcpServers.length,
            agents: normalized.agents.length,
          }));
        } else if (path === '/api/governance') {
          const inventory = await context.runInventory();
          const normalized = normalizeInventory(inventory);
          const plan = planMcpGovernance(normalized);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(plan));
        } else if (path === '/api/history') {
          if (!context.db) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ entries: [] }));
          } else {
            const entries = readGovernanceHistory(context.db);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ entries }));
          }
        } else if (path === '/api/agents') {
          const agents = await context.listAgents();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            agents: agents.map(a => ({ name: a.name, enabled: a.enabled, scannerType: a.scannerType })),
          }));
        } else if (path === '/api/route') {
          const task = url.query.task as string;
          if (!task) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing task parameter' }));
          } else {
            const agents = await context.listAgents();
            const policyPath = join(context.profilesDir, '..', 'routing-policy.json');
            const result = await routeTask(task, policyPath, agents, context.db);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
        } else if (path === '/api/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      }
    });

    server.listen(port, () => {
      console.log(`MCPskills Center Web Console running at http://localhost:${port}`);
      resolve(server);
    });
  });
}
