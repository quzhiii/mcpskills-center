# Architecture Overview

Technical architecture of MCPskills Center for contributors.

---

## Project Structure

```text
mcpskills-center/
├── config/                # Bundled read-only templates and defaults
│   ├── profiles/          # Default profile definitions
│   ├── agents.json        # Default agent registry
│   ├── routing-policy.json # Default routing policy
│   └── sync.json          # Portable sync template
├── docs/                  # Documentation
├── fixtures/              # Test fixtures (synthetic skill samples)
└── src/
    ├── agents/            # Agent support level descriptions
    ├── auditor/           # Audit rule engine
    ├── cli/               # CLI command implementations
    ├── config/            # Config loading utilities
    ├── dashboard/         # HTML dashboard generator
    ├── db/                # SQLite database layer
    ├── governance/        # Unified governance (console, diff, history, reporter)
    ├── health/            # MCP health checks (passive + active)
    ├── matrix/            # Cross-agent capability matrix
    ├── mcp/               # MCP governance (planner, apply, restore, reporter)
    ├── normalizer/        # Inventory normalization
    ├── profiles/          # Profile loading and planning
    ├── reporting/         # Report writers (JSON, Markdown, HTML)
    ├── routing/           # Task routing (policy, router, capability index)
    ├── scanner/           # Agent-specific scanners
    ├── sync/              # Skills sync (planner, apply, restore, reporter)
    ├── types/             # Shared TypeScript types
    ├── bin.ts             # CLI entry point
    ├── cli.ts             # CLI argument parser
    ├── cli.test.ts        # CLI tests
    ├── fs-utils.ts        # Filesystem utilities
    ├── fs-utils.test.ts   # FS utility tests
    ├── index.ts           # Main orchestrator
    └── index.test.ts      # Integration tests
```

Writable config and runtime state use the platform user data root, with `config/`, `canonical-skills/`, `reports/`, `backups/`, and `data/` subdirectories. User configuration has precedence over bundled defaults.

---

## Key Modules

### CLI (`src/cli/`)

The command dispatcher. `cli.ts` parses arguments into a `CliArgs` struct. `commands.ts` maps commands to handler functions. Each command function receives a `CommandContext` with injected dependencies.

**Flow:**

```text
bin.ts → cli.ts (parse args) → commands.ts (dispatch) → specific module
```

### Scanner (`src/scanner/`)

Agent-specific scanners that read skill directories and MCP config files. Each agent has a dedicated scanner (e.g., `claude-code`, `opencode`, `codex`) or falls back to the generic scanner.

**Scanner types:**

- `claude-code` — reads `~/.claude/skills` and `~/.claude.json`
- `opencode` — reads `~/.opencode/skills` and `~/.opencode/opencode.json`
- `codex` — reads `~/.codex/skills` and `~/.codex/config.toml`
- `generic` — fallback for agents without dedicated parsers

### Normalizer (`src/normalizer/`)

Takes raw scanner output and produces a unified `Inventory` with normalized skill and MCP server records. Deduplicates entries and unifies metadata formats.

### Auditor (`src/auditor/`)

Runs rule-based checks on the normalized inventory:

- Duplicate skills across agents
- Duplicate MCP servers
- Missing `SKILL.md` files
- Symlink review items
- Sensitive environment variable risk

### Sync (`src/sync/`)

Skills synchronization lifecycle:

- `planner.ts` — generates sync plans (copy/symlink/skip actions)
- `apply.ts` — executes plans with backup and manifest creation
- `restore.ts` — restores from backup manifests
- `reporter.ts` — generates plan reports

### MCP (`src/mcp/`)

MCP server governance:

- `planner.ts` — generates MCP governance plans
- `apply-plan.ts` — builds apply plans with agent config paths
- `apply.ts` — executes MCP config changes (write-ready agents only)
- `restore.ts` — restores MCP configs from manifests
- `reporter.ts` — generates governance plan reports

### Governance (`src/governance/`)

Unified governance layer:

- `console.ts` — generates `governance-console.html`
- `reporter.ts` — generates `governance-current.json` / `.md`
- `history.ts` — reads/writes operation history log
- `diff.ts` — compares current vs. previous plans

### Routing (`src/routing/`)

Task-to-agent routing:

- `policy.ts` — loads and validates `routing-policy.json`
- `router.ts` — matches tasks to categories and recommends agents
- `capability-index.ts` — indexes agent capabilities for routing

### Health (`src/health/`)

MCP server health checks:

- Passive mode — validates transport shape, command presence, URL validity
- Active mode — spawns `command --version` for allowlisted commands

### Profiles (`src/profiles/`)

Profile management:

- Loads profile definitions from `config/profiles/`
- Plans profile actions against current inventory (already-present, missing, disable)

### Matrix (`src/matrix/`)

Cross-agent capability analysis:

- Builds a matrix of which agents have which skills and MCP servers
- Reports coverage gaps and shared capabilities

### Database (`src/db/`)

Optional SQLite layer using `better-sqlite3`:

- Inventory snapshots
- Action results
- Governance history
- Routing audit log

---

## Data Flow

The core data flow follows this pipeline:

```text
scan → normalize → plan → apply → report
```

### Detailed flow

```text
1. Scanner reads agent directories
   ↓
2. Raw inventory (skills[], mcps[], agents[])
   ↓
3. Normalizer unifies metadata
   ↓
4. Normalized Inventory
   ↓
5. Auditor checks for issues
   ↓
6. Planner generates actions
   ↓
7. Apply executes with backups
   ↓
8. Reporter writes JSON/MD/HTML
```

### Inventory structure

```typescript
interface Inventory {
  skills: SkillRecord[];
  mcpServers: McpServerRecord[];
  agents: AgentConfig[];
}
```

Each scanner produces raw records. The normalizer deduplicates and adds computed fields (hashes, paths, metadata).

---

## Adapter Architecture

Adapters handle parsing and serialization of agent-specific config formats.

### Parser adapters

Each agent config format has a parser:

| Format | Agent | Parser |
|---|---|---|
| JSON (`~/.claude.json`) | Claude Code | JSON parser with project-scope support |
| JSON (`opencode.json`) | OpenCode | JSON parser with array-form command normalization |
| TOML (`config.toml`) | Codex | TOML parser |
| JSON (`mcp.json`) | CodeBuddy | JSON parser |
| JSON (`.mcp.json`) | WorkBuddy | JSON parser |
| JSON (`cline_mcp_settings.json`) | Trae | JSON parser (compatibility format) |

### Serialization adapters

Write-ready agents have serialization adapters that can modify config files:

- Claude Code — JSON serialization with project-scope support
- OpenCode — JSON serialization
- Codex — TOML serialization

Read-only agents do not have serialization adapters. Their configs are scanned but never modified.

---

## CLI Structure

```text
bin.ts
  └─→ cli.ts (parse argv into CliArgs)
       └─→ commands.ts (dispatch to handler)
            ├─→ executeScan()
            ├─→ executeAudit()
            ├─→ executeSync()
            ├─→ executeMcp()
            ├─→ executeGovernance()
            ├─→ executeGovernanceDiff()
            ├─→ executeHistory()
            ├─→ executeProfile()
            ├─→ executeAgents()
            ├─→ executeMatrix()
            ├─→ executeHealth()
            ├─→ executeRoute()
            └─→ renderHelp()
```

### CommandContext

All commands receive a `CommandContext` with injected dependencies:

```typescript
interface CommandContext {
  reportsDir: string;
  canonicalSkillsDir: string;
  backupsDir: string;
  profilesDir: string;
  syncConfigPath: string;
  agentConfigPath: string;
  approvedSyncRoots: string[];
  runInventory: () => Promise<Inventory>;
  writeAllReports: (...) => Promise<void>;
  applySyncPlan: typeof applySyncPlan;
  restoreSyncBackupManifest: typeof restoreSyncBackupManifest;
  applyMcpPlan?: typeof applyMcpPlan;
  restoreMcpBackupManifest?: typeof restoreMcpBackupManifest;
  db?: Database.Database;
}
```

This design allows testing commands with mock dependencies.

---

## SQLite Usage

SQLite is optional and used via `better-sqlite3`. When configured, it stores:

| Table | Purpose |
|---|---|
| `inventory_snapshots` | Point-in-time inventory counts |
| `action_results` | Individual action outcomes from apply runs |
| `governance_history` | Operation log (apply/restore) |
| `routing_log` | Routing decisions for audit |

SQLite provides a queryable alternative to the JSON-based history file. Commands fall back to JSON files when SQLite is not available.

---

## Testing Approach

### Test files

- `src/cli.test.ts` — CLI argument parsing and command dispatch
- `src/index.test.ts` — Integration tests for the full pipeline
- `src/fs-utils.test.ts` — Filesystem utility tests
- `src/routing/policy.test.ts` — Policy loading and validation
- `src/routing/router.test.ts` — Task matching logic
- `src/routing/capability-index.test.ts` — Capability indexing
- `src/governance/diff.test.ts` — Plan diffing
- `src/governance/history.test.ts` — History read/write
- `src/governance/console.test.ts` — Console HTML generation
- `src/governance/reporter.test.ts` — Report generation

### Test strategy

- **Unit tests** for pure functions (policy matching, normalization, audit rules)
- **Integration tests** for end-to-end pipelines (scan → normalize → plan)
- **Fixture-based tests** using synthetic skill samples in `fixtures/`
- **No live agent tests** — tests use mock inventories, not real agent directories

### Running tests

```bash
npm test
```

### Build and verify

```bash
npm run build
npm test
npm audit --audit-level=moderate
npm run scan
npm run audit
node dist/index.js sync --dry-run
node dist/index.js health
```
