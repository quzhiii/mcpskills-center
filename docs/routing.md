# Routing Guide

MCPskills Center includes a task routing system that recommends which agent should handle a given task based on keyword matching and capability analysis.

---

## What Is Agent Routing?

Agent routing takes a natural-language task description and recommends the best agent to handle it. It uses:

1. **Task categories** defined in `config/routing-policy.json`
2. **Keyword matching** against the task description
3. **Eligible agents** per category
4. **Fallback ordering** when no category matches

---

## How Task Matching Works

The routing process:

1. Load `config/routing-policy.json`
2. Lowercase the task description
3. Check each category's `keywords` array for a substring match
4. Return the first matching category's `preferredAgent`
5. If no match, use the `fallbackOrder` array

```text
Task: "fix this bug in the auth module"
  → keywords include "fix", "bug"
  → matches category "coding"
  → preferredAgent: "claude-code"
```

```text
Task: "research the best testing framework"
  → keywords include "research"
  → matches category "research"
  → preferredAgent: "claude-code"
```

```text
Task: "do something completely unrelated"
  → no keyword match
  → fallback to first agent in fallbackOrder: "claude-code"
```

---

## Routing Policy Schema

The policy file is at `config/routing-policy.json`:

```json
{
  "version": "1",
  "taskCategories": [
    {
      "id": "coding",
      "keywords": ["code", "implement", "fix", "bug", "test", "debug", "refactor", "build", "write", "create", "add", "modify"],
      "requiredCapabilities": [],
      "eligibleAgents": ["claude-code", "opencode", "codex"],
      "preferredAgent": "claude-code"
    }
  ],
  "fallbackOrder": ["claude-code", "opencode", "codex"]
}
```

### Fields

| Field | Type | Description |
|---|---|---|
| `version` | `string` | Policy schema version |
| `taskCategories` | `array` | List of task category definitions |
| `fallbackOrder` | `string[]` | Agent priority when no category matches |

### TaskCategory fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique category identifier |
| `keywords` | `string[]` | Substrings to match against the task description (case-insensitive) |
| `requiredCapabilities` | `string[]` | Capabilities an agent must have (reserved for future use) |
| `eligibleAgents` | `string[]` | Agents that can handle this category |
| `preferredAgent` | `string` | The recommended agent for this category |

---

## Default Categories

| Category | Keywords | Preferred Agent | Eligible Agents |
|---|---|---|---|
| `coding` | code, implement, fix, bug, test, debug, refactor, build, write, create, add, modify | `claude-code` | `claude-code`, `opencode`, `codex` |
| `research` | research, investigate, search, analyze, compare, review, study | `claude-code` | `claude-code`, `opencode` |
| `mcp-heavy` | mcp, server, file, browser, web, database, api | `claude-code` | `claude-code` |
| `docs` | document, readme, docs, comment, explain | `claude-code` | `claude-code`, `opencode`, `codex` |

---

## Customizing Routing Policy

Edit `config/routing-policy.json` to add or modify categories.

### Adding a new category

```json
{
  "id": "devops",
  "keywords": ["deploy", "ci", "cd", "docker", "kubernetes", "pipeline"],
  "requiredCapabilities": [],
  "eligibleAgents": ["claude-code", "opencode"],
  "preferredAgent": "claude-code"
}
```

### Changing the fallback order

```json
{
  "fallbackOrder": ["opencode", "claude-code", "codex"]
}
```

This makes `opencode` the default when no category matches.

### Validation

The policy is validated on load. Required fields:

- `version`
- `taskCategories` (must be an array)
- `fallbackOrder` (must be an array)

Invalid policies throw an error before routing begins.

---

## Eligible Agents

An agent is eligible for a task if:

1. The task matches a category
2. The agent is listed in that category's `eligibleAgents`
3. The agent is registered and enabled in `config/agents.json`

The `requiredCapabilities` field is reserved for future use when capability-based filtering is implemented.

---

## Fallback Behavior

When no category keywords match the task description:

1. The router uses `fallbackOrder` from the policy
2. The first agent in the list is recommended
3. All agents in the list are shown as alternatives

**Default fallback order:** `claude-code` → `opencode` → `codex`

---

## Viewing Routing Results

```bash
mcpskills route "fix this bug"
```

Output:

```
Route Recommendation:
   Task: fix this bug
   Category: coding
   Recommended: claude-code
   Alternatives: opencode, codex
   Reasoning: Task matches 'coding' category; claude-code is the preferred agent.
```

### Fields explained

| Field | Description |
|---|---|
| `Task` | The original task description |
| `Category` | Matched category ID, or "none" if fallback was used |
| `Recommended` | The recommended agent |
| `Alternatives` | Other eligible agents for the same category |
| `Reasoning` | Human-readable explanation of the routing decision |

---

## Routing Audit Log

When a database is configured, routing decisions are logged for analysis. Each entry records:

- Task description
- Matched category
- Recommended agent
- Timestamp

This enables reviewing routing patterns over time and tuning the policy accordingly.

---

## Limitations

- Routing is keyword-based, not semantic. It matches substrings, not meaning.
- First matching category wins. Overlapping keywords may cause unexpected matches.
- `requiredCapabilities` filtering is not yet implemented.
- Routing does not consider agent health or current load.
