# MCPskills Center

<div align="center">

**Local-first CLI for scanning, auditing, planning, and synchronizing agent skills while inventorying MCP servers across Claude Code, OpenCode, Codex, CodeBuddy, WorkBuddy, Trae, Qoder, and Qoder Work.**

[![Runtime](https://img.shields.io/badge/runtime-Node.js%2020%20%7C%2022--26-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![CI](https://github.com/quzhiii/mcpskills-center/actions/workflows/ci.yml/badge.svg)](https://github.com/quzhiii/mcpskills-center/actions/workflows/ci.yml)
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

It scans installed MCP servers and skill directories, normalizes their metadata, highlights duplicates and broken entries, generates dry-run skill sync plans, checks health status, and renders readable reports for review.

The product direction is CLI-first. The CLI remains the governance kernel and operational source of truth for scan, plan, apply, and restore. A local Web console can wrap these artifacts later, but it should not replace the CLI execution model.

```text
Claude Code / OpenCode / Codex ─┐
CodeBuddy / WorkBuddy / Trae ──┼─→ scan → audit → plan → verify → report
Qoder / Qoder Work ────────────┘                      │
                                                      ├─→ sync dry-run
                                                      ├─→ sync apply with backup manifest
                                                      ├─→ restore from manifest
                                                      └─→ offline dashboard.html
```

The current release focuses on a practical local workflow:

| Capability | What it gives you |
|---|---|
| Inventory scanning | Unified view of MCP servers, skills, install paths, metadata, and issues |
| Audit reporting | Duplicate skills, duplicate MCPs, missing `SKILL.md`, symlink review items, sensitive env key risk |
| Sync planning | Canonical skill distribution plan with dry-run output before any writes |
| Safe apply / restore | Explicit `--confirm`, approved-root checks, timestamped backups, restore manifests |
| Profiles | Read-only planning for scenario-based capability bundles such as `coding` or `research` |
| Health checks | Passive validation by default, explicit active command probing when allowlisted |
| Dashboard | Static offline HTML report at `reports/dashboard.html` |

Agent support status is summarized in `docs/supported-agents.md`.

---

## Governance Roadmap

Current write-capable priority remains skills governance: make duplicate skill installs explainable, reversible, and safe to consolidate through `sync --dry-run`, `sync --apply --confirm`, and `sync --restore`.

MCP governance is active on the read-only/report-first lane. The read-only MCP kernel is complete: scope-aware governance, canonical profile evidence, write-readiness evidence, and deterministic canonical target policy are all on `master`. The MCP write model design (types, adapter interface, safety contracts) is also complete. The next MCP milestone is `mcp-write-apply-v1`: runtime implementation of MCP config apply/restore with per-adapter serialization for write-ready agents (Claude Code, OpenCode, Codex).

Longer-term layers are a local Web control plane over the CLI kernel, then intelligent local agent routing after governed capability state is stable. Web, SQLite history, and routing are intentionally not the first implementation priority.

---

## Quickstart

Clone the repository, install dependencies, run the test suite, then generate the first inventory snapshot.

Use Node.js 20 or Node.js 22-26. Node.js 22 or 24 LTS is recommended.

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

If you want a quick read-only sync plan next:

```bash
node dist/index.js sync --dry-run
```

---

## Outputs

### Main report set

`scan` writes:

- `reports/inventory-current.json`
- `reports/inventory-current.md`
- `reports/audit-current.md`
- `reports/dashboard.html`

`sync --dry-run` writes:

- `reports/sync-plan-current.json`
- `reports/sync-plan-current.md`

`matrix` writes:

- `reports/capability-matrix-current.json`
- `reports/capability-matrix-current.md`

`sync --apply --confirm` writes timestamped backup content under `backups/` and a consolidated manifest for the apply run.

### Dashboard preview

The static dashboard summarizes the current state in one offline HTML file:

```text
Summary cards     Recommendations table     Skills table     Issues table
     │                     │                    │                │
     └───────────── all generated from the current local inventory ─────────────┘
```

Generated HTML is a reading surface. The JSON and Markdown reports remain the auditable artifacts for automation and review.

---

## Commands

| Command | Purpose | Writes |
|---|---|---|
| `npm run scan` | Scan inventory, normalize records, audit findings, generate reports | `reports/` |
| `npm run audit` | Print audit summary in the terminal | None |
| `node dist/index.js sync --dry-run` | Generate a sync plan without changing agent config | `reports/` |
| `node dist/index.js sync --apply --confirm` | Apply the current sync plan with backups | `backups/` |
| `node dist/index.js sync --restore <manifest>` | Restore a previous apply run from its manifest | Existing targets |
| `node dist/index.js profile list` | List available local profiles | None |
| `node dist/index.js profile show <name>` | Print one profile JSON | None |
| `node dist/index.js profile plan <name>` | Compare a profile against the current inventory | None |
| `node dist/index.js agents list` | List registered local agents from `config/agents.json` | None |
| `node dist/index.js agents discover` | Discover local agent config candidates such as Qoder, CodeBuddy, WorkBuddy, and Trae | `reports/` |
| `node dist/index.js matrix` | Build a capability matrix across registered agents for discovered skills and MCP servers | `reports/` |
| `node dist/index.js health` | Run passive MCP health checks | None |
| `node dist/index.js health --active --allow-command <cmd> [--timeout <ms>]` | Run explicit active command probes for allowlisted commands | None |
| `node dist/index.js route <task>` | Recommend which agent to use for a task | None |
| `node dist/index.js help` | Show CLI help | None |

---

## Scenarios

### 1. Inspect the current machine state

```bash
npm run scan
```

Use this when you want the baseline inventory, audit report, and offline dashboard in one pass.

### 2. Review duplicates and risky entries in the terminal

```bash
npm run audit
```

Use this when you want a quick summary of duplicate skills, duplicate MCPs, missing `SKILL.md`, symlink review items, and sensitive env key risk.

### 3. Plan a canonical skill sync without writing anything

```bash
node dist/index.js sync --dry-run
```

Optional custom canonical directory:

```bash
node dist/index.js sync --dry-run --canonical-dir C:\path\to\canonical-skills
```

The current planner uses a canonical store plus distribution actions to agent skill roots. Review the generated sync plan before any apply step.

If you later run `sync --apply` with a custom canonical directory, add that directory to `config/sync.json` under `approvedSyncRoots` first. Apply validates both source and target paths.

### 4. Apply the current sync plan with backups

```bash
node dist/index.js sync --apply --confirm
```

Apply mode recomputes the current plan, backs up existing targets when present, and writes one manifest that can be used for restore.

### 5. Restore a previous apply run

```bash
node dist/index.js sync --restore C:\path\to\manifest.json
```

Restore mode copies backed-up content from the manifest back to the original target path after approved-root validation.

### 6. Plan a profile for a focused workflow

```bash
node dist/index.js profile plan coding
```

This reports `already-present`, `missing`, and `disable` actions for the named profile without changing any live config.

### 7. List registered local agents

```bash
node dist/index.js agents list
```

Use this to review the currently loaded registry without scanning live config. The checked-in `config/agents.json` also contains disabled read-only entries for Qoder, Qoder Work, CodeBuddy, WorkBuddy, and Trae, but disabled entries are filtered out of the runtime-loaded list.

### 8. Discover local agent candidates

```bash
node dist/index.js agents discover
```

Discovery is read-only. It checks known local paths and writes `reports/agent-discovery-current.json` plus `reports/agent-discovery-current.md`.

### 9. Build a cross-agent capability matrix

```bash
node dist/index.js matrix
```

Use this when you want a cross-agent capability view for the current inventory. It writes `reports/capability-matrix-current.json` and `reports/capability-matrix-current.md` with per-agent presence, missing coverage, and shared-capability counts.

### 10. Run safe passive MCP health checks

```bash
node dist/index.js health
```

Passive mode checks transport shape, command presence, URL validity, and sensitive env key risk without spawning commands.

### 11. Run explicit active command probes

```bash
node dist/index.js health --active --allow-command npx --timeout 3000
```

Active mode only probes allowlisted commands with `--version`, uses argument arrays instead of shell strings, and times out when the command does not return.

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

Writable sync roots are controlled by `config/sync.json`.

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

Relative paths are resolved from the project root. Invalid values fail before an apply run begins.

---

## Safety Model

- Default behavior is read-only or dry-run.
- `sync --apply` requires explicit `--confirm`.
- `sync --restore` requires an explicit manifest path.
- Apply and restore only operate inside approved roots.
- Existing targets are backed up before overwrite when a previous target exists.
- Generated reports never print secret values.
- Sensitive env handling only reports key-risk presence.
- Passive health checks do not spawn commands.
- Active health checks require `--active`.
- Active probes only succeed for commands explicitly allowlisted with `--allow-command`.
- `--timeout` is optional and defaults to `3000` ms when omitted.
- Active health probes run `spawn(command, ['--version'], { shell: false })` semantics rather than shell strings.

---

## Repository Layout

```text
mcpskills-center/
├── config/
│   ├── profiles/
│   └── sync.json
├── docs/
├── fixtures/
├── reports/
├── backups/
├── src/
├── README.md
└── README.zh-CN.md
```

Fixture policy:

- `.claude/` is treated as local machine configuration and is not tracked as live repository payload.
- Repository-tracked skill samples live under `fixtures/skills/`.
- Those fixtures are synthetic and intentionally minimal.
- Project-owned reusable skills live under `skills/` and are documentation/config assets, not npm runtime payload.

---

## Boundaries

- The current sample `config/sync.json` is machine-oriented and may need adjustment on another system.
- Profile matching supports short MCP ids such as `playwright` against project-scoped ids such as `C:/Users/quzhi:playwright`.
- Passive HTTP and SSE health checks validate preserved URL or host values when present in config.
- Active health checks validate command reachability through `--version`; they do not perform a full MCP handshake.
- OpenCode array-form commands are normalized to the leading executable name for health probing.
- The npm package exposes `mcpskills` and `mcpskills-center`; source usage through `node dist/index.js ...` remains supported after build.

---

## Documentation

| Document | Purpose |
|---|---|
| `docs/MCPskills-center-background-and-plan.md` | Product background, machine context, and original project framing |
| `docs/migration-notes.md` | Migration decisions and retained / excluded assets |
| `docs/plans/2026-06-03-mcpskills-center-completion.md` | Implementation plan for the completed CLI workflow |
| `docs/plans/` | Historical implementation plans and milestone execution notes |
| `skills/mcpskills-center/SKILL.md` | Reusable local skill guidance for operating MCPskills Center safely |

---

## Verify Locally

```bash
npm run build
npm test
npm audit --audit-level=moderate
```

For a workflow smoke check after the test suite:

```bash
npm run scan
npm run audit
node dist/index.js sync --dry-run
node dist/index.js health
```

---

## License

MIT
