# MCPskills Center

Local-first CLI for managing MCP servers and agent skills across Claude Code, OpenCode, and Codex.

The project turns scattered local agent configuration into a readable inventory, audit report, dry-run sync plan, profile plan, health report, and static dashboard. It is designed for this machine first, not SaaS.

## Current Capabilities

- Scan Claude Code, OpenCode, and Codex skills/MCP config.
- Parse JSON, UTF-8 BOM JSON, and Codex TOML config.
- Generate inventory and audit reports.
- Generate actionable audit recommendations.
- Generate canonical skill sync dry-run plans.
- Apply sync write actions with explicit confirmation and backup manifests.
- Restore prior sync writes from a backup manifest.
- Load local MCP/skill profiles from `config/profiles/*.json`.
- Generate profile plans without writing config.
- Run passive MCP health checks by default.
- Run explicit active MCP command probes with allowlist and timeout.
- Generate an offline static dashboard at `reports/dashboard.html`.

## Install

```bash
npm install
```

## Verify

```bash
npm run build
npm test
npm audit --audit-level=moderate
```

## Commands

### Scan

```bash
npm run scan
```

Equivalent:

```bash
node dist/index.js scan
```

Writes generated reports to `reports/`:

- `reports/inventory-current.json`
- `reports/inventory-current.md`
- `reports/audit-current.md`
- `reports/dashboard.html`

### Audit

```bash
npm run audit
```

Prints a console summary of duplicate skills, duplicate MCPs, missing `SKILL.md`, symlink review items, and sensitive env key risk.

### Sync Dry-Run

```bash
node dist/index.js sync --dry-run
```

Optional canonical directory:

```bash
node dist/index.js sync --dry-run --canonical-dir E:\path\to\canonical-skills
```

Writes generated sync plan reports:

- `reports/sync-plan-current.json`
- `reports/sync-plan-current.md`

Dry-run mode does not write to agent config or skill directories. Use the separate apply/restore commands below for explicit write operations.

### Sync Apply

Apply the current sync plan only after explicit confirmation:

```bash
node dist/index.js sync --apply --confirm
```

Optional canonical directory:

```bash
node dist/index.js sync --apply --confirm --canonical-dir E:\path\to\canonical-skills
```

Apply mode:

- Recomputes the sync plan from the current inventory.
- Applies only write actions from that plan.
- Backs up each existing target before overwrite.
- Writes one consolidated backup manifest under `backups/` for the apply run.

Safeguards:

- `--confirm` is required.
- Only roots listed in `config/sync.json` under `approvedSyncRoots` are writable.
- New targets are created without backup because no previous target exists.

### Sync Restore

Restore a prior sync apply from its manifest:

```bash
node dist/index.js sync --restore E:\path\to\manifest.json
```

Restore mode copies each backed-up directory from the manifest back to its original target path.

### Profiles

List profiles:

```bash
node dist/index.js profile list
```

Show one profile:

```bash
node dist/index.js profile show coding
```

Plan one profile against current inventory:

```bash
node dist/index.js profile plan coding
```

Profile files live in `config/profiles/`:

- `coding.json`
- `research.json`
- `lark-office.json`
- `security.json`

Profile planning is read-only. It reports `already-present`, `missing`, and `disable` actions without changing any agent config.

### Sync Config

Sync write approvals live in `config/sync.json`:

```json
{
  "approvedSyncRoots": [
    "config/canonical-skills",
    "C:/Users/quzhi/.claude/skills",
    "C:/Users/quzhi/.opencode/skills",
    "C:/Users/quzhi/.codex/skills"
  ]
}
```

If this file is missing, the CLI falls back to the same conservative defaults. Invalid values fail before apply runs.

### Health Checks

Passive checks, default and safe:

```bash
node dist/index.js health
```

Passive mode does not spawn commands. It checks transport, URL presence/shape, command presence, and sensitive env key risk.

Active checks, explicit only:

```bash
node dist/index.js health --active --allow-command npx --timeout 3000
```

Active mode only probes allowlisted commands with `--version`, uses `spawn(command, args, { shell: false })`, and times out. Non-allowlisted commands are refused.

### Help

```bash
node dist/index.js help
```

## Safety Model

- Default behavior is read-only or dry-run.
- Sync writes require explicit `--apply --confirm`.
- Sync restore requires an explicit manifest path.
- No command writes to agent config by default.
- Generated reports do not print secret values.
- Sensitive env detection reports key risk only.
- Active health checks require `--active` and explicit command allowlist.
- Active health checks use args arrays, not shell strings.
- Sync apply only writes to roots approved in `config/sync.json`.
- Sync apply backs up existing targets before overwrite and writes a restore manifest.
- Generated reports are ignored by git.

## Generated Files

Ignored generated outputs:

- `dist/`
- `reports/*.json`
- `reports/*.md`
- `reports/*.html`
- `node_modules/`

## Fixture Policy

- `.claude/` is treated as local machine configuration and ignored by git.
- Repository-tracked skill samples live under `fixtures/skills/`.
- Those fixtures are synthetic and minimal; they are not copies of the user's live installed skills.

## Current Limitations

- Approved sync roots are user-configurable in `config/sync.json`; the current sample is machine-specific.
- Profile planning matches short MCP ids such as `playwright` against project-scoped inventory ids such as `C:/Users/quzhi:playwright`.
- Passive HTTP/SSE health checks validate scanner-preserved URL/host values when they are present in agent config.
- The repository keeps only synthetic fixture skills; live local `.claude/` content is not versioned.
- There is no packaged binary yet; use `node dist/index.js ...` after build.

## Project Docs

- `docs/MCPskills-center-background-and-plan.md`
- `docs/migration-notes.md`
- `docs/plans/2026-06-03-mcpskills-center-completion.md`

## Recommended Next Work

1. Consider a portable template for `config/sync.json` if this becomes multi-machine.
2. Expand synthetic fixtures only when a new test needs a stable on-disk example.
