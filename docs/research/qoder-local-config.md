# Qoder Local Config Research

## Status

- Dedicated scanner deferred in this Phase 7 batch.
- Current registry state should remain generic/read-only.

## Observed Local Roots On This Machine

- Home root with logs only: `~/.qoder`
- VS Code-style app root: `%APPDATA%/Qoder`
- VS Code-style user config root under that app root: `%APPDATA%/Qoder/User`

## Files Observed

- `~/.qoder/logs/qodercli.log`
- `%APPDATA%/Qoder/User/app.json`
- `%APPDATA%/Qoder/User/settings.json`
- `%APPDATA%/Qoder/User/globalStorage/storage.json`
- `%APPDATA%/Qoder/User/globalStorage/state.vscdb`
- `%APPDATA%/Qoder/User/globalStorage/shengsuan-cloud.cline-shengsuan/settings/cline_mcp_settings.json`
- `%APPDATA%/Qoder/SharedClientCache/mcp.json`
- `%APPDATA%/Qoder/SharedClientCache/extension/local/mcp.json`
- `%APPDATA%/Qoder/SharedClientCache/cache/app-config.json`

## What Is Clear

- `~/.qoder` is not a reliable install/config root on this machine; it currently only exposes logs.
- `%APPDATA%/Qoder` is the real app root for local discovery on this machine.
- `%APPDATA%/Qoder/User/settings.json` is a valid discovery confirm file.
- `%APPDATA%/Qoder/User/app.json` is also present and can be used as a fallback confirm file for the same app root.

Observed `User/app.json` and `SharedClientCache/cache/app-config.json` contain general app/tool settings such as:

- `autoRunMcpTools`
- `mcpAutoRun`
- terminal/web-tools behavior

These indicate MCP-related feature flags but do not prove which MCP servers are currently configured or enabled.

Observed MCP-shaped files:

- `%APPDATA%/Qoder/SharedClientCache/mcp.json`
- `%APPDATA%/Qoder/SharedClientCache/extension/local/mcp.json`
- `%APPDATA%/Qoder/User/globalStorage/shengsuan-cloud.cline-shengsuan/settings/cline_mcp_settings.json`

On this machine, all of them currently contain empty `mcpServers` objects.

## Why Scanner Work Is Deferred

- No stable skill root was confirmed under `~/.qoder` on this machine.
- No clearly first-party MCP config file was confirmed in the home root.
- The MCP-shaped files found under `%APPDATA%/Qoder` are currently empty or look like compatibility/cache state rather than a proven source of truth for enabled MCP servers.

## Current Decision

- Keep `qoder` as generic/read-only placeholder for now.
- Update discovery confirmation to treat `%APPDATA%/Qoder/User/settings.json` and `%APPDATA%/Qoder/User/app.json` as valid confirm files for the app root.
- Do not add a dedicated MCP parser until a first-party config source is confirmed.

## Follow-up Checklist

- Confirm whether Qoder stores first-party skills outside `%APPDATA%/Qoder/User` or `%APPDATA%/Qoder/SharedClientCache`.
- Re-check whether `SharedClientCache/mcp.json`, `SharedClientCache/extension/local/mcp.json`, or `cline_mcp_settings.json` become populated after enabling a real Qoder MCP connector on this machine.
- Collect a redacted real fixture before implementing a parser.
