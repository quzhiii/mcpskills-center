const { DatabaseSync } = require("node:sqlite");

const dbPath = process.argv[2] || "C:/Users/quzhi/.local/share/opencode/opencode.db";
const db = new DatabaseSync(dbPath);

const before = db
  .prepare("select id, worktree, vcs from project where vcs = 'none' order by worktree")
  .all();

db.exec("begin immediate");
try {
  db.prepare("update project set vcs = NULL where vcs = 'none'").run();
  db.exec("commit");
} catch (error) {
  db.exec("rollback");
  throw error;
}

const after = db
  .prepare("select id, worktree, vcs from project where vcs = 'none' order by worktree")
  .all();

const summary = {
  dbPath,
  changed: before.length,
  before,
  remainingNone: after.length,
  vcsCounts: db
    .prepare("select coalesce(vcs, '<NULL>') as vcs, count(*) as count from project group by vcs order by vcs")
    .all(),
};

console.log(JSON.stringify(summary, null, 2));
