# Skills-First Governance Roadmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve MCPskills Center from a read-heavy local audit CLI into a dual-layer governance platform: first a reliable CLI execution kernel for skills governance, then MCP governance, then a local Web control plane, and only after that an intelligent agent routing layer.

**Architecture:** Keep the CLI as the long-lived system kernel and source of operational truth for scan, plan, apply, and restore. Add a local Web console as a separate orchestration and visualization layer on top of the CLI/report model. Use files as the initial source of truth for configs, reports, and backups, then incrementally add SQLite for history, query speed, and routing-state storage once governance workflows are stable.

**Tech Stack:** TypeScript, Node.js built-in test runner, local filesystem scanning, JSON/TOML config parsing, static/offline HTML, optional future local HTTP server for the Web console, optional future SQLite for state and history.

---

## Confirmed Product Direction

This plan is based on the following confirmed decisions:

- Priority order:
  - `skills governance`
  - `mcp governance`
  - `unified governance control plane`
  - `intelligent local agent routing`
- Delivery shape:
  - long-term: `CLI kernel + local Web console`
  - short-term: `CLI first, Web later`
- State model:
  - short-term: files remain the source of truth
  - medium-term: hybrid file + SQLite
- Execution rule:
  - governance workflows must be safe, auditable, and reversible before they are convenient

This means the project should not jump directly into a local server, orchestration layer, or agent routing UI. The next durable value is making the current `scan -> sync --dry-run -> sync --apply -> sync --restore` line trustworthy, explainable, and extensible.

---

## Current Baseline Summary

The current branch already has strong foundations:

- multi-agent registry and discovery
- dedicated read-only scanners for baseline agents plus several research agents
- capability matrix reporting
- support metadata across CLI, discovery, inventory, and dashboard
- static bilingual dashboard
- skill sync planning, apply, and restore with backup manifests

What is still missing for a true governance product:

- better skill sync action semantics than the current coarse duplicate-only planner
- stronger canonical-source policy and install ownership model
- persistent operation history and diff visibility
- Web control plane
- MCP write-governance model
- routing adapters and policy engine

The roadmap below treats those as explicit phases rather than implicit “later” work.

---

## Architectural Decisions

### ADR 1: Keep CLI as the governance kernel

**Decision:** All governance operations remain implementable through CLI commands first.

**Why:**

- CLI is already tested and scriptable.
- CLI is easier to make safe than a Web UI.
- CLI outputs can be versioned, diffed, and automated.
- Web can call or wrap the same kernels later.

**Trade-off:** The product will feel less like a “real admin console” in the first milestone.

### ADR 2: Web console is a control plane, not the system of record

**Decision:** The first Web console should read reports and trigger kernel operations rather than inventing a separate execution model.

**Why:**

- avoids duplicating apply/restore logic
- keeps safety rules in one place
- reduces mismatch between CLI and Web behavior

### ADR 3: Files first, SQLite later

**Decision:** Keep configs, reports, and backup manifests file-based in the short term. Add SQLite only when history/state queries become a product requirement.

**Why:**

- matches the current repository shape
- keeps debugging transparent
- avoids premature data migration complexity

**Trigger for SQLite:** when the project needs operation history, cross-run analytics, routing state, or fast incremental refresh.

### ADR 4: Routing comes after governance correctness

**Decision:** Do not build automatic local agent routing until skills and MCP governance are stable.

**Why:**

- routing on top of drifting or duplicated capability state will be unreliable
- governance state becomes routing input later
- correctness beats cleverness here

---

## Recommended Roadmap

### Phase 1: Skills Governance Kernel

**Objective:** Turn the existing skills sync flow into a precise, trustworthy governance workflow.

**Outcome:** A user can inspect, plan, apply, and restore skills changes with clear ownership and low surprise.

**What to build:**

- richer skill action taxonomy
  - distinguish `dedupe`, `repair-metadata`, `promote-canonical`, `distribute`, `skip`, `manual-review`
- canonical source policy
  - explicitly track whether a skill originates from canonical storage, agent install root, or imported external source
- plan explainability
  - add before/after summaries and target impact breakdown
- stronger sync reports
  - per-agent action counts, skipped reasons, and rollback hints
- safer apply semantics
  - dry-run parity with apply
  - clearer refusal cases when targets are ambiguous or unowned

**Why first:** This is the nearest path from “audit tool” to “actual governance tool”.

### Phase 2: Skills Governance UX Layer

**Objective:** Make the skills kernel easy to operate before building full MCP governance.

**Outcome:** A user can review a sync plan and execute it without reading raw JSON.

**What to build:**

- richer dashboard sections for sync plans
- action grouping by agent and skill
- operation receipts in Markdown/HTML
- first local Web shell in read-only or limited-trigger mode

**Constraint:** Web must remain a thin control plane around the CLI kernel.

### Phase 3: MCP Governance Kernel

**Objective:** Extend governance from skills to MCP configurations.

**Outcome:** A user can inventory MCP duplication and drift, then generate explicit MCP governance plans without blindly editing multiple agents.

**What to build:**

- canonical MCP profile model
- per-agent MCP config adapters
- MCP plan/apply/restore flow
- env-risk handling rules
- active-vs-passive write support boundaries per agent

**Constraint:** Only agents with proven config semantics move to write-capable MCP governance.

### Phase 4: Unified Governance Control Plane

**Objective:** Merge skills and MCP governance into one local product surface.

**Outcome:** One workflow can answer:

- what is installed?
- what is duplicated?
- what should change?
- what changed last time?
- how do I roll it back?

**What to build:**

- unified local Web console
- command trigger surface for scan / plan / apply / restore
- operation history page
- plan comparison and diff views

### Phase 5: Hybrid State and History

**Objective:** Add SQLite once the governance workflows deserve persistent operational history.

**Outcome:** Faster queries, operation history, historical comparisons, and future routing inputs.

**What to store in SQLite first:**

- inventory snapshots metadata
- sync/apply/restore run history
- per-run action results
- capability presence cache

**What should stay file-based initially:**

- source configs
- generated reports
- backup payloads
- manifests

### Phase 6: Intelligent Local Agent Routing

**Objective:** Use the governed capability state to route tasks to the most appropriate local agent.

**Outcome:** The system can choose an agent based on installed skills, MCP availability, support maturity, and policy.

**What to build:**

- routing policy schema
- task-classification inputs
- per-agent launch/invoke adapters
- fallback order and audit log
- human override model

**Hard rule:** no routing before governance state is stable and queryable.

---

## First Implementation Slice Recommendation

The next implementation milestone should be a narrow, high-value slice from Phase 1.

**Recommended slice:** “Skills Governance Kernel v2”

That slice should include:

- more expressive sync plan action types
- deterministic canonical promotion rules
- clearer skip/manual-review reasons
- improved sync Markdown/HTML/JSON reporting
- tests that prove dry-run and apply align

This is better than starting with Web because:

- it improves the core engine instead of decorating a rough one
- it produces cleaner inputs for the future control plane
- it directly reduces the pain of duplicated local skills installs

---

## Execution Plan

### Task 1: Formalize Skills Governance v2 data model

**Files:**

- Modify: `src/types/index.ts`
- Modify: `src/sync/planner.ts`
- Test: `src/sync/planner.test.ts`

**Step 1: Write the failing tests**

Add tests that prove the planner can distinguish at least these cases:

- duplicate valid installs -> canonical promotion + per-agent distribution actions
- single install valid skill -> skip with explicit reason
- missing `SKILL.md` -> manual review
- invalid frontmatter -> manual review
- already canonical install -> skip without redundant copy

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: planner assertions fail because current action model is too coarse.

**Step 3: Write minimal implementation**

- expand `SyncAction['type']`
- add action metadata needed for reporting
- refine planner decision branches

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: planner tests pass.

**Step 5: Commit**

```bash
git add src/types/index.ts src/sync/planner.ts src/sync/planner.test.ts
git commit -m "feat: refine skills sync action model"
```

### Task 2: Make sync reports governance-grade

**Files:**

- Modify: `src/reporter/*` or current sync report writer modules
- Modify: `src/dashboard/html.ts`
- Test: report writer tests and `src/dashboard/html.test.ts`

**Step 1: Write the failing tests**

Add tests asserting:

- per-action-type grouping is visible
- manual-review reasons are rendered clearly
- per-agent action summaries are present
- dashboard can surface the latest sync plan summary

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: reports do not yet contain the richer structure.

**Step 3: Write minimal implementation**

- enrich sync plan Markdown/JSON writers
- add compact sync-plan summary surface to dashboard

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: report tests pass.

**Step 5: Commit**

```bash
git add src/dashboard/html.ts src/dashboard/html.test.ts src sync report files
git commit -m "feat: improve skills governance reports"
```

### Task 3: Tighten apply/restore safety semantics

**Files:**

- Modify: `src/sync/apply.ts`
- Modify: `src/sync/restore.ts`
- Test: `src/sync/apply.test.ts`
- Test: `src/sync/restore.test.ts`

**Step 1: Write the failing tests**

Add tests asserting:

- apply refuses unsupported new action types
- apply records clearer receipts for every executed write action
- restore remains valid for the refined action model
- ambiguous targets refuse before writes happen

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: current apply/restore semantics are too generic.

**Step 3: Write minimal implementation**

- align apply with refined action types
- enrich manifests or receipts only as needed
- preserve approved-root safety model

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: apply/restore tests pass.

**Step 5: Commit**

```bash
git add src/sync/apply.ts src/sync/restore.ts src/sync/apply.test.ts src/sync/restore.test.ts
git commit -m "feat: harden skills apply and restore flow"
```

### Task 4: Add CLI surfaces for governance readability

**Files:**

- Modify: `src/cli/commands.ts`
- Modify: `src/cli.ts`
- Test: `src/cli/commands.test.ts`

**Step 1: Write the failing tests**

Add tests for command output that shows:

- sync dry-run summary by action type
- clearer apply completion summary
- clearer restore completion summary

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: terminal output is too shallow.

**Step 3: Write minimal implementation**

- enrich CLI summary text only where it improves operator clarity

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: command tests pass.

**Step 5: Commit**

```bash
git add src/cli.ts src/cli/commands.ts src/cli/commands.test.ts
git commit -m "feat: improve skills governance cli output"
```

### Task 5: Document the post-kernel roadmap

**Files:**

- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/supported-agents.md`
- Modify: `docs/supported-agents.zh-CN.md`

**Step 1: Write the failing docs expectation**

Create a short checklist in the implementation session:

- README explains CLI-first / Web-later direction
- docs explain that skills governance is the first write-capable product lane
- docs state MCP governance is next

**Step 2: Update docs**

- keep docs concise
- avoid promising routing too early

**Step 3: Run verification**

Run: `npm test`

Expected: existing tests stay green.

**Step 4: Commit**

```bash
git add README.md README.zh-CN.md docs/supported-agents.md docs/supported-agents.zh-CN.md
git commit -m "docs: clarify governance roadmap"
```

---

## Risks and Mitigations

### Risk 1: Planner complexity grows faster than usability

**Mitigation:** only add action types that directly change operator understanding or apply behavior.

### Risk 2: Web console arrives too early and duplicates CLI logic

**Mitigation:** require every Web-triggered action to map to an existing kernel operation.

### Risk 3: SQLite arrives before the product needs it

**Mitigation:** defer until operation history and routing demand persistent queryable state.

### Risk 4: MCP governance copies the wrong source of truth

**Mitigation:** keep non-baseline agents read-only until active MCP semantics are proven.

### Risk 5: Routing pressure derails governance work

**Mitigation:** explicitly treat routing as Phase 6, not Phase 2 disguised as “just an adapter”.

---

## Success Criteria

This roadmap is working if, after the next implementation slice:

- duplicated skills can be explained and acted on more precisely than today
- apply/restore semantics remain safe and auditable
- the CLI becomes a credible daily governance tool
- the future Web console has cleaner kernel primitives to wrap
- MCP governance can reuse the same execution model later

---

## Recommended Next Step

Do **not** start with Web or SQLite.

Start with **Phase 1 / Task 1** from this plan: refine the skills sync action model and make the kernel more governance-aware.

That is the shortest path to turning MCPskills Center from a strong scanner into a true local governance system.

---

Plan complete and saved to `docs/plans/2026-06-08-skills-first-governance-roadmap.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
