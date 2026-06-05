# Qoder Local Config Research

## Status

- Dedicated scanner deferred in this Phase 7 batch.
- Current registry state should remain generic/read-only.

## Observed Local Roots On This Machine

- Home root with logs only: `~/.qoder`
- VS Code-style user config root: `%APPDATA%/Qoder/User`

## Files Observed

- `~/.qoder/logs/qodercli.log`
- `%APPDATA%/Qoder/User/settings.json`
- `%APPDATA%/Qoder/User/globalStorage/storage.json`
- `%APPDATA%/Qoder/User/globalStorage/state.vscdb`
- `%APPDATA%/Qoder/User/globalStorage/shengsuan-cloud.cline-shengsuan/settings/cline_mcp_settings.json`

## Why Scanner Work Is Deferred

- No stable skill root was confirmed under `~/.qoder` on this machine.
- No clearly first-party MCP config file was confirmed in the home root.
- The visible MCP-shaped file currently lives in a compatibility/globalStorage path and may reflect extension state rather than Qoder's own source of truth.

## Current Decision

- Keep `qoder` as generic/read-only placeholder for now.
- Do not add a dedicated MCP parser until a first-party config source is confirmed.

## Follow-up Checklist

- Confirm whether Qoder stores first-party skills outside `%APPDATA%/Qoder/User`.
- Confirm whether any home-root JSON/TOML file owns MCP server definitions.
- Collect a redacted real fixture before implementing a parser.
