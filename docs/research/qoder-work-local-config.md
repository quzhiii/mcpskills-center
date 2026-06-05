# Qoder Work Local Config Research

## Status

- Dedicated scanner partially researched but deferred in this Phase 7 batch.
- Registry path should point at the observed local root.
- Current scanner state remains generic/read-only.

## Observed Local Roots On This Machine

- Home root: `~/.qoderworkcn`
- Roaming app root: `%APPDATA%/QoderWork CN`

## Files And Directories Observed

- `~/.qoderworkcn/.qoder.json`
- `~/.qoderworkcn/.config.json`
- `~/.qoderworkcn/skills/`
- `~/.qoderworkcn/cache/mcp/market.json`
- `%APPDATA%/QoderWork CN/.builtin-defaults-state-v3.json`
- `%APPDATA%/QoderWork CN/versions.json`
- `%APPDATA%/QoderWork CN/data/agents.db`
- `~/.qoderworkcn/logs/`
- `~/.qoderworkcn/projects/`
- `~/.qoderworkcn/workspace/`
- `~/.qoderworkcn/todos/`

## What Is Clear

- Skill root is clear enough for generic read-only scanning:
  - `~/.qoderworkcn/skills/<skill-id>/SKILL.md`
- `.qoder.json` exists and is parseable JSON.
- `.qoder.json` is a good discovery confirm file for the local root.
- `%APPDATA%/QoderWork CN/.builtin-defaults-state-v3.json` is a good discovery confirm file for the roaming app root.
- `%APPDATA%/QoderWork CN/versions.json` is also accepted as a fallback confirm file for that roaming root.

Observed `.qoder.json` content is app/CLI preference state such as theme, onboarding flags, and token limits. It does not currently prove ownership of MCP server definitions.

Observed `.config.json` content is region/network bootstrap state, not MCP server state.

Observed `%APPDATA%/QoderWork CN/.builtin-defaults-state-v3.json` contains app builtin-state data such as:

- `enabledBuiltinMcpServers`

On this machine it currently contains an empty list, which is useful for discovery but still not enough to prove the source of truth for user-enabled third-party MCP runtime config.

## SQLite Inspection

`%APPDATA%/QoderWork CN/data/agents.db` is a valid SQLite database.

Observed tables include:

- `app_settings`
- `mcp_oauth_tokens`
- `channel_pairings`
- `channel_pairings_v2`
- `projects`
- `scheduled_tasks`
- `task_run_logs`

Most relevant findings:

- `mcp_oauth_tokens`
  - Columns include `server_name`, `expires_at`, `encrypted_payload`, `encryption_version`, `created_at`, `updated_at`
  - This looks like persisted OAuth credential storage for MCP servers
  - On this machine, the table is currently empty
- `app_settings`
  - Uses generic key/value storage
  - Observed values mostly look like channel and marketplace settings, not active MCP runtime state

Current conclusion from the DB inspection on this machine:

- The schema suggests Qoder Work may persist MCP-related OAuth metadata here
- But on this machine it does not provide a trustworthy source of truth for currently enabled MCP connectors or active MCP server instances
- It may be useful later as a secondary evidence source, not as scanner v1's primary input

Observed `cache/mcp/market.json` contains a catalog of available MCP connectors and suggested server configs, for example:

- `serverName`
- `config.type`
- `config.url`
- `authType`

This looks like marketplace/catalog metadata rather than a proven record of which MCP connectors are currently enabled on this machine.

## Why Dedicated MCP Parsing Is Deferred

- No stable `mcpServers` structure was confirmed in `.qoder.json`.
- The confirmed MCP-shaped file under the home root is `cache/mcp/market.json`, but it currently looks like connector market cache rather than active local runtime config.
- `agents.db` contains MCP-adjacent schema, but not a populated or reliable enabled-state record on this machine.
- Skills are clear, but MCP source of truth is still not proven.

## Current Decision

- Keep `qoder-work` as generic/read-only for now.
- Update registry paths to the observed `~/.qoderworkcn` root.
- Update discovery confirmation to accept `.qoder.json` as a product-specific confirm file under `~/.qoderworkcn`, while still keeping legacy `~/.qoder-work` discovery through generic confirm files such as `config.json` and `settings.json`.
- Update discovery confirmation to accept `%APPDATA%/QoderWork CN/.builtin-defaults-state-v3.json` for the roaming app root.
- If multiple independently confirmed roots include either `~/.qoderworkcn` or legacy `~/.qoder-work`, discovery should report an ambiguous candidate and require manual review instead of guessing the active root. On the current implementation this also covers mixed confirmations such as home-root plus `%APPDATA%/QoderWork CN`.
- Do not add dedicated MCP parsing until a real MCP fixture exists.

## Follow-up Checklist

- Search for first-party MCP config outside `.qoder.json`.
- Confirm whether project/workspace JSON files embed active MCP selections, not just task/workspace state.
- Confirm whether `cache/mcp/market.json` ever reflects user-enabled state or remains a pure marketplace catalog.
- Re-check whether `mcp_oauth_tokens` or `app_settings` become populated after enabling a real Qoder Work connector on this machine.
- Collect a redacted real fixture before implementing a dedicated scanner.
