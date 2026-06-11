import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface GovernanceHistoryRow {
  timestamp: string;
  operation: string;
  domain: string;
  actionCount: number;
  manifestPath?: string;
  summary: string;
}

export interface InventorySnapshotRow {
  capturedAt: string;
  skillCount: number;
  mcpServerCount: number;
  agentCount: number;
}

export interface ActionResultRow {
  runTimestamp: string;
  domain: string;
  actionId: string;
  actionType: string;
  target?: string;
  status: string;
}

export function openGovernanceDb(dbPath: string): Database.Database {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS governance_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      operation TEXT NOT NULL,
      domain TEXT NOT NULL,
      action_count INTEGER NOT NULL,
      manifest_path TEXT,
      summary TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captured_at TEXT NOT NULL,
      skill_count INTEGER NOT NULL,
      mcp_server_count INTEGER NOT NULL,
      agent_count INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS action_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_timestamp TEXT NOT NULL,
      domain TEXT NOT NULL,
      action_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target TEXT,
      status TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_history_timestamp ON governance_history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_history_domain ON governance_history(domain);
    CREATE INDEX IF NOT EXISTS idx_snapshots_captured ON inventory_snapshots(captured_at);
    CREATE INDEX IF NOT EXISTS idx_results_run ON action_results(run_timestamp);
    CREATE INDEX IF NOT EXISTS idx_results_domain ON action_results(domain);
  `);
}

// --- Governance History ---

export function insertGovernanceHistory(db: Database.Database, entry: Omit<GovernanceHistoryRow, 'manifestPath'> & { manifestPath?: string }): void {
  db.prepare(`
    INSERT INTO governance_history (timestamp, operation, domain, action_count, manifest_path, summary)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entry.timestamp, entry.operation, entry.domain, entry.actionCount, entry.manifestPath ?? null, entry.summary);
}

export function readGovernanceHistory(db: Database.Database, limit = 50): GovernanceHistoryRow[] {
  return db.prepare(`
    SELECT timestamp, operation, domain, action_count as actionCount, manifest_path as manifestPath, summary
    FROM governance_history
    ORDER BY id DESC
    LIMIT ?
  `).all(limit) as GovernanceHistoryRow[];
}

// --- Inventory Snapshots ---

export function insertInventorySnapshot(db: Database.Database, snapshot: InventorySnapshotRow): void {
  db.prepare(`
    INSERT INTO inventory_snapshots (captured_at, skill_count, mcp_server_count, agent_count)
    VALUES (?, ?, ?, ?)
  `).run(snapshot.capturedAt, snapshot.skillCount, snapshot.mcpServerCount, snapshot.agentCount);
}

export function readInventorySnapshots(db: Database.Database, limit = 10): InventorySnapshotRow[] {
  return db.prepare(`
    SELECT captured_at as capturedAt, skill_count as skillCount, mcp_server_count as mcpServerCount, agent_count as agentCount
    FROM inventory_snapshots
    ORDER BY id DESC
    LIMIT ?
  `).all(limit) as InventorySnapshotRow[];
}

// --- Action Results ---

export function insertActionResult(db: Database.Database, result: ActionResultRow): void {
  db.prepare(`
    INSERT INTO action_results (run_timestamp, domain, action_id, action_type, target, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(result.runTimestamp, result.domain, result.actionId, result.actionType, result.target ?? null, result.status);
}

export function readActionResults(db: Database.Database, domain?: string, limit = 100): ActionResultRow[] {
  if (domain) {
    return db.prepare(`
      SELECT run_timestamp as runTimestamp, domain, action_id as actionId, action_type as actionType, target, status
      FROM action_results
      WHERE domain = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(domain, limit) as ActionResultRow[];
  }
  return db.prepare(`
    SELECT run_timestamp as runTimestamp, domain, action_id as actionId, action_type as actionType, target, status
    FROM action_results
    ORDER BY id DESC
    LIMIT ?
  `).all(limit) as ActionResultRow[];
}
