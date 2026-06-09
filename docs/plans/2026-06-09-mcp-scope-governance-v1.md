# MCP Scope Governance v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve MCP scope metadata from read-only config adapters through inventory and use it to make MCP governance dry-run decisions more trustworthy, without adding MCP writes.

**Architecture:** Keep the MCP lane report-first and read-only. Extend the normalized MCP evidence model so per-agent definitions retain scope metadata from adapter parsing, then teach the planner and reporters to treat scope mismatches as first-class governance signals instead of collapsing them into plain duplicate drift. Do not add MCP apply, restore, Web, SQLite, or routing work in this milestone.

**Tech Stack:** TypeScript, Node.js built-in test runner, existing MCP adapter/scanner stack, existing planner/reporter/CLI report surfaces.

---

### Task 1: Preserve Scope in Inventory Definitions

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/scanner/index.ts`
- Modify: `src/scanner/claude-code.ts`
- Modify: `src/scanner/opencode.ts`
- Modify: `src/scanner/codex.ts`
- Test: `src/scanner/index.test.ts`
- Test: `src/scanner/claude-code.test.ts`
- Test: `src/scanner/opencode.test.ts`
- Test: `src/scanner/codex.test.ts`

**Step 1: Write the failing tests**

Add tests that prove:
- `MCPServerDefinition` can retain adapter scope metadata
- `runInventory()` preserves scope per deduplicated MCP definition
- `claude-code` scanner keeps global vs project scope evidence
- `opencode` and `codex` scanners keep their adapter-derived scope metadata instead of dropping it

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/scanner/index.test.js dist/scanner/claude-code.test.js dist/scanner/opencode.test.js dist/scanner/codex.test.js`

Expected: assertions fail because scanner output currently drops scope while mapping adapter records into `MCPServer`.

**Step 3: Write minimal implementation**

- add `scope?: McpAdapterScope` to `MCPServerDefinition`
- map adapter `scope` into scanner-created `MCPServer` definitions
- update inventory dedupe helpers so repeated MCPs retain per-agent scope evidence

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/scanner/index.test.js dist/scanner/claude-code.test.js dist/scanner/opencode.test.js dist/scanner/codex.test.js`

Expected: scanner and inventory scope-preservation tests pass.

**Step 5: Commit**

```bash
git add src/types/index.ts src/scanner/index.ts src/scanner/claude-code.ts src/scanner/opencode.ts src/scanner/codex.ts src/scanner/index.test.ts src/scanner/claude-code.test.ts src/scanner/opencode.test.ts src/scanner/codex.test.ts
git commit -m "feat: preserve mcp scope in inventory"
```

### Task 2: Add Scope-Aware MCP Governance Classification

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/mcp/planner.ts`
- Test: `src/mcp/planner.test.ts`

**Step 1: Write the failing tests**

Add planner tests that prove:
- equivalent duplicate definitions with identical scope remain `canonical-candidate`
- equivalent duplicate definitions with different scopes become `manual-review`
- global + project duplicates produce an explicit scope-conflict reason
- project-scoped duplicates from the same project id can still become canonical candidates if otherwise equivalent
- scope mismatch does not override existing higher-risk policies such as unknown transport or sensitive env

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/planner.test.js`

Expected: planner assertions fail because scope does not yet influence MCP governance decisions.

**Step 3: Write minimal implementation**

- extend `McpGovernanceAction` with a scope policy or explicit scope-review reason only as needed
- classify scope mismatch separately from raw command/host drift
- keep existing env-risk / unknown-transport precedence stricter than scope review
- keep all MCP actions read-only with `requiresWrite: false`

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/planner.test.js`

Expected: planner tests pass with scope-aware behavior.

**Step 5: Commit**

```bash
git add src/types/index.ts src/mcp/planner.ts src/mcp/planner.test.ts
git commit -m "feat: add scope-aware mcp governance planning"
```

### Task 3: Surface Scope Evidence in MCP Reports and Inventory Outputs

**Files:**
- Modify: `src/mcp/reporter.ts`
- Modify: `src/mcp/reporter.test.ts`
- Modify: `src/dashboard/reporter.ts`
- Modify: `src/dashboard/reporter.test.ts`

**Step 1: Write the failing tests**

Add report tests that prove:
- MCP governance Markdown includes per-definition scope evidence
- manual-review tables show scope conflict reasons clearly
- inventory JSON and Markdown carry definition scope metadata forward
- report rendering does not drop scope when serializing deduplicated MCP definitions

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/reporter.test.js dist/dashboard/reporter.test.js`

Expected: report assertions fail because scope is not yet shown in MCP plan or inventory outputs.

**Step 3: Write minimal implementation**

- add scope columns or compact scope summaries to MCP governance Markdown
- ensure inventory JSON/Markdown emit scope under per-agent MCP definition evidence
- keep formatting concise; do not invent a new UI surface in this milestone

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/reporter.test.js dist/dashboard/reporter.test.js`

Expected: report tests pass and outputs show scope evidence.

**Step 5: Commit**

```bash
git add src/mcp/reporter.ts src/mcp/reporter.test.ts src/dashboard/reporter.ts src/dashboard/reporter.test.ts
git commit -m "feat: report mcp scope governance evidence"
```

### Task 4: Tighten CLI Readability for Scope-Aware MCP Plans

**Files:**
- Modify: `src/cli/commands.ts`
- Test: `src/cli/commands.test.ts`

**Step 1: Write the failing tests**

Add CLI tests that prove `mcp plan` terminal output can summarize:
- canonical candidate count
- manual review count
- scope-related review count or scope-policy breakdown when present

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/cli/commands.test.js`

Expected: command output is too shallow to reflect scope-aware MCP planning.

**Step 3: Write minimal implementation**

- enrich MCP dry-run terminal summary only enough to expose scope-related review decisions
- do not add new CLI subcommands or write modes

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/cli/commands.test.js`

Expected: CLI command tests pass.

**Step 5: Commit**

```bash
git add src/cli/commands.ts src/cli/commands.test.ts
git commit -m "feat: summarize mcp scope reviews in cli"
```

### Task 5: Final Verification

**Files:**
- No planned code changes.

**Step 1: Run full verification**

Run: `npm test`

Expected: all tests pass.

**Step 2: Inspect final status and diff**

Run: `git status --short --branch` and `git diff --stat master...HEAD`

Expected: clean worktree after commits; diff limited to MCP scope-governance work.

**Step 3: Report**

Report changed files, scope-policy decisions, test commands/results, and whether the branch is ready for review.
