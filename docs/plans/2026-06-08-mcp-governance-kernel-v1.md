# MCP Governance Kernel v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the first MCP governance kernel slice: a CLI-first dry-run plan that detects duplicate and drifted MCP definitions without writing configs.

**Architecture:** Preserve files as the source of truth and keep the CLI/report model as the governance kernel. Extend inventory enough to retain per-agent MCP definition evidence, then build a dry-run planner and reporter that classify MCP entries as canonical candidates, skips, or manual-review items. Do not add MCP apply/restore, Web, SQLite, or routing in this slice.

**Tech Stack:** TypeScript, Node.js built-in test runner, existing scanner inventory model, file-based JSON/Markdown reports.

---

### Task 1: Preserve Per-Agent MCP Definitions

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/scanner/index.ts`
- Test: `src/scanner/index.test.ts`

**Step 1: Write the failing test**

Add a scanner aggregation test that uses an injected scanner registry with two agents returning the same MCP id with different commands. Assert that `runInventory` still returns one deduplicated MCP server, but it also includes per-agent definition evidence for both agents.

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/scanner/index.test.js`

Expected: build or test fails because `MCPServer` has no per-agent definition field yet.

**Step 3: Write minimal implementation**

Add a minimal `MCPServerDefinition` type and optional `definitions` field on `MCPServer`. Populate it in `runInventory` when deduplicating MCP servers.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/scanner/index.test.js`

Expected: scanner aggregation test passes.

**Step 5: Commit**

Run: `git add src/types/index.ts src/scanner/index.ts src/scanner/index.test.ts && git commit -m "feat: preserve mcp definition evidence"`

### Task 2: Add MCP Dry-Run Planner

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/mcp/planner.ts`
- Test: `src/mcp/planner.test.ts`

**Step 1: Write the failing tests**

Add tests for three behaviors:
- Equivalent duplicate definitions across agents produce one `canonical-candidate` action with `requiresWrite: false`.
- Single-agent MCP definitions produce `skip` with an explicit reason.
- Drifted duplicate definitions produce `manual-review` with per-agent definitions and no write requirement.

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/planner.test.js`

Expected: build fails because the MCP planner module and plan types do not exist.

**Step 3: Write minimal implementation**

Add `McpGovernancePlan`, `McpGovernanceAction`, and a `planMcpGovernance` function. Keep action types limited to `canonical-candidate`, `skip`, and `manual-review`; all actions must be dry-run-only with `requiresWrite: false`.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/planner.test.js`

Expected: MCP planner tests pass.

**Step 5: Commit**

Run: `git add src/types/index.ts src/mcp/planner.ts src/mcp/planner.test.ts && git commit -m "feat: plan mcp governance dry runs"`

### Task 3: Add MCP Plan Reports

**Files:**
- Create: `src/mcp/reporter.ts`
- Test: `src/mcp/reporter.test.ts`

**Step 1: Write the failing tests**

Add tests asserting the Markdown report includes totals, action type counts, manual-review reasons, and per-agent definition details. Add a JSON writer test that includes a summary object.

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/reporter.test.js`

Expected: build fails because the reporter module does not exist.

**Step 3: Write minimal implementation**

Mirror the existing sync reporter style with `buildMcpGovernancePlanSummary`, `renderMcpGovernancePlanMarkdown`, and `writeMcpGovernancePlanReports`. Write `mcp-governance-plan-current.json` and `mcp-governance-plan-current.md`.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/reporter.test.js`

Expected: MCP reporter tests pass.

**Step 5: Commit**

Run: `git add src/mcp/reporter.ts src/mcp/reporter.test.ts && git commit -m "feat: report mcp governance dry runs"`

### Task 4: Add CLI Dry-Run Surface

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/cli/commands.ts`
- Modify: `src/index.ts`
- Test: `src/index.test.ts`
- Test: `src/cli/commands.test.ts`

**Step 1: Write the failing tests**

Add tests proving `mcp plan` parses, `renderHelp` documents the command, and `executeCommand` writes MCP governance plan reports while returning dry-run summary counts.

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/index.test.js dist/cli/commands.test.js`

Expected: tests fail because `mcp` is not a supported command and command context lacks the MCP plan writer.

**Step 3: Write minimal implementation**

Add `mcp` as a CLI command with `plan` subcommand only. Wire `planMcpGovernance` and `writeMcpGovernancePlanReports` through `CommandContext`. Refuse unknown MCP subcommands with usage text; do not add apply or restore options.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/index.test.js dist/cli/commands.test.js`

Expected: CLI tests pass.

**Step 5: Commit**

Run: `git add src/cli.ts src/cli/commands.ts src/index.ts src/index.test.ts src/cli/commands.test.ts && git commit -m "feat: add mcp governance plan cli"`

### Task 5: Final Verification

**Files:**
- No planned code changes.

**Step 1: Run full verification**

Run: `npm test`

Expected: all tests pass.

**Step 2: Inspect final diff and status**

Run: `git status --short --branch` and `git diff --stat`

Expected: clean worktree after commits, no pushed changes.

**Step 3: Report**

Report changed files, test commands/results, and whether the branch is ready for user review or a later push.
