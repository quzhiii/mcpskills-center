# MCPskills Center

<div align="center">

**Local-first CLI for scanning, auditing, planning, and synchronizing agent skills while inventorying MCP servers across Claude Code, OpenCode, Codex, CodeBuddy, WorkBuddy, Trae, Qoder, and Qoder Work.**

[![Runtime](https://img.shields.io/badge/runtime-Node.js-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Language](https://img.shields.io/badge/language-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Mode](https://img.shields.io/badge/mode-local--first-6f42c1)](#safety-model)
[![Default](https://img.shields.io/badge/default-read--only-success)](#safety-model)
[![Outputs](https://img.shields.io/badge/output-HTML%20%7C%20JSON%20%7C%20Markdown-lightgrey)](#outputs)

[中文文档](README.zh-CN.md) · **English**

[Quickstart](#quickstart) · [Outputs](#outputs) · [Commands](#commands) · [Scenarios](#scenarios) · [Supported Agents](docs/supported-agents.md) · [Profiles](#profiles) · [Safety](#safety-model) · [Boundaries](#boundaries)

</div>

---

## What Is This?

MCPskills Center gives one local machine a clear control surface for agent capabilities that are usually scattered across multiple tools.

It scans installed MCP servers and skill directories, normalizes their metadata, highlights duplicates and broken entries, generates dry-run plans, checks health status, and renders readable reports for review.

The product direction is CLI-first. The CLI remains the governance kernel and operational source of truth for scan, plan, apply, and restore. A local Web console wraps these artifacts but does not replace the CLI execution model.

```text
Claude Code / OpenCode / Codex ─┐
CodeBuddy / WorkBuddy / Trae ──┼─→ scan → audit → plan → verify → report
Qoder / Qoder Work ────────────┘                      │
                                                      ├─→ sync dry-run / apply / restore
                                                      ├─→ mcp plan / apply / restore
                                                      ├─→ governance (unified)
                                                      ├─→ route <task>
                                                      └─→ offline dashboard & console
```

| Capability | What it gives you |
|---|---|
| Inventory scanning | Unified view of MCP servers, skills, install paths, metadata, and issues |
| Audit reporting | Duplicate skills, duplicate MCPs, missing `SKILL.md`, symlink review items, sensitive env key risk |
| Skills sync | Canonical skill distribution plan with dry-run, apply, and restore |
| MCP governance | MCP config planning, apply, and restore with backup manifests for write-ready agents |
| Unified governance | `governance` command runs skills sync + MCP governance in one pass |
| Operation history | SQLite-backed history of all apply/restore operations |
| Plan diff | Compare current vs previous plans to see what changed |
| Agent routing | `route <task>` recommends which agent to use based on capabilities and policy |
| Profiles | Read-only planning for scenario-based capability bundles such as `coding` or `research` |
| Health checks | Passive validation by default, explicit active command probing when allowlisted |
| Dashboard & console | Static offline HTML reports at `reports/dashboard.html` and `reports/governance-console.html` |

Agent support status is summarized in `docs/supported-agents.md`.

---

## Quickstart

```bash
git clone https://github.com/quzhiii/mcpskills-center.git
cd mcpskills-center

npm install
npm test
npm run scan
```

Expected result:

- TypeScript builds successfully into `dist/`.
- Tests pass.
- Generated reports appear under `reports/`.
- `reports/dashboard.html` opens locally without external assets.

Next steps:

```bash
# Skills sync plan
node dist/index.js sync --dry-run

# MCP governance plan
node dist/index.js mcp plan

# Unified governance plan (both skills + MCP)
node dist/index.js governance --dry-run

# Route a task to the best agent
node dist/index.js route "implement a test"
```

---

## Outputs

`scan` writes:

- `reports/inventory-current.json`
- `reports/inventory-current.md`
- `reports/audit-current.md`
- `reports/dashboard.html`

`sync --dry-run` writes:

- `reports/sync-plan-current.json`
- `reports/sync-plan-current.md`

`mcp plan` writes:

- `reports/mcp-governance-plan-current.json`
- `reports/mcp-governance-plan-current.md`

`governance --dry-run` writes all of the above plus:

- `reports/governance-current.json` (unified report)
- `reports/governance-current.md` (unified report)
- `reports/governance-console.html` (offline governance dashboard)

`matrix` writes:

- `reports/capability-matrix-current.json`
- `reports/capability-matrix-current.md`

`sync --apply --confirm` and `mcp apply --confirm` write timestamped backup content under `backups/` and a consolidated manifest for each apply run.

---

## Commands

| Command | Purpose | Writes |
|---|---|---|
| `npm run scan` | Scan inventory, normalize records, audit findings, generate reports | `reports/` |
| `npm run audit` | Print audit summary in the terminal | None |
| `node dist/index.js sync --dry-run` | Generate a skills sync plan without changing agent config | `reports/` |
| `node dist/index.js sync --apply --confirm` | Apply the current sync plan with backups | `backups/` |
| `node dist/index.js sync --restore <manifest>` | Restore a previous sync apply from its manifest | Existing targets |
| `node dist/index.js mcp plan` | Generate MCP governance dry-run plan and reports | `reports/` |
| `node dist/index.js mcp apply --confirm` | Apply MCP governance plan with backups | `backups/` |
| `node dist/index.js mcp restore <manifest>` | Restore MCP config from backup manifest | Existing targets |
| `node dist/index.js governance --dry-run` | Unified skills + MCP governance plan | `reports/` |
| `node dist/index.js governance --apply --confirm` | Apply both skills sync and MCP governance | `backups/` |
| `node dist/index.js governance --restore <manifest>` | Restore both from manifest | Existing targets |
| `node dist/index.js governance-diff` | Compare current vs previous governance plans | None |
| `node dist/index.js history` | View governance operation history | None |
| `node dist/index.js route <task>` | Recommend which agent to use for a task | None |
| `node dist/index.js profile list` | List available local profiles | None |
| `node dist/index.js profile show <name>` | Print one profile JSON | None |
| `node dist/index.js profile plan <name>` | Compare a profile against the current inventory | None |
| `node dist/index.js agents list` | List registered local agents | None |
| `node dist/index.js agents discover` | Discover local agent config candidates | `reports/` |
| `node dist/index.js matrix` | Build a cross-agent capability matrix | `reports/` |
| `node dist/index.js health` | Run passive MCP health checks | None |
| `node dist/index.js health --active --allow-command <cmd>` | Run active command probes | None |
| `node dist/index.js help` | Show CLI help | None |

---

## Scenarios

### 1. Inspect the current machine state

```bash
npm run scan
```

Baseline inventory, audit report, and offline dashboard in one pass.

### 2. Review duplicates and risky entries

```bash
npm run audit
```

Quick summary of duplicate skills, duplicate MCPs, missing `SKILL.md`, symlink review items, and sensitive env key risk.

### 3. Plan a canonical skill sync

```bash
node dist/index.js sync --dry-run
```

### 4. Apply skills sync with backups

```bash
node dist/index.js sync --apply --confirm
```

### 5. Restore a previous sync apply

```bash
node dist/index.js sync --restore C:\path\to\manifest.json
```

### 6. Plan MCP governance

```bash
node dist/index.js mcp plan
```

Generates MCP governance dry-run plan with scope-aware decisions, canonical profile evidence, and target policy.

### 7. Apply MCP governance

```bash
node dist/index.js mcp apply --confirm
```

Applies MCP config changes to write-ready agents (Claude Code, OpenCode, Codex) with backup.

### 8. Unified governance (skills + MCP in one pass)

```bash
node dist/index.js governance --dry-run
node dist/index.js governance --apply --confirm
node dist/index.js governance --restore C:\path\to\manifest.json
```

### 9. Compare plans

```bash
node dist/index.js governance-diff
```

Shows added, removed, and changed actions since the last apply.

### 10. View operation history

```bash
node dist/index.js history
```

Shows all past apply/restore operations stored in SQLite.

### 11. Route a task to the best agent

```bash
node dist/index.js route "fix this bug"
node dist/index.js route "research AI agents"
node dist/index.js route "set up a database"
```

Returns a recommended agent with reasoning based on routing policy and agent capabilities.

### 12. Run health checks

```bash
node dist/index.js health
node dist/index.js health --active --allow-command npx --timeout 3000
```

---

## Profiles

Sample profiles live in `config/profiles/` and are evaluated read-only against the current inventory.

| Profile | Purpose | Agents |
|---|---|---|
| `coding` | Core development workflow with testing and debugging support | `claude-code`, `opencode`, `codex` |
| `research` | Investigation and web-reading workflow | `claude-code`, `opencode` |
| `lark-office` | Feishu/Lark and document-production workflow | `claude-code` |
| `security` | Defensive review and security-audit workflow | `claude-code` |

Example:

```bash
node dist/index.js profile list
node dist/index.js profile show coding
node dist/index.js profile plan coding
```

---

## Sync Approval Config

Writable sync roots are controlled by `config/sync.json`. Paths are resolved from the project root and `os.homedir()`.

---

## Safety Model

- Default behavior is read-only or dry-run.
- `sync --apply`, `mcp apply`, and `governance --apply` require explicit `--confirm`.
- Restore requires an explicit manifest path.
- Apply and restore only operate inside approved roots.
- Existing targets are backed up before overwrite.
- Generated reports never print secret values.
- Sensitive env handling only reports key-risk presence.
- Passive health checks do not spawn commands.
- Active health checks require `--active` and `--allow-command`.

---

## Repository Layout

```text
mcpskills-center/
├── config/
│   ├── profiles/
│   ├── agents.json
│   ├── routing-policy.json
│   └── sync.json
├── data/
│   └── governance.db          (SQLite, runtime)
├── docs/
│   └── plans/
├── fixtures/
├── reports/
├── backups/
├── src/
│   ├── cli/                   (CLI commands and arg parsing)
│   ├── db/                    (SQLite database module)
│   ├── governance/            (unified governance, history, diff, console, reporter)
│   ├── mcp/                   (MCP adapters, planner, reporter, apply, restore, safety)
│   ├── routing/               (routing policy, capability index, router)
│   ├── agents/                (agent discovery and support metadata)
│   ├── config/                (config loaders)
│   ├── dashboard/             (HTML dashboard generator)
│   ├── health/                (MCP health checks)
│   ├── matrix/                (capability matrix)
│   ├── normalizer/            (inventory normalization)
│   ├── profiles/              (profile loader)
│   ├── scanner/               (inventory scanner)
│   ├── sync/                  (skills sync planner, apply, restore)
│   └── types/                 (shared TypeScript types)
├── README.md
└── README.zh-CN.md
```

---

## Documentation

| Document | Purpose |
|---|---|
| `docs/supported-agents.md` | Agent support matrix and notes |
| `docs/plans/` | Implementation plan documents |
| `docs/mcp-write-model-spec.md` | MCP write model design specification |

---

## Verify Locally

```bash
npm run build
npm test
```

Smoke check:

```bash
npm run scan
node dist/index.js governance --dry-run
node dist/index.js route "implement a test"
node dist/index.js history
```

---

## License

MIT
