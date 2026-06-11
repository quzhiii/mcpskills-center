# Governance Guide

MCPskills Center provides a layered governance model for managing agent skills and MCP server configurations safely.

---

## What Is Governance?

Governance is the controlled lifecycle of agent capabilities: inventorying what exists, planning what should change, applying changes with backups, and restoring when needed.

There are three governance layers:

| Layer | Scope | Command |
|---|---|---|
| Skills governance | Skill files across agent directories | `sync` |
| MCP governance | MCP server configurations | `mcp` |
| Unified governance | Both skills and MCP together | `governance` |

All three follow the same safety model: **plan first, apply only with confirmation, restore from manifests**.

---

## Skills Governance

Skills governance manages the distribution of canonical skill files to agent skill directories.

### How it works

1. **Scan** — inventory all skills across all agents
2. **Normalize** — deduplicate and unify metadata
3. **Plan** — generate a sync plan (copy, symlink, or skip actions)
4. **Dry-run** — review the plan before writing
5. **Apply** — execute the plan with `--confirm`, creating backups
6. **Restore** — roll back from a manifest if needed

### Commands

```bash
mcpskills sync --dry-run                          # Plan only
mcpskills sync --apply --confirm                  # Execute plan
mcpskills sync --restore backups/manifest.json    # Roll back
```

### Sync strategies

The planner uses a canonical store plus distribution actions to agent skill roots. Actions are:

| Action | Description |
|---|---|
| `copy` | Copy skill files from canonical to agent directory |
| `symlink` | Create symbolic link to canonical skill |
| `skip` | Skill already present or not applicable |

### Custom canonical directory

```bash
mcpskills sync --dry-run --canonical-dir C:\path\to\skills
```

When applying with a custom canonical directory, add it to `config/sync.json` under `approvedSyncRoots` first.

---

## MCP Governance

MCP governance manages MCP server configurations across agent config files.

### How it works

1. **Scan** — inventory all MCP servers from all agents
2. **Normalize** — unify config formats (JSON, TOML, etc.)
3. **Plan** — generate governance actions (canonical targets, env risk policies, scope policies)
4. **Apply** — serialize changes to agent config files with backups
5. **Restore** — roll back from a manifest

### Commands

```bash
mcpskills mcp plan                    # Generate plan
mcpskills mcp apply --confirm         # Apply plan
mcpskills mcp restore <manifest>      # Restore
```

### MCP governance actions

| Action type | Description |
|---|---|
| `canonical-target` | Normalize MCP server ID to a canonical form |
| `env-risk` | Flag servers with sensitive environment variables |
| `scope-policy` | Determine global vs. project-scoped config placement |
| `manual-review` | Requires human decision before proceeding |
| `write-ready` | Agent adapter supports serialization |

### Current status

MCP governance is active on the read-only/report-first lane. MCP config writes are enabled for write-ready agents (Claude Code, OpenCode, Codex) when their adapters support serialization.

---

## Unified Governance

The `governance` command runs both skills and MCP governance in a single pass.

### Commands

```bash
mcpskills governance --dry-run                           # Plan both
mcpskills governance --apply --confirm                   # Apply both
mcpskills governance --restore backups/manifest.json     # Restore both
```

### What it writes

Unified governance produces a consolidated report set:

- `reports/governance-current.json` — combined skills + MCP plan
- `reports/governance-current.md` — human-readable summary
- `reports/governance-console.html` — offline HTML dashboard
- Individual skills and MCP plan reports

### History tracking

Every apply and restore operation is logged to `reports/governance-history.json` (or SQLite if configured). View with:

```bash
mcpskills history
```

Each entry records: timestamp, operation type, domain (skills/mcp/unified), action count, manifest path, and summary.

---

## Backup and Restore

### How backups work

When `--apply` runs:

1. Each target file is copied to `backups/` before overwrite
2. A manifest JSON is written with all backup entries, receipts, and metadata
3. The manifest path is printed for future restore use

### Manifest structure

```json
{
  "timestamp": "2026-06-10T12:00:00.000Z",
  "domain": "skills",
  "entries": [
    {
      "actionId": "copy:debug-pro",
      "targetPath": "C:/Users/quzhi/.claude/skills/debug-pro",
      "backupPath": "backups/debug-pro-2026-06-10T12-00-00"
    }
  ]
}
```

### Restoring

```bash
mcpskills sync --restore backups/sync-manifest-2026-06-10T12-00-00.json
mcpskills mcp restore backups/mcp-manifest-2026-06-10T12-00-00.json
mcpskills governance --restore backups/manifest-2026-06-10T12-00-00.json
```

Restore copies backed-up content from the manifest back to the original target path after approved-root validation.

---

## Approved Roots

Writable paths are controlled by `config/sync.json`:

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

**Rules:**

- Relative paths resolve from the project root
- Apply and restore validate both source and target paths against approved roots
- Paths outside approved roots are rejected before any writes
- Invalid values fail before an apply run begins

---

## Safety Model

The safety model is designed around these principles:

| Principle | Implementation |
|---|---|
| Default is read-only | `scan`, `audit`, `sync --dry-run`, `mcp plan` never write agent config |
| Explicit confirmation | `--apply` requires `--confirm` |
| Explicit restore | `--restore` requires a manifest path |
| Approved roots only | All writes validated against `config/sync.json` |
| Backup before overwrite | Existing targets backed up to `backups/` |
| No secret exposure | Reports never print secret values |
| Passive by default | Health checks don't spawn commands unless `--active` is set |
| Argument arrays | Active probes use `spawn` arrays, not shell strings |

---

## Reviewing Plans Before Applying

Always review the dry-run output before applying:

```bash
# Step 1: Generate plan
mcpskills governance --dry-run

# Step 2: Review reports
# Open reports/governance-current.json or reports/governance-console.html

# Step 3: Apply if satisfied
mcpskills governance --apply --confirm
```

The plan reports show every action that will be taken, categorized by type. Pay attention to:

- `manual-review` actions that need human decision
- `env-risk` flags on MCP servers with sensitive variables
- `write-actions` count to understand the scope of changes

---

## governance-diff

Compare the current plan against the previous plan to see what changed between runs.

```bash
mcpskills governance-diff
```

This compares:

- `reports/sync-plan-current.json` vs. `reports/sync-plan-previous.json`
- `reports/mcp-governance-plan-current.json` vs. `reports/mcp-governance-plan-previous.json`

**Use case:** After re-scanning, check if any new issues appeared or if previously flagged items were resolved.

**Note:** Previous plans are automatically snapshot when `--apply` runs. If no apply has been run yet, diff reports that no previous plan exists.

---

## Operation History

Track all governance operations over time:

```bash
mcpskills history
```

**Storage:**

- Primary: `reports/governance-history.json` (JSON lines format)
- Optional: SQLite database if configured

**Each entry contains:**

- `timestamp` — ISO 8601 timestamp
- `operation` — `apply` or `restore`
- `domain` — `skills`, `mcp`, or `unified`
- `actionCount` — number of actions executed
- `manifestPath` — path to the backup manifest
- `summary` — human-readable description

**Use cases:**

- Audit trail for compliance
- Debugging when something goes wrong
- Understanding the history of changes on a machine
