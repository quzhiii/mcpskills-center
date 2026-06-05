# Supported Agents

This document summarizes the current support level for each local agent known to MCPskills Center.

The project uses a staged support model:

- `Discovery only`: can detect likely install roots, but scanner confidence is still low.
- `Generic read-only`: can scan a known skills directory using the fallback generic scanner.
- `Dedicated read-only`: has a product-specific scanner for known config formats.
- `Write-capable`: eligible for future sync/apply operations after backup and restore semantics are proven.

Current release policy:

- Only `claude-code`, `opencode`, and `codex` are write-capable in the registry.
- All newer agents remain `enabled: false` and `readOnly: true` by default.
- Unknown or weakly proven MCP sources stay read-only and report-first.

## Summary Matrix

| Agent | Registry Scanner | Discovery Confidence | Skill Support | MCP Support | Current Level | Source-of-Truth Confidence | Write Support |
|---|---|---|---|---|---|---|---|
| `claude-code` | `claude-code` | High | Dedicated | Dedicated | Dedicated read-only plus write-ready workflow support | High | Yes |
| `opencode` | `opencode` | High | Dedicated | Dedicated | Dedicated read-only plus write-ready workflow support | High | Yes |
| `codex` | `codex` | High | Dedicated | Dedicated | Dedicated read-only plus write-ready workflow support | High | Yes |
| `codebuddy` | `codebuddy` | High | Dedicated | Dedicated | Dedicated read-only | Medium: home-root `mcp.json` is clear on this machine | No |
| `workbuddy` | `workbuddy` | High | Dedicated | Dedicated | Dedicated read-only | Medium: home-root `.mcp.json` is clear on this machine | No |
| `trae` | `trae` | High | Dedicated | Dedicated | Dedicated read-only | Low: only compatibility-style `cline_mcp_settings.json` sources were confirmed, both empty on this machine | No |
| `qoder` | `generic` | Medium | Placeholder path configured, not yet validated | Not proven | Generic read-only placeholder | Low: app/root state found, but no reliable active MCP source of truth | No |
| `qoder-work` | `generic` | Medium to High | Generic | Not proven | Generic read-only placeholder | Low: several MCP-adjacent files exist, but no trustworthy active MCP source of truth yet | No |

## Agent Notes

### Claude Code

- Registry scanner: `claude-code`
- Skills root: `~/.claude/skills`
- MCP config: `~/.claude.json`
- Notes:
  - Current project-native baseline.
  - Supports project-scoped and global MCP parsing.
  - Included in sync/apply/restore workflows.

### OpenCode

- Registry scanner: `opencode`
- Skills root: `~/.opencode/skills`
- MCP config: `~/.opencode/opencode.json`
- Notes:
  - Supports JSON MCP config parsing, including array-form commands.
  - Included in sync/apply/restore workflows.

### Codex

- Registry scanner: `codex`
- Skills root: `~/.codex/skills`
- MCP config: `~/.codex/config.toml`
- Notes:
  - Supports TOML MCP parsing.
  - Included in sync/apply/restore workflows.

### CodeBuddy

- Registry scanner: `codebuddy`
- Skills root: `~/.codebuddy/skills-marketplace/skills`
- MCP config: `~/.codebuddy/mcp.json`
- Current level: Dedicated read-only
- Notes:
  - Home-root MCP config is clear enough for read-only scanning.
  - Extension-host and connector-marketplace state exists, but is not the current primary scanner input.

### WorkBuddy

- Registry scanner: `workbuddy`
- Skills root: `~/.workbuddy/skills`
- MCP config: `~/.workbuddy/.mcp.json`
- Current level: Dedicated read-only
- Notes:
  - Home-root `.mcp.json` is a stronger signal than broader app settings.
  - Other runtime/channel state remains intentionally out of scope.

### Trae

- Registry scanner: `trae`
- Skills root: `~/.trae/skills`
- Current MCP candidate path: `%APPDATA%/Trae/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- Current level: Dedicated read-only
- Notes:
  - Discovery confidence is high after adding both `%APPDATA%/Trae` and `%LOCALAPPDATA%/Trae` nested `User/settings.json` confirmation rules.
  - The currently verified MCP-shaped files are compatibility-style `cline_mcp_settings.json` stores and are empty on this machine.
  - No stronger first-party MCP registry has been confirmed yet.

### Qoder

- Registry scanner: `generic`
- Discovery roots currently treated as relevant:
  - `~/.qoder`
  - `%APPDATA%/Qoder`
- Current level: Generic read-only placeholder
- Notes:
  - `%APPDATA%/Qoder` appears to be the real app root on this machine.
  - The registry still points skills at `~/.qoder/skills`, but that path is not yet validated as a stable real skill source on this machine.
  - Several MCP-shaped files exist under `%APPDATA%/Qoder`, but they are empty or look like cache/compatibility state.
  - Dedicated MCP parsing remains deferred.

### Qoder Work

- Registry scanner: `generic`
- Discovery roots currently treated as relevant:
  - `~/.qoderworkcn`
  - `~/.qoder-work`
  - `%APPDATA%/QoderWork CN`
- Current level: Generic read-only placeholder
- Notes:
  - Skills root is clear enough for generic read-only scanning.
  - `cache/mcp/market.json` looks like connector catalog metadata, not active enablement state.
  - `%APPDATA%/QoderWork CN/data/agents.db` contains MCP-adjacent schema but did not prove active MCP enablement on this machine.
  - Dedicated MCP parsing remains deferred.

## Confidence Guide

Use the source-of-truth confidence column this way:

- `High`: the project has a stable, directly parsed MCP config or skill root already exercised by tests.
- `Medium`: a plausible first-party local config exists and is used by the scanner, but alternate product-managed state also exists.
- `Low`: the project can discover the app root, but current MCP evidence is empty, compatibility-shaped, cache-shaped, or otherwise not sufficient to trust as the active config source.

## What To Do Next

- For `codebuddy`, `workbuddy`, and `trae`:
  - Keep refining read-only confidence before considering any write support.
- For `qoder` and `qoder-work`:
  - Continue research until a real active MCP source of truth is confirmed.
  - Do not add dedicated MCP parsers based only on catalogs, caches, or empty compatibility files.
- For all non-baseline agents:
  - Keep `enabled: false` and `readOnly: true` until recovery semantics are tested.
