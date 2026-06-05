# WorkBuddy Local Config Research

## Status

- Dedicated read-only scanner implemented in this Phase 7 batch.
- Scanner type: `workbuddy`
- Default registry state remains `enabled: false`, `readOnly: true`.

## Observed Local Roots On This Machine

- Home root: `~/.workbuddy`
- Skills root: `~/.workbuddy/skills`
- MCP config: `~/.workbuddy/.mcp.json`
- Additional VS Code-style state: `%APPDATA%/WorkBuddy/User`

## Relevant Files

### Skills

- `~/.workbuddy/skills/<skill-id>/SKILL.md`

Observed structure is a direct directory-per-skill layout and works with existing generic skill validation.

### MCP

- `~/.workbuddy/.mcp.json`

Observed example:

```json
{
  "mcpServers": {
    "connector-proxy": {
      "type": "http",
      "url": "http://127.0.0.1:10709/mcp",
      "description": "Aggregated proxy containing MCP servers: github, ima-mcp"
    }
  }
}
```

## Sensitive Or Unrelated Files Seen But Deferred

- `~/.workbuddy/settings.json`
- `~/.workbuddy/user-state.json`
- `%APPDATA%/WorkBuddy/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

`settings.json` contains channel/application state and sensitive values, so it should not be used as a discovery source for scanner v1. The home-root `.mcp.json` is the cleaner read-only input.

## Scanner Decision

- Reuse generic skill-directory scanning rules against `~/.workbuddy/skills`.
- Parse `~/.workbuddy/.mcp.json` read-only.
- Treat `url` entries as HTTP or SSE using existing URL-shape rules.
- Never print secret values from unrelated config files.

## Out Of Scope

- WeChat or Claw channel state
- Workspace/session DBs
- Plugin marketplace state
- Any write/apply support

## Follow-up

- If WorkBuddy later moves MCP source of truth into `%APPDATA%/WorkBuddy/User/globalStorage/...`, document precedence and fixture coverage before changing scanner input order.
