# Qoder Work Local Config Research

## Status

- Dedicated scanner partially researched but deferred in this Phase 7 batch.
- Registry path should point at the observed local root.
- Current scanner state remains generic/read-only.

## Observed Local Roots On This Machine

- Home root: `~/.qoderworkcn`

## Files And Directories Observed

- `~/.qoderworkcn/.qoder.json`
- `~/.qoderworkcn/.config.json`
- `~/.qoderworkcn/skills/`
- `~/.qoderworkcn/cache/mcp/market.json`
- `~/.qoderworkcn/logs/`
- `~/.qoderworkcn/projects/`
- `~/.qoderworkcn/workspace/`
- `~/.qoderworkcn/todos/`

## What Is Clear

- Skill root is clear enough for generic read-only scanning:
  - `~/.qoderworkcn/skills/<skill-id>/SKILL.md`
- `.qoder.json` exists and is parseable JSON.
- `.qoder.json` is a good discovery confirm file for the local root.

Observed `.qoder.json` content is app/CLI preference state such as theme, onboarding flags, and token limits. It does not currently prove ownership of MCP server definitions.

Observed `.config.json` content is region/network bootstrap state, not MCP server state.

Observed `cache/mcp/market.json` contains a catalog of available MCP connectors and suggested server configs, for example:

- `serverName`
- `config.type`
- `config.url`
- `authType`

This looks like marketplace/catalog metadata rather than a proven record of which MCP connectors are currently enabled on this machine.

## Why Dedicated MCP Parsing Is Deferred

- No stable `mcpServers` structure was confirmed in `.qoder.json`.
- The confirmed MCP-shaped file under the home root is `cache/mcp/market.json`, but it currently looks like connector market cache rather than active local runtime config.
- Skills are clear, but MCP source of truth is still not proven.

## Current Decision

- Keep `qoder-work` as generic/read-only for now.
- Update registry paths to the observed `~/.qoderworkcn` root.
- Update discovery confirmation to accept `.qoder.json` only under `~/.qoderworkcn`.
- If both `~/.qoderworkcn` and legacy `~/.qoder-work` are independently confirmed, discovery should report an ambiguous candidate and require manual review instead of guessing the active root.
- Do not add dedicated MCP parsing until a real MCP fixture exists.

## Follow-up Checklist

- Search for first-party MCP config outside `.qoder.json`.
- Confirm whether project/workspace JSON files embed active MCP selections, not just task/workspace state.
- Confirm whether `cache/mcp/market.json` ever reflects user-enabled state or remains a pure marketplace catalog.
- Collect a redacted real fixture before implementing a dedicated scanner.
