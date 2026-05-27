const { DatabaseSync } = require("node:sqlite");

const dbPath = process.argv[2] || "C:/tmp/opencode-db-snapshot-20260517/opencode.db";
const db = new DatabaseSync(dbPath, { readOnly: true });

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function maybe(sql) {
  try {
    return all(sql);
  } catch (error) {
    return { error: error.message };
  }
}

const schema = all(`
  select name, type, sql
  from sqlite_master
  where type in ('table', 'index', 'view')
  order by type, name
`);

const tables = schema.filter((row) => row.type === "table").map((row) => row.name);
const counts = Object.fromEntries(
  tables.map((name) => {
    try {
      return [name, all(`select count(*) as count from "${name}"`)[0].count];
    } catch (error) {
      return [name, `ERROR: ${error.message}`];
    }
  }),
);

const tableInfo = Object.fromEntries(
  tables.map((name) => [name, maybe(`pragma table_info("${name}")`)]),
);

const probes = {
  sessionSamples: maybe(`
    select *
    from session
    limit 5
  `),
  messageSamples: maybe(`
    select *
    from message
    limit 5
  `),
  partSamples: maybe(`
    select *
    from part
    limit 5
  `),
  projectSamples: maybe(`
    select *
    from project
    limit 20
  `),
};

console.log(JSON.stringify({ dbPath, counts, tableInfo, probes }, null, 2));
