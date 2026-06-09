# MCP Agent Config Adapters v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract a read-only MCP config adapter layer for `opencode`, `codex`, and `claude-code`, so scanner behavior reuses a shared adapter contract without changing current inventory outputs.

**Architecture:** Keep all behavior read-only and scanner-facing. Introduce a small adapter contract that parses agent-specific MCP config files into a normalized in-memory shape, then have scanners map that normalized shape into existing `MCPServer` records. Do not add apply/restore, do not alter governance write semantics, and do not introduce Web, SQLite, or routing concerns.

**Tech Stack:** TypeScript, Node.js built-in test runner, existing JSON/TOML parsers, existing scanner test fixtures.

---

### Task 1: Define Read-Only MCP Adapter Types

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/mcp/adapters/base.ts`
- Test: `src/mcp/adapters/base.test.ts`

**Step 1: Write the failing test**

Add a small type/behavior test asserting a normalized adapter server shape can represent:
- id
- transport
- command or host
- hasSensitiveEnv
- source scope metadata (`global`, `project`, `workspace`, or `unknown`)

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/adapters/base.test.js`

Expected: build fails because the adapter module and types do not exist.

**Step 3: Write minimal implementation**

Add a minimal read-only adapter contract and normalized server record type. Keep it independent from write/apply semantics.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/adapters/base.test.js`

Expected: base adapter tests pass.

**Step 5: Commit**

Run: `git add src/types/index.ts src/mcp/adapters/base.ts src/mcp/adapters/base.test.ts && git commit -m "feat: define mcp adapter contract"`

### Task 2: Add OpenCode Adapter

**Files:**
- Create: `src/mcp/adapters/opencode.ts`
- Test: `src/mcp/adapters/opencode.test.ts`
- Modify: `src/scanner/opencode.ts`
- Test: `src/scanner/opencode.test.ts`

**Step 1: Write the failing tests**

Add adapter-level tests for:
- BOM-prefixed JSON
- object-form MCP entries under `mcp`
- array-form local commands
- sensitive env detection

Add or update scanner tests so scanner behavior still matches current outputs while reading through the adapter.

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/adapters/opencode.test.js dist/scanner/opencode.test.js`

Expected: build or test fails because the adapter does not exist and scanner is still directly parsing config.

**Step 3: Write minimal implementation**

Implement the OpenCode adapter and switch `OpenCodeScanner.scanMCP()` to use it.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/adapters/opencode.test.js dist/scanner/opencode.test.js`

Expected: adapter and scanner tests pass.

**Step 5: Commit**

Run: `git add src/mcp/adapters/opencode.ts src/mcp/adapters/opencode.test.ts src/scanner/opencode.ts src/scanner/opencode.test.ts && git commit -m "feat: add opencode mcp adapter"`

### Task 3: Add Codex Adapter

**Files:**
- Create: `src/mcp/adapters/codex.ts`
- Test: `src/mcp/adapters/codex.test.ts`
- Modify: `src/scanner/codex.ts`
- Test: `src/scanner/codex.test.ts`

**Step 1: Write the failing tests**

Add adapter-level tests for:
- TOML `mcp_servers`
- stdio command extraction
- URL transport mapping
- sensitive env detection

Update scanner tests so scanner behavior remains unchanged after adapter adoption.

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/adapters/codex.test.js dist/scanner/codex.test.js`

Expected: build or assertions fail because the adapter does not exist and scanner still parses TOML directly.

**Step 3: Write minimal implementation**

Implement the Codex adapter and switch `CodexScanner.scanMCP()` to use it.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/adapters/codex.test.js dist/scanner/codex.test.js`

Expected: adapter and scanner tests pass.

**Step 5: Commit**

Run: `git add src/mcp/adapters/codex.ts src/mcp/adapters/codex.test.ts src/scanner/codex.ts src/scanner/codex.test.ts && git commit -m "feat: add codex mcp adapter"`

### Task 4: Add Claude Code Adapter

**Files:**
- Create: `src/mcp/adapters/claude-code.ts`
- Test: `src/mcp/adapters/claude-code.test.ts`
- Modify: `src/scanner/claude-code.ts`
- Test: `src/scanner/claude-code.test.ts`

**Step 1: Write the failing tests**

Add adapter-level tests for:
- global `mcpServers`
- project-scoped `projects.*.mcpServers`
- scope metadata per record
- stdio/http/sse transport mapping
- sensitive env detection

Update scanner tests to ensure output ids and fields remain stable after adapter reuse.

**Step 2: Run test to verify it fails**

Run: `npm run build && node --test dist/mcp/adapters/claude-code.test.js dist/scanner/claude-code.test.js`

Expected: build or assertions fail because the adapter does not exist and scanner is still directly parsing nested JSON.

**Step 3: Write minimal implementation**

Implement the Claude Code adapter and switch `ClaudeCodeScanner.scanMCP()` to use it.

**Step 4: Run test to verify it passes**

Run: `npm run build && node --test dist/mcp/adapters/claude-code.test.js dist/scanner/claude-code.test.js`

Expected: adapter and scanner tests pass.

**Step 5: Commit**

Run: `git add src/mcp/adapters/claude-code.ts src/mcp/adapters/claude-code.test.ts src/scanner/claude-code.ts src/scanner/claude-code.test.ts && git commit -m "feat: add claude code mcp adapter"`

### Task 5: Final Verification

**Files:**
- No planned code changes.

**Step 1: Run full verification**

Run: `npm test`

Expected: all tests pass.

**Step 2: Inspect final status and diff**

Run: `git status --short --branch` and `git diff --stat master...HEAD`

Expected: clean worktree after commits; diff limited to adapter extraction work.

**Step 3: Report**

Report changed files, test commands/results, and whether the adapter branch is ready for review.
