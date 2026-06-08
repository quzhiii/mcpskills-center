# Multi-Agent Registry and Skill Distribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade MCPskills Center from a Claude Code / OpenCode / Codex scanner into a local-first multi-agent capability governance tool that can discover, scan, audit, and eventually synchronize MCP servers, skills, commands, plugins, and related capability packages across all local agents.

**Architecture:** Introduce an agent registry as the source of truth for known agents, then move scanner selection from hardcoded switch statements to registry-driven scanner plugins. Keep new agents read-only until their config formats and write semantics are proven. Add a companion agent skill package later so other users can quickly operate MCPskills Center from their preferred AI coding assistant.

**Tech Stack:** TypeScript, Node.js built-in test runner, JSON/TOML config parsing, local filesystem scanning, static HTML/Markdown/JSON reports, Git worktrees for milestone isolation.

---

## Current Baseline

As of this plan, `master` is pushed to `origin/master` and includes:

- `f0228fc chore: add MIT license`
- `cf1c35d docs: add bilingual README`
- `9f64900 Merge branch 'feature/mcpskills-center-completion'`

Baseline verification in the feature worktree:

```bash
npm test
```

Expected baseline result:

```text
# pass 59
# fail 0
```

Feature branch and worktree:

- Branch: `feature/multi-agent-registry`
- Worktree: `.worktrees/multi-agent-registry`

---

## Product Direction

MCPskills Center should govern local agent capability assets, not only three initial agents. It should eventually support at least:

- Claude Code
- OpenCode
- Codex
- Qoder
- Qoder Work
- CodeBuddy
- WorkBuddy
- Trae
- Other future local agents with MCP, skills, commands, plugins, prompts, extensions, or tool packages

The safe expansion rule is:

```text
discover first -> read-only scan -> audit/report -> profile planning -> opt-in write support
```

Unknown or partially understood agents must default to read-only discovery and report-only scanning.

---

## Is This a Skill?

MCPskills Center itself should remain a CLI / local governance tool. A CLI is the right core artifact because it can be tested, versioned, run in CI, used outside any single agent, and safely operate on local files.

It should also ship a companion skill later:

- Skill name: `mcpskills-center`
- Purpose: teach another AI agent how to use the CLI safely
- Contents: short `SKILL.md`, command reference, safety workflow, onboarding checklist, and optional scripts for quick local detection
- Distribution: packaged `.skill` file plus repository docs

The companion skill should not duplicate the CLI implementation. It should be an operator guide that triggers when users ask things like:

- “scan my local agents”
- “audit my MCP servers”
- “sync skills safely”
- “discover Qoder/Trae/CodeBuddy configs”
- “show my agent capability matrix”

---

## Milestone Strategy

Each milestone should have a branch checkpoint, test command, commit, and push.

Recommended commit cadence:

1. Commit the plan.
2. Commit registry schema and loader.
3. Commit CLI `agents list`.
4. Commit discovery report foundation.
5. Commit scanner registry refactor.
6. Commit docs updates.
7. Push after every passing milestone.

Verification gate before each push:

```bash
npm test
git status --short --branch
git log --oneline -5
```

---

## Phase 0: Plan and Worktree Milestone

**Priority:** P0

**Goal:** Save this plan and push it so the roadmap is recoverable before implementation begins.

**Files:**

- Create: `docs/plans/2026-06-04-multi-agent-registry-and-skill-distribution.md`

**Steps:**

1. Write this plan.
2. Run `npm test`.
3. Commit:

```bash
git add docs/plans/2026-06-04-multi-agent-registry-and-skill-distribution.md
git commit -m "docs: plan multi-agent registry roadmap"
```

4. Push:

```bash
git push -u origin feature/multi-agent-registry
```

**Expected result:** Plan is on the feature branch and visible on GitHub.

---

## Phase 1: Agent Registry Schema and Loader

**Priority:** P0

**Goal:** Move known agent definitions out of `src/scanner/index.ts` hardcoding into a local registry config while preserving current scan behavior.

**Architecture:** Add `config/agents.json` as the user-editable registry. Add `src/config/agents.ts` for loading, validation, default fallback, and project-root-relative path handling. Keep the existing `AgentConfig` fields compatible, then extend them incrementally.

**Files:**

- Create: `config/agents.json`
- Create: `src/config/agents.ts`
- Create: `src/config/agents.test.ts`
- Modify: `src/types/index.ts`
- Modify: `src/scanner/index.ts`
- Modify: `src/index.ts`

**Schema v1:**

```json
{
  "agents": [
    {
      "id": "claude-code",
      "displayName": "Claude Code",
      "vendor": "Anthropic",
      "scannerType": "claude-code",
      "enabled": true,
      "readOnly": false,
      "configDir": "~/.claude",
      "skillsDir": "~/.claude/skills",
      "mcpConfigFile": "~/.claude.json"
    }
  ]
}
```

**TDD Steps:**

1. Write failing tests in `src/config/agents.test.ts`:

```ts
test('loadAgentRegistry reads enabled agents and expands home paths', async () => {
  // create temp config with ~/.claude paths
  // assert loaded agent.name === 'claude-code'
  // assert paths are absolute and expanded
});
```

2. Run:

```bash
npm test -- --test-name-pattern loadAgentRegistry
```

Expected: fails because loader does not exist.

3. Implement minimal loader:

- Accept `id` and map it to existing `AgentConfig.name`
- Expand `~` to `homedir()`
- Resolve relative paths from project root
- Filter `enabled: false`
- Validate required fields

4. Update `src/scanner/index.ts`:

- Keep `DEFAULT_AGENTS` as fallback
- Add `runInventory(agents = DEFAULT_AGENTS)` compatibility
- Prepare for registry-injected agents from `src/index.ts`

5. Update `src/index.ts`:

- Load `config/agents.json`
- Pass loaded agents into `runInventory`
- Fall back to defaults when missing

6. Run:

```bash
npm test
```

7. Commit:

```bash
git add config/agents.json src/config/agents.ts src/config/agents.test.ts src/types/index.ts src/scanner/index.ts src/index.ts
git commit -m "feat: load agents from registry config"
```

8. Push:

```bash
git push
```

**Acceptance:** Existing `scan`, `audit`, `sync --dry-run`, `profile plan`, and `health` still work for Claude Code / OpenCode / Codex.

---

## Phase 2: `agents list` CLI

**Priority:** P0

**Goal:** Expose registry state to users without scanning live configs.

**Files:**

- Modify: `src/cli.ts`
- Modify: `src/cli/commands.ts`
- Modify: `src/cli/commands.test.ts`
- Modify: `src/index.test.ts`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Command:**

```bash
node dist/index.js agents list
```

**Output shape:**

```text
Registered agents:
   claude-code - Claude Code [scanner: claude-code, enabled]
   opencode - OpenCode [scanner: opencode, enabled]
   codex - Codex [scanner: codex, enabled]
   qoder - Qoder [scanner: generic, disabled/read-only]
```

**TDD Steps:**

1. Add parser test:

```ts
const parsed = parseCliArgs(['agents', 'list']);
assert.equal(parsed.command, 'agents');
assert.equal(parsed.options.subcommand, 'list');
```

2. Add command test with injected registry list.
3. Run targeted tests and confirm failure.
4. Implement command parsing and help text.
5. Add `loadAgents` or `listAgents` dependency to `CommandContext`.
6. Run `npm test`.
7. Commit:

```bash
git add src/cli.ts src/cli/commands.ts src/cli/commands.test.ts src/index.test.ts README.md README.zh-CN.md
git commit -m "feat: list registered agents"
```

8. Push.

**Acceptance:** Users can see all configured agent definitions even before discovery is implemented.

---

## Phase 3: Agent Discovery Report Foundation

**Priority:** P0

**Goal:** Add read-only discovery for known and suspected local agent config locations.

**Files:**

- Create: `src/agents/discovery.ts`
- Create: `src/agents/discovery.test.ts`
- Create: `src/agents/reporter.ts`
- Create: `src/agents/reporter.test.ts`
- Modify: `src/cli.ts`
- Modify: `src/cli/commands.ts`
- Modify: `src/types/index.ts`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Command:**

```bash
node dist/index.js agents discover
```

**Candidate names:**

- `qoder`
- `qoder-work`
- `codebuddy`
- `workbuddy`
- `trae`

**Initial path probes on Windows:**

- `%USERPROFILE%/.qoder`
- `%USERPROFILE%/.qoder-work`
- `%USERPROFILE%/.codebuddy`
- `%USERPROFILE%/.workbuddy`
- `%USERPROFILE%/.trae`
- `%APPDATA%/Qoder`
- `%APPDATA%/CodeBuddy`
- `%APPDATA%/Trae`
- `%LOCALAPPDATA%/Qoder`
- `%LOCALAPPDATA%/CodeBuddy`
- `%LOCALAPPDATA%/Trae`

**Initial path probes cross-platform:**

- `~/.qoder`
- `~/.codebuddy`
- `~/.trae`
- `~/.config/qoder`
- `~/.config/codebuddy`
- `~/.config/trae`

**Discovery statuses:**

- `confirmed`: expected config files found
- `candidate`: directory exists but format is unknown
- `missing`: known path absent
- `unsupported`: known app detected but no scanner yet

**Report outputs:**

- `reports/agent-discovery-current.json`
- `reports/agent-discovery-current.md`

**TDD Steps:**

1. Write discovery tests using temp directories and environment overrides.
2. Write reporter tests for Markdown output.
3. Run targeted tests and confirm failure.
4. Implement filesystem probing with no writes.
5. Add `agents discover` command.
6. Run `npm test`.
7. Commit:

```bash
git add src/agents src/cli.ts src/cli/commands.ts src/types/index.ts README.md README.zh-CN.md
git commit -m "feat: discover local agent candidates"
```

8. Push.

**Acceptance:** New local agents are discoverable as candidates without modifying any of their files.

---

## Phase 4: Scanner Plugin Registry

**Priority:** P1

**Goal:** Replace the `switch (agent.name)` scanner dispatch with scanner plugin registration keyed by `scannerType`.

**Files:**

- Create: `src/scanner/registry.ts`
- Create: `src/scanner/registry.test.ts`
- Modify: `src/scanner/index.ts`
- Modify: `src/scanner/base.ts`
- Modify: `src/types/index.ts`

**Design:**

```ts
type ScannerFactory = (agent: AgentConfig) => BaseScanner;

const scannerFactories = new Map<string, ScannerFactory>([
  ['claude-code', agent => new ClaudeCodeScanner(agent)],
  ['opencode', agent => new OpenCodeScanner(agent)],
  ['codex', agent => new CodexScanner(agent)],
  ['generic', agent => new GenericDirectoryScanner(agent)],
]);
```

Unknown scanner behavior:

- no throw by default during `scan`
- produce an agent warning in future report
- skip scan for unknown scanner types

**TDD Steps:**

1. Test known scanner type resolves factory.
2. Test unknown scanner type is skipped safely.
3. Refactor `runInventory` to use registry.
4. Run `npm test`.
5. Commit and push.

**Acceptance:** Existing scanners work through registry. Adding Qoder/Trae scanner later requires only registering a plugin.

---

## Phase 5: Generic Read-only Agent Scanner

**Priority:** P1

**Goal:** Provide fallback read-only scanning for unknown agents that have directories but no dedicated parser.

**Files:**

- Create: `src/scanner/generic.ts`
- Create: `src/scanner/generic.test.ts`
- Modify: `src/scanner/registry.ts`

**Generic scanner behavior:**

- Scan configured `skillsDir` for subdirectories.
- Mark `hasSkillMd` when `SKILL.md` exists.
- Do not parse arbitrary secrets.
- Do not print env values.
- Detect common MCP config filenames only by path and basic JSON/TOML shape.

**TDD Steps:**

1. Test skill directory scan with one valid skill and one incomplete skill.
2. Test missing directories return empty arrays.
3. Test no writes happen.
4. Implement minimal generic scanner.
5. Run `npm test`.
6. Commit and push.

**Acceptance:** Qoder/Trae/CodeBuddy can be represented as generic read-only agents while dedicated parsers are still unknown.

---

## Phase 6: Capability Matrix v1

**Priority:** P1

**Goal:** Add a cross-agent view that shows which agent has which skill/MCP capability.

**Files:**

- Create: `src/matrix/capability.ts`
- Create: `src/matrix/capability.test.ts`
- Create: `src/matrix/reporter.ts`
- Create: `src/matrix/reporter.test.ts`
- Modify: `src/cli.ts`
- Modify: `src/cli/commands.ts`
- Modify: `src/dashboard/html.ts`

**Command:**

```bash
node dist/index.js matrix
```

**Outputs:**

- `reports/capability-matrix-current.json`
- `reports/capability-matrix-current.md`

**TDD Steps:**

1. Test matrix groups skills and MCPs by agent.
2. Test duplicate capability counts.
3. Test Markdown output.
4. Add CLI command.
5. Run `npm test`.
6. Commit and push.

**Acceptance:** Users can see cross-agent overlap before any sync action.

---

## Phase 7: Dedicated Agent Format Research and Scanners

**Priority:** P2

**Goal:** Add dedicated read-only scanners for Qoder, Qoder Work, CodeBuddy, WorkBuddy, and Trae once real local config formats are known.

**Files per agent:**

- Create: `docs/research/<agent>-local-config.md`
- Create: `src/scanner/<agent>.ts`
- Create: `src/scanner/<agent>.test.ts`
- Modify: `src/scanner/registry.ts`
- Modify: `config/agents.json`

**Research checklist:**

- Locate config roots.
- Identify MCP config format.
- Identify skill/tool/plugin package roots.
- Identify whether commands are JSON array, string, TOML, YAML, or custom DB.
- Identify write safety and backup requirements.
- Decide scanner support status: read-only only, profile-plan only, or eventually sync-capable.

**Acceptance:** Each dedicated scanner has fixtures and tests before touching real local config.

---

## Phase 8: Companion Skill Distribution

**Priority:** P2

**Goal:** Package MCPskills Center as an installable agent skill so other users can operate the CLI safely from their coding agent.

**Files:**

- Create: `skills/mcpskills-center/SKILL.md`
- Create: `skills/mcpskills-center/references/cli-workflows.md`
- Create: `skills/mcpskills-center/references/safety-model.md`
- Optional: `skills/mcpskills-center/scripts/check_install.js`

**Skill purpose:**

The companion skill tells an AI agent how to:

- install dependencies
- run `npm test`
- run `scan`, `audit`, `agents list`, `agents discover`, `matrix`
- avoid unsafe writes
- require `--apply --confirm` for sync
- avoid printing secret values
- guide users through first-run setup

**Skill trigger examples:**

- “scan my MCP skills center”
- “manage my local agent skills”
- “audit local MCP servers”
- “discover Qoder and Trae configs”
- “generate agent capability matrix”

**TDD / validation steps:**

1. Create concise `SKILL.md` with only essential workflow.
2. Add reference docs for detailed commands and safety.
3. Add minimal script only if it prevents repeated brittle shell logic.
4. Validate skill structure manually or with packaging tool if available.
5. Commit and push.

**Acceptance:** Another user can install the skill, point it at the repo, and safely run read-only operations without understanding the codebase.

---

## Phase 9: Public Onboarding UX

**Priority:** P2

**Goal:** Make first-time use clear for other machines and other users.

**Files:**

- Create: `docs/quickstart.md`
- Create: `docs/agent-registry.md`
- Create: `docs/supported-agents.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Onboarding flow:**

```bash
git clone https://github.com/quzhiii/mcpskills-center.git
cd mcpskills-center
npm install
npm test
node dist/index.js agents discover
node dist/index.js agents list
npm run scan
node dist/index.js matrix
```

**Acceptance:** A new user can understand safe first-run behavior and add a custom agent registry entry without reading source code.

---

## Phase 10: Future Write Support for New Agents

**Priority:** P3

**Goal:** Only after read-only support is stable, evaluate safe sync/apply for non-initial agents.

**Rules:**

- New agents default to `readOnly: true`.
- Write support requires documented backup and restore semantics.
- Write support requires test fixtures.
- Write support requires approved roots.
- Unknown or DB-backed config formats remain report-only until proven safe.

**Acceptance:** No new agent receives write support until its restore path is tested.

---

## Priority Order for Immediate Work

Start with these tasks only:

1. Phase 0: commit and push this plan.
2. Phase 1: add `config/agents.json` and registry loader.
3. Phase 2: add `agents list`.
4. Phase 3: add `agents discover` report foundation.
5. Phase 4: refactor scanner dispatch into plugin registry.

Do not implement sync/apply for Qoder, Qoder Work, CodeBuddy, WorkBuddy, or Trae in this first pass.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Unknown agent config formats | Discover/report first; no writes |
| Local secrets in config | Never print values; report key names only |
| Breaking current Claude/OpenCode/Codex behavior | Preserve existing tests and add regression tests |
| Worktree or branch confusion | Use `.worktrees/multi-agent-registry` and push after milestones |
| Overbuilding plugin architecture | Keep v1 scanner registry minimal: map scanner type to factory |
| Companion skill duplicating CLI logic | Skill acts as operator guide only; CLI remains source of truth |

---

## Definition of Done for This Roadmap Slice

This first roadmap slice is complete when:

- `config/agents.json` drives the initial three agents.
- `agents list` shows registry state.
- `agents discover` reports candidate local agents including Qoder/Qoder Work/CodeBuddy/WorkBuddy/Trae.
- Scanner dispatch is plugin-based.
- Current scan/audit/sync/profile/health behavior still passes tests.
- README and Chinese README mention registry/discovery accurately.
- Feature branch is pushed.
- A clear follow-up exists for dedicated Qoder/Trae/CodeBuddy scanner research.
