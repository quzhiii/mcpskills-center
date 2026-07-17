# Command Reference

Detailed reference for every MCPskills Center CLI command.

Unless an absolute path is shown, `reports/` and `backups/` below are subdirectories of the platform user data root displayed by `mcpskills config path`.

## Global Options

| Flag | Description |
|---|---|
| `--dry-run` | Plan without writing any files |
| `--apply` | Execute the plan |
| `--force` | Overwrite known user config files during `init` |
| `--confirm` | Required to actually apply changes |
| `--restore <manifest>` | Restore from a backup manifest |
| `--canonical-dir <path>` | Custom canonical skills directory |
| `--active` | Enable active health probes |
| `--allow-command <cmd>` | Allowlist a command for active probes |
| `--timeout <ms>` | Probe timeout in milliseconds (default: 3000) |

---

## init

Create missing editable configuration under the platform user data root.

```bash
mcpskills init --dry-run
mcpskills init
mcpskills init --force --confirm
```

The default mode skips existing files. Forced overwrite requires `--confirm` and preserves unknown files in the profiles directory.

## config

```bash
mcpskills config path
mcpskills config validate
```

`config path` shows user candidates and effective `user`, `bundled`, or `default` sources. `config validate` aggregates agents, sync, profiles, scanner, and routing diagnostics without displaying configuration contents or secret values. Neither command opens SQLite or creates runtime directories.

## doctor

```bash
mcpskills doctor
```

Runs read-only Node, configuration, storage, scanner, and optional Agent checks. It does not open SQLite, generate reports, create probe files, spawn Agent/MCP processes, or use the network. A missing optional Agent is reported as `SKIPPED`; malformed config and inaccessible declared paths are errors.

Warnings and skipped optional Agents do not fail the command. Any `ERROR` diagnostic produces a non-zero exit code.

---

## scan

Scan the local machine inventory, normalize records, run audit checks, and generate reports.

```bash
mcpskills scan
# or
npm run scan
```

**Writes:**

- `reports/inventory-current.json`
- `reports/inventory-current.md`
- `reports/audit-current.md`
- `reports/dashboard.html`

**Output example:**

```
Scan complete!
   Skills: 42
   MCP Servers: 18
   Issues: 3

   Reports written to: reports/
```

**Error cases:**

- If no agents are configured, scan completes with zero counts.
- Permission errors on agent skill directories surface as audit issues, not hard failures.

---

## audit

Print an audit summary to the terminal without writing any files.

```bash
mcpskills audit
# or
npm run audit
```

**Writes:** None

**Output example:**

```
Audit Summary
   Total Skills: 42
   Total MCP Servers: 18
   Duplicate Skills: 2
   Duplicate MCPs: 1
   Missing SKILL.md: 3
   Broken Symlinks: 0
   Sensitive Env: 1

Issues found:
   [WARNING] duplicate-skill: debug-pro
   [WARNING] duplicate-mcp: playwright
   [ERROR] missing-skill-md: custom-helper
```

**Error cases:**

- Returns a zero-count summary if no inventory exists yet.

---

## sync

Manage canonical skill distribution across agents.

### sync --dry-run

Generate a sync plan without changing any agent config.

```bash
mcpskills sync --dry-run
mcpskills sync --dry-run --canonical-dir C:\path\to\canonical-skills
```

**Writes:**

- `reports/sync-plan-current.json`
- `reports/sync-plan-current.md`
- `reports/inventory-current.json` (refreshed)
- `reports/inventory-current.md` (refreshed)
- `reports/audit-current.md` (refreshed)
- `reports/dashboard.html` (refreshed)

**Output example:**

```
Sync dry-run complete!
   Skills: 42
   MCP Servers: 18
   Audit Issues: 3
   Sync Actions: 12
   Write Actions: 5
   Action Types: copy=3, symlink=2, skip=7

   Reports written to: reports/
```

**Error cases:**

- If `--canonical-dir` points to a non-existent path, the plan will produce zero write actions.

### sync --apply --confirm

Apply the current sync plan with timestamped backups.

```bash
mcpskills sync --apply --confirm
```

**Writes:**

- Backup content under `backups/`
- One consolidated manifest JSON for the apply run

**Output example:**

```
Sync apply complete!
   Applied Actions: 5
   Backup Entries: 3
   Receipts: 5
   Action Types: copy=3, symlink=2
   Manifest: backups/sync-manifest-2026-06-10T12-00-00.json
```

**Error cases:**

- Fails without `--confirm`.
- Fails if source or target paths are outside approved roots defined in `config/sync.json`.

### sync --restore \<manifest\>

Restore a previous apply run from its manifest.

```bash
mcpskills sync --restore backups/sync-manifest-2026-06-10T12-00-00.json
```

**Writes:** Restores files to their original target paths.

**Output example:**

```
Sync restore complete!
   Restored Entries: 5
   Restored Targets: 3
   Action Types: copy=3, symlink=2
   Manifest: backups/sync-manifest-2026-06-10T12-00-00.json
```

**Error cases:**

- Fails if the manifest path does not exist.
- Fails if target paths are outside approved roots.

---

## mcp

MCP server governance commands.

### mcp plan

Generate an MCP governance plan (read-only dry-run).

```bash
mcpskills mcp plan
```

**Writes:**

- `reports/mcp-governance-plan-current.json`
- `reports/mcp-governance-plan-current.md`
- `reports/governance-current.json`

**Output example:**

```
MCP governance dry-run complete!
   MCP Servers: 18
   Governance Actions: 12
   Canonical Candidates: 6
   Manual Review: 2
   Canonical Profile Eligible: 4
   Canonical Profile Blocked: 2
   Write Actions: 5
   Write-Ready Candidates: 8

   Reports written to: reports/
```

### mcp apply --confirm

Apply the MCP governance plan with backups.

```bash
mcpskills mcp apply --confirm
```

**Writes:**

- Backup content under `backups/`
- One consolidated MCP manifest

**Output example:**

```
MCP apply complete!
   Applied Actions: 5
   Backup Entries: 3
   Receipts: 5
   Manifest: backups/mcp-manifest-2026-06-10T12-00-00.json
```

**Error cases:**

- Fails without `--confirm`.
- Errors if MCP apply is not configured in the runtime context.

### mcp restore \<manifest\>

Restore MCP config from a backup manifest.

```bash
mcpskills mcp restore backups/mcp-manifest-2026-06-10T12-00-00.json
```

**Writes:** Restores MCP config files to their original paths.

**Output example:**

```
MCP restore complete!
   Restored Entries: 3
   Manifest: backups/mcp-manifest-2026-06-10T12-00-00.json
```

**Error cases:**

- Fails if the manifest path is not provided.
- Errors if MCP restore is not configured in the runtime context.

---

## governance

Unified governance command that operates on both skills and MCP servers together.

### governance --dry-run

Generate a unified governance plan for skills and MCP.

```bash
mcpskills governance --dry-run
```

**Writes:**

- `reports/governance-current.json`
- `reports/governance-current.md`
- `reports/governance-console.html`
- `reports/sync-plan-current.json` / `.md`
- `reports/mcp-governance-plan-current.json` / `.md`
- `reports/inventory-current.json` / `.md`
- `reports/audit-current.md`
- `reports/dashboard.html`

**Output example:**

```
Governance dry-run complete!

Skills Sync:
   Skills: 42
   Sync Actions: 12
   Write Actions: 5
   Action Types: copy=3, symlink=2, skip=7

MCP Governance:
   MCP Servers: 18
   Governance Actions: 12
   Canonical Candidates: 6
   Manual Review: 2
   Write Actions: 5

   Reports written to: reports/
   Unified report: reports/governance-current.json
   Console: reports/governance-console.html
```

### governance --apply --confirm

Apply both skills sync and MCP governance plans.

```bash
mcpskills governance --apply --confirm
```

**Writes:**

- Backup content under `backups/`
- Skills manifest and MCP manifest
- History entry appended to `reports/governance-history.json`
- SQLite entries (if database is configured)

**Output example:**

```
Governance apply complete!

Skills:
   Applied Actions: 5
   Backup Entries: 3
   Receipts: 5
   Manifest: backups/sync-manifest-2026-06-10T12-00-00.json

MCP:
   Applied Actions: 4
   Backup Entries: 2
   Receipts: 4
   Manifest: backups/mcp-manifest-2026-06-10T12-00-00.json
```

**Error cases:**

- Fails without `--confirm`.
- If MCP apply is not configured, only skills governance runs.

### governance --restore \<manifest\>

Restore both skills and MCP from a shared manifest path.

```bash
mcpskills governance --restore backups/manifest-2026-06-10T12-00-00.json
```

**Writes:** Restores skills and MCP config files to their original paths.

**Output example:**

```
Governance restore complete!

Skills Sync:
   Restored Entries: 5
   Manifest: backups/manifest-2026-06-10T12-00-00.json

MCP Governance:
   Restored Entries: 3
   Manifest: backups/manifest-2026-06-10T12-00-00.json
```

---

## governance-diff

Compare the current and previous governance plans to show what changed.

```bash
mcpskills governance-diff
```

**Writes:** None

**Output:** Shows added, removed, and changed actions between `sync-plan-current.json` and `sync-plan-previous.json` (and the MCP equivalents).

**Error cases:**

- If no previous plan exists, reports that diff is not available.

---

## history

View the governance operation history log.

```bash
mcpskills history
```

**Writes:** None

**Output example:**

```
Governance History:
   2026-06-10T12:00:00Z | apply | unified | 9 actions | backups/manifest-2026-06-10.json
   2026-06-09T08:30:00Z | apply | skills  | 5 actions | backups/sync-manifest-2026-06-09.json
   2026-06-08T15:00:00Z | restore | skills | 3 entries | backups/sync-manifest-2026-06-08.json
```

**Source:** Reads from `reports/governance-history.json` or SQLite database.

---

## route

Recommend which agent to use for a given task description.

```bash
mcpskills route "fix this bug in the auth module"
mcpskills route "research the best testing framework"
```

**Writes:** None

**Output example:**

```
Route Recommendation:
   Task: fix this bug in the auth module
   Category: coding
   Recommended: claude-code
   Alternatives: opencode, codex
   Reasoning: Task matches 'coding' category; claude-code is the preferred agent.
```

**Error cases:**

- Returns usage help if no task description is provided.
- If no category matches, falls back to the first agent in `fallbackOrder`.

---

## profile

Profile management commands.

### profile list

List all available local profiles.

```bash
mcpskills profile list
```

**Writes:** None

**Output example:**

```
Available profiles:
   coding - Core development workflow with testing and debugging support
   research - Investigation and web-reading workflow
   lark-office - Feishu/Lark and document-production workflow
   security - Defensive review and security-audit workflow
```

### profile show \<name\>

Print one profile as formatted JSON.

```bash
mcpskills profile show coding
```

**Writes:** None

**Output:** Pretty-printed JSON of the profile definition.

**Error cases:**

- Fails if the profile name is not found.

### profile plan \<name\>

Compare a profile against the current inventory and report gaps.

```bash
mcpskills profile plan coding
```

**Writes:** None

**Output example:**

```
Profile plan: coding
   [already-present] skill: test-runner - already installed
   [missing] skill: debug-pro - not found in inventory
   [disable] mcp: playwright - not required by profile
```

**Error cases:**

- Fails if the profile name is not found.

---

## agents

Agent registry management commands.

### agents list

List registered local agents from `config/agents.json`.

```bash
mcpskills agents list
```

**Writes:** None

**Output example:**

```
Registered agents:
   claude-code - Claude Code [scanner: claude-code, enabled, write-capable, support: Dedicated read-only plus write-ready workflow support, source-of-truth-confidence: High]
   opencode - OpenCode [scanner: opencode, enabled, write-capable, support: Dedicated read-only plus write-ready workflow support, source-of-truth-confidence: High]
   codex - Codex [scanner: codex, enabled, write-capable, support: Dedicated read-only plus write-ready workflow support, source-of-truth-confidence: High]
   codebuddy - CodeBuddy [scanner: codebuddy, enabled, read-only, support: Dedicated read-only, source-of-truth-confidence: Medium]
```

**Note:** Disabled entries (`enabled: false`) are filtered out of the runtime-loaded list.

### agents discover

Discover local agent config candidates by checking known paths.

```bash
mcpskills agents discover
```

**Writes:**

- `reports/agent-discovery-current.json`
- `reports/agent-discovery-current.md`
- `reports/governance-current.json`

**Output example:**

```
Agent discovery complete!
   Candidates: 6

   Reports written to: reports/
```

**Error cases:**

- Discovery is read-only and never modifies agent config.

---

## matrix

Build a cross-agent capability matrix for discovered skills and MCP servers.

```bash
mcpskills matrix
```

**Writes:**

- `reports/capability-matrix-current.json`
- `reports/capability-matrix-current.md`

**Output example:**

```
Capability matrix complete!
   Skill Capabilities: 35
   MCP Capabilities: 12

   Reports written to: reports/
```

---

## health

Run MCP server health checks.

### health (passive)

Run passive health checks: validate transport shape, command presence, URL validity, and sensitive env key risk.

```bash
mcpskills health
```

**Writes:** None

**Output example:**

```
Running passive MCP health checks...
   [PASS] playwright: transport=http, command present
   [WARN] custom-server: missing command field
   [FAIL] broken-server: invalid URL
```

### health --active

Run explicit active command probes for allowlisted commands.

```bash
mcpskills health --active --allow-command npx --timeout 3000
```

**Writes:** None

**Output example:**

```
Running active MCP health checks...
   [PASS] playwright: npx --version returned 9.8.0
   [FAIL] custom-server: command not in allowlist
```

**Error cases:**

- Active probes only run for commands explicitly passed via `--allow-command`.
- Commands that do not return within `--timeout` are marked as failed.
- Uses `spawn(command, ['--version'], { shell: false })` semantics, not shell strings.

---

## help

Show CLI help text.

```bash
mcpskills help
```

**Writes:** None

**Output:** Full help text listing all commands, options, and examples.
