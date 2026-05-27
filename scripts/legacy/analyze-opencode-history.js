const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const dbPath = process.argv[2] || "C:/tmp/opencode-db-snapshot-20260517/opencode.db";
const globalDatPath =
  process.argv[3] || "C:/Users/quzhi/AppData/Roaming/ai.opencode.desktop/opencode.global.dat";

function normalizePath(value) {
  if (!value) return "";
  let result = String(value).replaceAll("/", "\\").replace(/\\+$/, "");
  if (/^[a-z]:/.test(result)) result = result[0].toUpperCase() + result.slice(1);
  return result;
}

function basename(value) {
  const normalized = normalizePath(value);
  const parts = normalized.split("\\").filter(Boolean);
  return parts[parts.length - 1] || normalized || "(empty)";
}

function parseGlobalDat(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const obj = JSON.parse(raw);
  const parsed = {};
  for (const [key, value] of Object.entries(obj)) {
    try {
      parsed[key] = JSON.parse(value);
    } catch {
      parsed[key] = value;
    }
  }
  return { obj, parsed };
}

const db = new DatabaseSync(dbPath, { readOnly: true });
const all = (sql, params = []) => db.prepare(sql).all(...params);

const { parsed } = parseGlobalDat(globalDatPath);
const server = parsed.server || {};
const localProjects = server.projects?.local || [];
const syncedProjects = parsed["globalSync.project"]?.value || [];
const lastProjectSession = parsed["layout.page.lastProjectSession"]?.value || [];

const dbProjects = all(`
  select id, worktree, vcs, time_created, time_updated
  from project
  order by time_updated desc
`);

const sessionRows = all(`
  select
    s.id,
    s.project_id,
    s.directory,
    s.title,
    s.time_created,
    s.time_updated,
    s.time_archived,
    p.worktree as project_worktree,
    p.vcs as project_vcs,
    coalesce(mc.count, 0) as message_count,
    coalesce(pc.count, 0) as part_count
  from session s
  left join project p on p.id = s.project_id
  left join (
    select session_id, count(*) as count from message group by session_id
  ) mc on mc.session_id = s.id
  left join (
    select session_id, count(*) as count from part group by session_id
  ) pc on pc.session_id = s.id
  order by s.time_updated desc
`);

const groups = new Map();
for (const row of sessionRows) {
  const key = normalizePath(row.directory);
  const group = groups.get(key) || {
    directory: row.directory,
    projectIds: new Set(),
    projectWorktrees: new Set(),
    total: 0,
    visible: 0,
    archived: 0,
    messages: 0,
    parts: 0,
    latestUpdated: 0,
    latestTitle: "",
    latestSessionId: "",
  };
  group.total++;
  if (row.time_archived) group.archived++;
  else group.visible++;
  group.messages += Number(row.message_count || 0);
  group.parts += Number(row.part_count || 0);
  group.latestUpdated = Math.max(group.latestUpdated, Number(row.time_updated || 0));
  if (!group.latestTitle) {
    group.latestTitle = row.title;
    group.latestSessionId = row.id;
  }
  group.projectIds.add(row.project_id);
  if (row.project_worktree) group.projectWorktrees.add(row.project_worktree);
  groups.set(key, group);
}

function materializeGroup(group) {
  return {
    directory: group.directory,
    name: basename(group.directory),
    sessions: group.total,
    visible: group.visible,
    archived: group.archived,
    messages: group.messages,
    parts: group.parts,
    latestUpdated: group.latestUpdated,
    latestTitle: group.latestTitle,
    latestSessionId: group.latestSessionId,
    projectIds: Array.from(group.projectIds),
    projectWorktrees: Array.from(group.projectWorktrees),
  };
}

const byDirectory = Array.from(groups.values())
  .map(materializeGroup)
  .sort((a, b) => b.latestUpdated - a.latestUpdated);

const localByWorktree = new Map(localProjects.map((p) => [normalizePath(p.worktree), p]));
const syncedByWorktree = new Map(syncedProjects.map((p) => [normalizePath(p.worktree), p]));
const dbProjectByWorktree = new Map(dbProjects.map((p) => [normalizePath(p.worktree), p]));

const railProjects = localProjects.map((project) => {
  const key = normalizePath(project.worktree);
  const exact = groups.get(key);
  const descendants = byDirectory.filter((group) => {
    const groupKey = normalizePath(group.directory);
    return groupKey && key && groupKey.startsWith(`${key}\\`) && groupKey !== key;
  });
  return {
    worktree: project.worktree,
    name: basename(project.worktree),
    inDbProject: dbProjectByWorktree.has(key),
    inGlobalSyncProject: syncedByWorktree.has(key),
    exactSessions: exact?.sessions || 0,
    exactVisible: exact?.visible || 0,
    exactMessages: exact?.messages || 0,
    descendantSessionGroups: descendants.length,
    descendantSessions: descendants.reduce((sum, item) => sum + item.sessions, 0),
    latestExactTitle: exact?.latestTitle || "",
  };
});

const dbDirsNotInRail = byDirectory.filter((group) => {
  const key = normalizePath(group.directory);
  return !localByWorktree.has(key);
});

const orphanProjectIds = all(`
  select s.project_id, count(*) as sessions, max(s.time_updated) as latestUpdated
  from session s
  left join project p on p.id = s.project_id
  where p.id is null
  group by s.project_id
  order by sessions desc
`);

const sessionsWithNoMessages = sessionRows
  .filter((row) => Number(row.message_count || 0) === 0 && Number(row.part_count || 0) === 0)
  .slice(0, 20)
  .map((row) => ({
    id: row.id,
    title: row.title,
    directory: row.directory,
    project_id: row.project_id,
    updated: row.time_updated,
  }));

console.log(
  JSON.stringify(
    {
      counts: {
        dbProjects: dbProjects.length,
        dbSessions: sessionRows.length,
        desktopRailProjects: localProjects.length,
        globalSyncProjects: syncedProjects.length,
        lastProjectSession: Array.isArray(lastProjectSession) ? lastProjectSession.length : 0,
      },
      railProjects,
      dbDirectoriesTop: byDirectory.slice(0, 60),
      dbDirsNotInRail: dbDirsNotInRail.slice(0, 60),
      orphanProjectIds,
      sessionsWithNoMessages,
      globalKeys: Object.keys(parsed).sort(),
    },
    null,
    2,
  ),
);
