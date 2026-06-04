# MCPskills Center Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete MCPskills Center into a safe local-first CLI that scans, audits, plans, synchronizes, profiles, and visualizes MCP/skills state for Claude Code, OpenCode, and Codex.

**Architecture:** Keep the project as a single TypeScript CLI. The core pipeline is scanner -> normalizer -> auditor/recommender -> planner -> operator -> reporter/dashboard. Every write operation must be generated first as a dry-run plan, then applied only after backup and explicit user approval.

**Tech Stack:** Node.js 22+, TypeScript NodeNext, Node built-in `node:test`, `smol-toml`, Node `fs/path/os/child_process` APIs, generated JSON/Markdown/HTML reports.

---

## Current Baseline

Implemented now:

- `npm run build`, `npm test`, `npm run scan`, `npm run audit` work.
- `src/scanner/` scans Claude Code, OpenCode, and Codex skills/MCP config.
- `src/normalizer/` normalizes inventory.
- `src/auditor/` emits basic issues.
- `src/dashboard/reporter.ts` writes JSON/Markdown reports.
- `src/scanner/opencode.test.ts` covers BOM-prefixed OpenCode JSON parsing.

Known gaps:

- `src/sync/` is empty.
- `config/profiles/` and `config/samples/` are empty.
- MCP health checks are not implemented; `canStart` remains `null`.
- Audit output is issue-oriented, not yet action-oriented.
- Dashboard is report-only; no static HTML overview yet.
- `.claude/skills/` is tracked in git and needs an explicit product decision before cleanup.
- Test coverage is still too thin for config parsing, scanner fixtures, audit rules, sync, profiles, and CLI commands.

## Definition Of Done

MVP is complete when the project can safely do all of this:

- Scan Claude Code, OpenCode, and Codex from current real config paths.
- Parse JSON, UTF-8 BOM JSON, and TOML.
- Generate `reports/inventory-current.json`, `reports/inventory-current.md`, `reports/audit-current.md`, and `reports/dashboard.html`.
- Emit actionable recommendations: keep, merge, remove, manual-review.
- Generate canonical skill sync dry-run plans.
- Apply a sync plan only after creating backups and a manifest.
- Restore from a backup manifest.
- Load MCP/skill profiles from `config/profiles/*.json`.
- Generate profile apply dry-run plans.
- Run safe MCP health checks without printing secret values.
- Pass `npm run build`, `npm test`, `npm run scan`, `npm run audit`, and `npm audit --audit-level=moderate`.

## Non-Negotiable Safety Rules

- Use `superpowers:test-driven-development` for every behavior change.
- Use `superpowers:systematic-debugging` for every failure or unexpected result.
- Use `superpowers:verification-before-completion` before claiming success.
- Default mode is always dry-run.
- Never print secret values. Printing env key names and risk levels is allowed.
- Never overwrite or delete user agent configs/skills without a backup manifest.
- Never run arbitrary MCP server commands for health checks unless the user explicitly opts in.
- Do not untrack, delete, or move `.claude/skills/` until the user decides whether it is project asset data or accidental workspace data.
- Do not commit unless the user explicitly asks.

## Target Architecture

```text
CLI args
  -> command handlers
  -> scanner layer
  -> normalizer layer
  -> auditor/recommender layer
  -> sync/profile planning layer
  -> apply/restore operators, gated by backups and approval
  -> reporters: JSON, Markdown, static HTML
```

Target module boundaries:

- `src/config/`: safe JSON/TOML/profile parsers.
- `src/scanner/`: read-only discovery of installed skills and MCPs.
- `src/auditor/`: pure functions for issues and recommendations.
- `src/sync/`: dry-run sync plan generation plus apply/restore operators.
- `src/profiles/`: profile schema, loading, validation, and apply-plan generation.
- `src/health/`: safe MCP health checks.
- `src/dashboard/`: Markdown/JSON/static HTML rendering.
- `src/cli/`: argument parsing and command dispatch.

## Execution Protocol

Every task follows this loop:

1. Write the failing test first.
2. Run `npm test` and verify the test fails for the expected reason.
3. Implement the smallest production change.
4. Run `npm test` and verify green.
5. Run the task-specific command, usually `npm run scan`, `npm run audit`, or a direct `node dist/index.js ...` command.
6. Inspect `git diff --stat` before moving on.
7. Commit only if the user explicitly asks.

---

## Milestone 1: Stabilize The Test Foundation

### Task 1.1: Centralize Config Parsing

**Files:**

- Create: `src/config/parse.ts`
- Create: `src/config/parse.test.ts`
- Modify: `src/scanner/claude-code.ts`
- Modify: `src/scanner/opencode.ts`
- Modify: `src/scanner/codex.ts`

**Steps:**

1. Write tests for normal JSON, BOM JSON, invalid JSON, and TOML parsing.
2. Run `npm test`; expect failure because `src/config/parse.ts` does not exist.
3. Implement `stripBom`, `parseJsonConfig`, and `parseTomlConfig`.
4. Refactor all scanners to use those helpers.
5. Run `npm test` and `npm run build`.

**Acceptance:** Scanner behavior is unchanged, but parsing behavior is tested and reusable.

### Task 1.2: Add Scanner Fixture Tests

**Files:**

- Create: `src/scanner/test-utils.ts`
- Create: `src/scanner/claude-code.test.ts`
- Create: `src/scanner/codex.test.ts`
- Modify: `src/scanner/opencode.test.ts`

**Steps:**

1. Add temp-dir fixture helpers for config files and skills directories.
2. Test Claude global `mcpServers` parsing.
3. Test Claude project-level `projects.*.mcpServers` parsing.
4. Test OpenCode `mcp` parsing.
5. Test Codex `mcp_servers` TOML parsing.
6. Test missing config files return empty arrays, not thrown errors.
7. Test sensitive env key detection without checking or exposing values.
8. Run `npm test`, `npm run scan`, and `npm run audit`.

**Acceptance:** Scanner fixture tests cover all three agents and current config formats.

---

## Milestone 2: Convert Audit Into Actionable Recommendations

### Task 2.1: Extend Audit Types

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/auditor/index.ts`
- Create: `src/auditor/index.test.ts`

**Steps:**

1. Write failing tests expecting `AuditReport.recommendations`.
2. Add `AuditRecommendation` with `category`, `targetType`, `targetId`, `severity`, `reason`, `suggestedAction`, and `requiresWrite`.
3. Generate recommendations for duplicate skills, duplicate MCPs, missing `SKILL.md`, invalid frontmatter, symlink review, and sensitive env review.
4. Keep generation pure; no file reads/writes in auditor.
5. Run `npm test`.

**Acceptance:** `runAudit()` returns both issues and recommendations.

### Task 2.2: Improve Audit Markdown Report

**Files:**

- Modify: `src/dashboard/reporter.ts`
- Create or modify: `src/dashboard/reporter.test.ts`

**Steps:**

1. Write a failing test that `writeAuditMarkdown()` includes `## Recommendations`.
2. Add a recommendation table with category, target, severity, action, and write requirement.
3. Ensure secret values never appear in report fixtures.
4. Run `npm test`, `npm run scan`, and `npm run audit`.

**Acceptance:** `reports/audit-current.md` explains what to do next, not only what is wrong.

---

## Milestone 3: Canonical Skills Store And Sync Dry-Run

### Task 3.1: Define Sync Plan Schema

**Files:**

- Modify: `src/types/index.ts`
- Create: `src/sync/planner.ts`
- Create: `src/sync/planner.test.ts`

**Steps:**

1. Write failing tests for planning duplicate skill consolidation.
2. Add `SyncPlan`, `SyncAction`, and action types: `copy-to-canonical`, `link-to-agent`, `copy-to-agent`, `skip`, `manual-review`.
3. Implement pure `planSkillSync(inventory, options)`.
4. Options include `canonicalSkillsDir`, `strategy: 'symlink' | 'copy'`, and `agentNames`.
5. Run `npm test`.

**Acceptance:** The planner describes sync actions without touching the filesystem.

### Task 3.2: Add Sync Dry-Run CLI

**Files:**

- Modify: `src/index.ts`
- Create: `src/sync/reporter.ts`
- Create: `src/sync/reporter.test.ts`

**Steps:**

1. Write a failing test for rendering a sync plan as Markdown.
2. Add CLI support for `sync --dry-run`.
3. Default canonical store to `config/canonical-skills` unless overridden by `--canonical-dir`.
4. Write dry-run output to `reports/sync-plan-current.md` and `reports/sync-plan-current.json`.
5. Ensure `sync` without `--apply` never writes outside `reports/`.
6. Run `npm test` and `node dist/index.js sync --dry-run` after build.

**Acceptance:** Users can inspect a sync plan before any filesystem modification.

---

## Milestone 4: Backup, Apply, And Restore

### Task 4.1: Build Backup Manifest

**Files:**

- Create: `src/sync/backup.ts`
- Create: `src/sync/backup.test.ts`
- Modify: `src/types/index.ts`

**Steps:**

1. Write failing tests for creating a timestamped backup manifest.
2. Manifest includes source path, backup path, action id, timestamp, and optional hash.
3. Implement backup helpers with temp fixtures only.
4. Ensure parent directories are created recursively.
5. Run `npm test`.

**Acceptance:** Every apply action can be backed by a machine-readable restore manifest.

### Task 4.2: Apply Sync Plan Safely

**Files:**

- Create: `src/sync/apply.ts`
- Create: `src/sync/apply.test.ts`
- Modify: `src/index.ts`

**Steps:**

1. Write failing tests for apply using temp directories only.
2. Implement copy actions first; defer symlink until copy path is safe.
3. Implement symlink actions behind explicit `strategy: 'symlink'`.
4. Require `sync --apply --confirm` for real apply.
5. Create backups before overwrite.
6. Refuse to apply when target is outside approved agent/canonical directories.
7. Run `npm test`.

**Acceptance:** Apply is opt-in, backed up, path-checked, and test-covered.

### Task 4.3: Restore From Manifest

**Files:**

- Create: `src/sync/restore.ts`
- Create: `src/sync/restore.test.ts`
- Modify: `src/index.ts`

**Steps:**

1. Write failing tests for restoring overwritten temp files.
2. Add `sync --restore <manifest>` command.
3. Restore only files listed in the manifest.
4. Refuse missing or malformed manifests with clear errors.
5. Run `npm test`.

**Acceptance:** Every supported apply path has a tested restore path.

---

## Milestone 5: MCP Profiles

### Task 5.1: Define Profile Schema And Samples

**Files:**

- Modify: `src/types/index.ts`
- Create: `src/profiles/loader.ts`
- Create: `src/profiles/loader.test.ts`
- Create: `config/profiles/coding.json`
- Create: `config/profiles/research.json`
- Create: `config/profiles/lark-office.json`
- Create: `config/profiles/security.json`

**Steps:**

1. Write failing tests for loading and validating profiles.
2. Define profile fields: `name`, `description`, `mcpServers`, `skills`, `agents`, optional `disabledMcpServers`.
3. Reject malformed profiles with readable errors.
4. Add sample profile JSON files with conservative content from current inventory.
5. Run `npm test`.

**Acceptance:** Profiles are local JSON files and can be validated independently.

### Task 5.2: Generate Profile Apply Plans

**Files:**

- Create: `src/profiles/planner.ts`
- Create: `src/profiles/planner.test.ts`
- Modify: `src/index.ts`

**Steps:**

1. Write failing tests for comparing a profile to inventory.
2. Add `profile list`, `profile show <name>`, and `profile plan <name>` CLI commands.
3. Plan output shows enable, disable, missing, and already-present items.
4. No config writes in this milestone.
5. Run `npm test` and `node dist/index.js profile list` after build.

**Acceptance:** Users can see what a profile would change before write support exists.

---

## Milestone 6: Safe MCP Health Checks

### Task 6.1: Add Passive Health Checks

**Files:**

- Create: `src/health/mcp.ts`
- Create: `src/health/mcp.test.ts`
- Modify: `src/index.ts`

**Steps:**

1. Write failing tests for passive checks: command present, URL valid, transport known, sensitive env detected.
2. Implement `evaluateMcpHealth(mcp)` without spawning commands.
3. Fill `canStart` only when passive evidence is enough; otherwise return `null` with reason.
4. Run `npm test`.

**Acceptance:** Health checks improve signal without executing unknown programs.

### Task 6.2: Add Explicit Active Health Checks

**Files:**

- Modify: `src/health/mcp.ts`
- Modify: `src/index.ts`
- Modify: `src/health/mcp.test.ts`

**Steps:**

1. Write failing tests for command allowlist behavior.
2. Add `health --active --allow-command npx --timeout 3000`.
3. Use `child_process.spawn` with args array only, never shell string execution.
4. Redact env values from all output.
5. Default to passive checks when `--active` is absent.
6. Run `npm test`.

**Acceptance:** Active checks are explicit, allowlisted, timeout-bound, and redacted.

---

## Milestone 7: Static Dashboard

### Task 7.1: Generate HTML Dashboard

**Files:**

- Create: `src/dashboard/html.ts`
- Create: `src/dashboard/html.test.ts`
- Modify: `src/dashboard/reporter.ts`

**Steps:**

1. Write failing tests that generated HTML includes skills count, MCP count, issue count, and recommendations.
2. Generate a static single-file `reports/dashboard.html`.
3. Use inline CSS only; no external network assets.
4. Escape all dynamic strings before inserting into HTML.
5. Add dashboard generation to `writeAllReports()`.
6. Run `npm test` and `npm run scan`.

**Acceptance:** Running scan creates a local offline dashboard.

---

## Milestone 8: CLI Restructure And UX

### Task 8.1: Extract CLI Command Dispatch

**Files:**

- Create: `src/cli/index.ts`
- Create: `src/cli/index.test.ts`
- Modify: `src/index.ts`

**Steps:**

1. Write failing tests for parsing commands: `scan`, `audit`, `sync --dry-run`, `profile list`, `health`.
2. Extract command parsing from `src/index.ts` into pure functions.
3. Keep `src/index.ts` as a thin entry point.
4. Add `help` output.
5. Run `npm test` and `node dist/index.js help` after build.

**Acceptance:** CLI behavior is testable without spawning the process for every case.

### Task 8.2: Improve README

**Files:**

- Modify: `README.md`

**Steps:**

1. Document install, build, test, scan, audit, sync dry-run, profile, health, dashboard.
2. Document safety model and backup/restore behavior.
3. Document current limitations.
4. Document `.claude/skills/` decision status.
5. Run `npm test` and `npm run build`.

**Acceptance:** A new user can run and understand the project from README alone.

---

## Milestone 9: Repository Hygiene Decision

### Task 9.1: Decide `.claude/skills/` Policy

**Files:**

- Possibly modify: `.gitignore`
- Possibly move or untrack: `.claude/skills/**`
- Possibly create: `fixtures/skills/` or `vendor/skills/`

**Decision required from user before execution:**

- Option A: `.claude/skills/` is accidental local config. Add `.claude/` to `.gitignore` and untrack with `git rm --cached -r .claude`.
- Option B: these are project fixtures. Move minimal samples to `fixtures/skills/` and untrack the rest.
- Option C: these are intentional bundled assets. Move them to `vendor/claude-skills/`, document licenses, and keep tracked.

**Acceptance:** Hidden local config is no longer ambiguous in the repository.

---

## Milestone 10: Final Acceptance Pass

### Task 10.1: End-To-End Verification

**Steps:**

1. Run `npm run build`.
2. Run `npm test`.
3. Run `npm run scan`.
4. Run `npm run audit`.
5. Run `node dist/index.js sync --dry-run`.
6. Run `node dist/index.js profile list`.
7. Run `node dist/index.js health`.
8. Run `npm audit --audit-level=moderate`.
9. Inspect generated reports under `reports/`.
10. Inspect `git status --short --branch` and `git diff --stat`.

**Acceptance:** All commands succeed, generated reports are useful, and no unexpected files are modified.

## Recommended Implementation Order

1. Milestone 1: tests and parser/scanner hardening.
2. Milestone 2: recommendations.
3. Milestone 3: sync dry-run only.
4. Milestone 7: dashboard from read-only data.
5. Milestone 5: profiles and profile planning.
6. Milestone 6: passive health checks, then optional active checks.
7. Milestone 4: apply/restore only after dry-run and backup model are stable.
8. Milestone 8: CLI/README polish.
9. Milestone 9: repo hygiene decision.
10. Milestone 10: final acceptance.
