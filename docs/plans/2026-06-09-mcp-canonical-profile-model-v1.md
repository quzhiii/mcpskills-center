# MCP Canonical Profile Model v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Formalize canonical MCP profile eligibility and blocker evidence in the read-only MCP governance plan, without adding MCP writes.

**Architecture:** Keep MCP governance report-first and file-based. Extend the existing lightweight `canonicalProfileCandidate` shape into a clearer canonical profile evidence model, then add blocker metadata to every MCP governance action so reports and CLI output can explain why a duplicate MCP can or cannot become a canonical profile. Do not add MCP apply, restore, Web, SQLite, routing, or agent config writes in this milestone.

**Tech Stack:** TypeScript, Node.js built-in test runner, existing MCP planner/reporter modules, local JSON/Markdown reports, existing CLI command surface.

---

### Task 1: Enrich Canonical Profile Candidate Evidence

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/mcp/planner.ts`
- Test: `src/mcp/planner.test.ts`

**Step 1: Write the failing tests**

Add planner tests proving that an eligible duplicate MCP canonical candidate includes:
- `status: 'eligible'`
- `profileId`
- `mcpId`
- `sourceAgentName`
- `agentNames`
- normalized `definition` including preserved `scope`
- `scope`
- `envRiskPolicy`
- `scopePolicy`
- `blockers: []`
- `eligibilityReason`

Use one same-scope duplicate fixture, for example two `filesystem` definitions with `scope: { kind: 'global' }` and equivalent stdio command data.

**Step 2: Run test to verify it fails**

Run: `cmd /d /c "npm run build && node --test dist/mcp/planner.test.js"`

Expected: assertions fail because current `canonicalProfileCandidate` is still lightweight and does not include status, scope, policies, blockers, or eligibility reason.

**Step 3: Write minimal implementation**

- Extend `McpCanonicalProfileCandidate` in `src/types/index.ts` with the fields listed above.
- Add a small `McpCanonicalProfileStatus = 'eligible'` type only if it keeps the type clearer.
- Update `createCanonicalProfileCandidate()` in `src/mcp/planner.ts` so it copies `sourceDefinition.scope` into both `definition.scope` and candidate-level `scope`.
- Populate `envRiskPolicy: 'no-env-risk-detected'`, `scopePolicy: 'no-scope-conflict-detected'`, `blockers: []`, and a concise `eligibilityReason` for canonical candidates.
- Keep `requiresWrite: false` unchanged.

**Step 4: Run test to verify it passes**

Run: `cmd /d /c "npm run build && node --test dist/mcp/planner.test.js"`

Expected: planner tests pass and existing canonical candidate behavior remains unchanged except for richer evidence fields.

**Step 5: Commit**

```bash
git add src/types/index.ts src/mcp/planner.ts src/mcp/planner.test.ts
git commit -m "feat: enrich mcp canonical profile candidates"
```

### Task 2: Add Canonical Profile Blocker Metadata

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/mcp/planner.ts`
- Test: `src/mcp/planner.test.ts`

**Step 1: Write the failing tests**

Add planner tests proving that non-eligible actions carry explicit canonical profile blockers:
- single-agent `skip` action gets `canonicalProfileBlockers: ['single-agent']`
- unknown transport `manual-review` gets `canonicalProfileBlockers: ['unknown-transport']`
- sensitive env `manual-review` gets `canonicalProfileBlockers: ['sensitive-env']`
- scope conflict `manual-review` gets `canonicalProfileBlockers: ['scope-conflict']`
- drifted equivalent id but different command/host `manual-review` gets `canonicalProfileBlockers: ['definition-drift']`
- eligible canonical candidate gets `canonicalProfileBlockers: []`

Also assert all actions still have `requiresWrite: false`.

**Step 2: Run test to verify it fails**

Run: `cmd /d /c "npm run build && node --test dist/mcp/planner.test.js"`

Expected: assertions fail because actions do not yet expose canonical profile blocker metadata.

**Step 3: Write minimal implementation**

- Add `McpCanonicalProfileBlocker` union type in `src/types/index.ts`:
  - `'single-agent'`
  - `'unknown-transport'`
  - `'sensitive-env'`
  - `'scope-conflict'`
  - `'definition-drift'`
- Add `canonicalProfileBlockers: McpCanonicalProfileBlocker[]` to `McpGovernanceAction`.
- Thread `canonicalProfileBlockers` through `createAction()` in `src/mcp/planner.ts`.
- Populate blockers at the same decision points that already choose `skip`, `manual-review`, or `canonical-candidate`.
- Preserve existing precedence: unknown transport and sensitive env remain the action reason when present; scope conflict remains separate metadata when applicable.

**Step 4: Run test to verify it passes**

Run: `cmd /d /c "npm run build && node --test dist/mcp/planner.test.js"`

Expected: planner tests pass with explicit blocker metadata on every action.

**Step 5: Commit**

```bash
git add src/types/index.ts src/mcp/planner.ts src/mcp/planner.test.ts
git commit -m "feat: classify mcp canonical profile blockers"
```

### Task 3: Report Canonical Profile Eligibility And Blockers

**Files:**
- Modify: `src/mcp/reporter.ts`
- Test: `src/mcp/reporter.test.ts`

**Step 1: Write the failing tests**

Add reporter tests proving Markdown includes:
- canonical profile candidate `status`
- candidate `scope`
- candidate `envRiskPolicy` and `scopePolicy`
- candidate `eligibilityReason`
- manual-review canonical profile blockers in a clear column
- action table blocker metadata

Also assert JSON output from `writeMcpGovernancePlanReports()` preserves:
- `canonicalProfileCandidate.status`
- `canonicalProfileCandidate.scope`
- `canonicalProfileCandidate.blockers`
- `canonicalProfileBlockers`

**Step 2: Run test to verify it fails**

Run: `cmd /d /c "npm run build && node --test dist/mcp/reporter.test.js"`

Expected: report assertions fail because Markdown currently shows canonical profile candidates but not the richer eligibility and blocker evidence.

**Step 3: Write minimal implementation**

- Extend the canonical profile candidates table with compact columns for `Status`, `Scope`, `Env Policy`, `Scope Policy`, and `Eligibility Reason`.
- Add a `Canonical Profile Blockers` column to the manual-review table or actions table, whichever keeps the Markdown clearer with less duplication.
- Format empty blocker arrays as `none` and non-empty arrays as comma-separated blocker ids.
- Format scope using the existing compact style: `global`, `project:<id>`, `workspace:<id>`, or `unknown`.
- Keep JSON writer behavior as serialization of the plan object plus summary; do not add a new report surface.

**Step 4: Run test to verify it passes**

Run: `cmd /d /c "npm run build && node --test dist/mcp/reporter.test.js"`

Expected: reporter tests pass and Markdown clearly explains why candidates are eligible or blocked.

**Step 5: Commit**

```bash
git add src/mcp/reporter.ts src/mcp/reporter.test.ts
git commit -m "feat: report mcp canonical profile evidence"
```

### Task 4: Summarize Canonical Profile Eligibility In CLI

**Files:**
- Modify: `src/mcp/reporter.ts`
- Modify: `src/cli/commands.ts`
- Test: `src/cli/commands.test.ts`

**Step 1: Write the failing tests**

Add CLI tests proving `mcp plan` terminal output includes:
- canonical candidate count
- blocked canonical profile review count
- blocker breakdown, for example `Canonical Profile Blockers: scope-conflict=1, sensitive-env=1`

Use injected inventory fixtures that produce one eligible canonical candidate and at least one blocked manual-review action.

**Step 2: Run test to verify it fails**

Run: `cmd /d /c "npm run build && node --test dist/cli/commands.test.js"`

Expected: CLI output assertions fail because the terminal summary does not yet expose canonical profile blocker breakdowns.

**Step 3: Write minimal implementation**

- Extend `McpGovernancePlanSummary` in `src/mcp/reporter.ts` with:
  - `canonicalProfileEligible`
  - `canonicalProfileBlocked`
  - `canonicalProfileBlockers: Record<string, number>`
- Compute those counts from `canonicalProfileCandidate` and `canonicalProfileBlockers`.
- Add compact lines in `executeMcp()` in `src/cli/commands.ts`.
- Do not add new CLI subcommands or write modes.

**Step 4: Run test to verify it passes**

Run: `cmd /d /c "npm run build && node --test dist/cli/commands.test.js"`

Expected: CLI command tests pass and `mcp plan` remains read-only.

**Step 5: Commit**

```bash
git add src/mcp/reporter.ts src/cli/commands.ts src/cli/commands.test.ts
git commit -m "feat: summarize mcp canonical profile blockers in cli"
```

### Task 5: Final Verification

**Files:**
- No planned code changes.

**Step 1: Run full verification**

Run: `npm test`

Expected: all tests pass.

**Step 2: Inspect final status and diff**

Run: `git status --short --branch` and `git diff --stat master...HEAD`

Expected: clean worktree after commits; diff limited to MCP canonical profile model work.

**Step 3: Report**

Report changed files, canonical profile eligibility/blocker decisions, test commands/results, commits, and whether the branch is ready for review.
