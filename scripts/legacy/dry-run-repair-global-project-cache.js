const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = process.argv[2] || "C:/Users/quzhi/.local/share/opencode/opencode.db";
const globalDatPath =
  process.argv[3] || "C:/Users/quzhi/AppData/Roaming/ai.opencode.desktop/opencode.global.dat";
const outPath = process.argv[4] || "";

function normalizePath(value) {
  if (!value) return "";
  let result = String(value).replaceAll("/", "\\").replace(/\\+$/, "");
  if (/^[a-z]:/.test(result)) result = result[0].toUpperCase() + result.slice(1);
  return result;
}

function parseGlobalDat(file) {
  const raw = fs.readFileSync(file, "utf8");
  const obj = JSON.parse(raw.replace(/^\uFEFF/, ""));
  const parsed = {};
  for (const [key, value] of Object.entries(obj)) {
    try {
      parsed[key] = JSON.parse(value);
    } catch {
      parsed[key] = value;
    }
  }
  return { raw, obj, parsed };
}

function querySessionsByDirectory(db, worktree) {
  const normalized = normalizePath(worktree);
  const rows = db
    .prepare(
      `select id, title, directory, time_updated, time_archived
       from session
       order by time_updated desc`,
    )
    .all();

  const exact = [];
  const descendants = [];
  for (const row of rows) {
    const dir = normalizePath(row.directory);
    if (dir === normalized) exact.push(row);
    else if (dir && normalized && dir.startsWith(`${normalized}\\`)) descendants.push(row);
  }
  return { exact, descendants };
}

function projectFromDbRow(row, fallbackWorktree) {
  const icon = {};
  if (row.icon_url) icon.url = row.icon_url;
  if (row.icon_color) icon.color = row.icon_color;
  return {
    id: row.id,
    worktree: row.worktree || fallbackWorktree,
    ...(row.vcs ? { vcs: row.vcs } : {}),
    ...(Object.keys(icon).length ? { icon } : {}),
    time: {
      created: row.time_created || Date.now(),
      updated: row.time_updated || row.time_created || Date.now(),
    },
    sandboxes: (() => {
      try {
        return row.sandboxes ? JSON.parse(row.sandboxes) : [];
      } catch {
        return [];
      }
    })(),
  };
}

const { obj, parsed } = parseGlobalDat(globalDatPath);
const db = new DatabaseSync(dbPath, { readOnly: true });
const all = (sql, params = []) => db.prepare(sql).all(...params);

const serverLocal = parsed.server?.projects?.local || [];
const globalSync = parsed["globalSync.project"] || { value: [] };
const existingSync = Array.isArray(globalSync.value) ? globalSync.value : [];
const dbProjects = all(`select * from project order by time_updated desc`);

const dbProjectByWorktree = new Map(dbProjects.map((row) => [normalizePath(row.worktree), row]));
const existingSyncByWorktree = new Map(existingSync.map((row) => [normalizePath(row.worktree), row]));

const candidates = [];
const skipped = [];

for (const rail of serverLocal) {
  const key = normalizePath(rail.worktree);
  const sessionMatches = querySessionsByDirectory(db, rail.worktree);
  const sessions = [...sessionMatches.exact, ...sessionMatches.descendants];
  const dbProject = dbProjectByWorktree.get(key);
  const alreadySynced = existingSyncByWorktree.has(key);

  const summary = {
    worktree: rail.worktree,
    dbProjectId: dbProject?.id || null,
    alreadySynced,
    exactSessions: sessionMatches.exact.length,
    descendantSessions: sessionMatches.descendants.length,
    latestSessionId: sessions[0]?.id || null,
    latestTitle: sessions[0]?.title || "",
  };

  if (alreadySynced) {
    skipped.push({ ...summary, reason: "already in globalSync.project" });
    continue;
  }
  if (!dbProject) {
    skipped.push({ ...summary, reason: "no matching DB project row" });
    continue;
  }
  if (sessions.length === 0) {
    skipped.push({ ...summary, reason: "no DB sessions for exact or descendant directory" });
    continue;
  }

  candidates.push({
    ...summary,
    proposedProject: projectFromDbRow(dbProject, rail.worktree),
  });
}

const mergedGlobalSyncProject = {
  ...globalSync,
  value: [...existingSync, ...candidates.map((item) => item.proposedProject)],
};

const simulatedObj = {
  ...obj,
  "globalSync.project": JSON.stringify(mergedGlobalSyncProject),
};

const report = {
  mode: outPath ? "copy-output" : "dry-run",
  dbPath,
  globalDatPath,
  counts: {
    dbProjects: dbProjects.length,
    dbSessions: all(`select count(*) as count from session`)[0].count,
    desktopRailProjects: serverLocal.length,
    existingGlobalSyncProjects: existingSync.length,
    proposedAdditions: candidates.length,
    simulatedGlobalSyncProjects: mergedGlobalSyncProject.value.length,
  },
  candidates,
  skipped,
  validation: {
    preservesTopLevelKeys: Object.keys(obj).every((key) => Object.hasOwn(simulatedObj, key)),
    simulatedGlobalSyncParses: Boolean(JSON.parse(simulatedObj["globalSync.project"])),
    dbUnchanged: true,
  },
};

if (outPath) {
  const serialized = JSON.stringify(simulatedObj);
  JSON.parse(serialized);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, serialized, "utf8");
}

console.log(JSON.stringify(report, null, 2));
