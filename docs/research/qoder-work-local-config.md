# Qoder Work Local Config Research

## Status

- Dedicated scanner partially researched but deferred in this Phase 7 batch.
- Registry path should point at the observed local root.
- Current scanner state remains generic/read-only.

## Observed Local Roots On This Machine

- Home root: `~/.qoderworkcn`

## Files And Directories Observed

- `~/.qoderworkcn/.qoder.json`
- `~/.qoderworkcn/skills/`
- `~/.qoderworkcn/logs/`
- `~/.qoderworkcn/projects/`
- `~/.qoderworkcn/workspace/`
- `~/.qoderworkcn/todos/`

## What Is Clear

- Skill root is clear enough for generic read-only scanning:
  - `~/.qoderworkcn/skills/<skill-id>/SKILL.md`
- `.qoder.json` exists and is parseable JSON.

Observed `.qoder.json` content is app/CLI preference state such as theme, onboarding flags, and token limits. It does not currently prove ownership of MCP server definitions.

## Why Dedicated MCP Parsing Is Deferred

- No stable `mcpServers` structure was confirmed in `.qoder.json`.
- No second obvious MCP config file was confirmed under the home root.
- Skills are clear, but MCP source of truth is still not proven.

## Current Decision

- Keep `qoder-work` as generic/read-only for now.
- Update registry paths to the observed `~/.qoderworkcn` root.
- Do not add dedicated MCP parsing until a real MCP fixture exists.

## Follow-up Checklist

- Search for first-party MCP config outside `.qoder.json`.
- Confirm whether project/workspace JSON files embed MCP definitions.
- Collect a redacted real fixture before implementing a dedicated scanner.
