# MCP Profile Candidates v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend MCP governance dry-run planning with explicit canonical profile candidate data and env-risk policy explanations, without writing MCP configs.

**Architecture:** Keep the MCP governance kernel report-first and files-first. Add lightweight profile candidate fields to the existing dry-run plan actions, then expose env-risk policy metadata in plan JSON/Markdown and CLI output. This milestone improves operator review quality only; it does not add MCP apply, restore, Web, SQLite, or routing.

**Tech Stack:** TypeScript, Node.js built-in test runner, existing MCP planner/reporter modules, local JSON/Markdown reports.

---

### Task 1: Add Canonical Profile Candidate Details

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/mcp/planner.ts`
- Test: `src/mcp/planner.test.ts`

**Step 1: Write the failing test**

Add a planner test asserting that an equivalent duplicate MCP produces a `canonicalProfileCandidate` object with:
- `profileId`
- `mcpId`
- `sourceAgentName`
- `agentNames`
- normalized `definition`
- `blockedByEnvRisk: false`

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/planner.test.js`

Expected: build or assertion fails because `canonicalProfileCandidate` does not exist.

**Step 3: Write minimal implementation**

Add `McpCanonicalProfileCandidate` to `src/types/index.ts`. Populate it only on `canonical-candidate` actions in `planMcpGovernance`.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/planner.test.js`

Expected: planner tests pass.

**Step 5: Commit**

Run: `git add src/types/index.ts src/mcp/planner.ts src/mcp/planner.test.ts && git commit -m "feat: add mcp profile candidates"`

### Task 2: Formalize Env-Risk Policy in Planner

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/mcp/planner.ts`
- Test: `src/mcp/planner.test.ts`

**Step 1: Write the failing tests**

Add planner tests proving:
- sensitive env definitions produce `manual-review` with `envRiskPolicy: sensitive-env-blocks-canonicalization`
- unknown transport definitions produce `manual-review` with `envRiskPolicy: unknown-transport-requires-review`
- equivalent duplicate definitions without env risk produce `envRiskPolicy: no-env-risk-detected`

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/planner.test.js`

Expected: assertions fail because env-risk policy fields are missing.

**Step 3: Write minimal implementation**

Add an `envRiskPolicy` field to MCP governance actions using a small union type. Keep all actions dry-run-only with `requiresWrite: false`.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/planner.test.js`

Expected: planner tests pass.

**Step 5: Commit**

Run: `git add src/types/index.ts src/mcp/planner.ts src/mcp/planner.test.ts && git commit -m "feat: classify mcp env risk policy"`

### Task 3: Render Profile Candidate and Env Policy Reports

**Files:**
- Modify: `src/mcp/reporter.ts`
- Test: `src/mcp/reporter.test.ts`

**Step 1: Write the failing tests**

Add reporter tests asserting Markdown includes:
- `## Canonical Profile Candidates`
- candidate profile id, source agent, target agents, and blocked env-risk state
- env-risk policy in the action table

Also assert JSON output preserves `canonicalProfileCandidate` and `envRiskPolicy`.

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/reporter.test.js`

Expected: reporter assertions fail because the new report sections/fields are not rendered.

**Step 3: Write minimal implementation**

Extend `renderMcpGovernancePlanMarkdown` with a canonical profile candidates section and add env-risk policy to the actions table. JSON writer already serializes the plan, so only summary/report formatting should change if types are present.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/reporter.test.js`

Expected: reporter tests pass.

**Step 5: Commit**

Run: `git add src/mcp/reporter.ts src/mcp/reporter.test.ts && git commit -m "feat: report mcp profile candidates"`

### Task 4: Surface Env Policy in CLI Summary

**Files:**
- Modify: `src/mcp/reporter.ts`
- Modify: `src/cli/commands.ts`
- Test: `src/cli/commands.test.ts`

**Step 1: Write the failing test**

Add a CLI test asserting `mcp plan` output includes:
- canonical candidate count
- manual review count
- env-risk policy counts

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/cli/commands.test.js`

Expected: CLI output assertions fail because env policy summary is missing.

**Step 3: Write minimal implementation**

Extend `buildMcpGovernancePlanSummary` with `canonicalCandidates`, `manualReviewActions`, and `envRiskPolicies`. Render compact counts from `executeMcp`.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/cli/commands.test.js`

Expected: CLI command tests pass.

**Step 5: Commit**

Run: `git add src/mcp/reporter.ts src/cli/commands.ts src/cli/commands.test.ts && git commit -m "feat: summarize mcp env policy in cli"`

### Task 5: Final Verification

**Files:**
- No planned code changes.

**Step 1: Run full verification**

Run: `npm test`

Expected: all tests pass.

**Step 2: Inspect final status and diff**

Run: `git status --short --branch` and `git diff --stat feature/mcp-governance-kernel-v1...HEAD`

Expected: clean worktree after commits; diff only contains this milestone.

**Step 3: Report**

Report changed files, test commands/results, commits, and whether this stacked branch is ready to keep until PR #2 merges.
