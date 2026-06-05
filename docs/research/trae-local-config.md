# Trae Local Config Research

## Status

- Dedicated read-only scanner implemented in this Phase 7 batch.
- Scanner type: `trae`
- Default registry state remains `enabled: false`, `readOnly: true`.

## Observed Local Roots On This Machine

- Home root: `~/.trae`
- Skills root: `~/.trae/skills`
- App argv/config stub: `~/.trae/argv.json`
- VS Code-style user config root: `%APPDATA%/Trae/User`
- MCP candidate used for scanner v1: `%APPDATA%/Trae/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

## Relevant Files

### Skills

- `~/.trae/skills/<skill-id>/SKILL.md`

Observed structure is a direct directory-per-skill layout.

### MCP

- `%APPDATA%/Trae/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

Observed example:

```json
{
  "mcpServers": {}
}
```

Fixture used for scanner tests:

```json
{
  "mcpServers": {
    "reader": {
      "url": "https://example.com/sse"
    }
  }
}
```

## Related But Deferred Inputs

- `%APPDATA%/Trae/User/settings.json`
- `%APPDATA%/Trae/User/globalStorage/state.vscdb`
- `%APPDATA%/Trae/User/workspaceStorage/*`
- `~/.trae/extensions/`

These are useful for future product understanding but not needed for the initial dedicated read-only scanner.

## Scanner Decision

- Reuse generic skill-directory scanning rules against `~/.trae/skills`.
- Read-only parse of `cline_mcp_settings.json` when configured.
- Keep transport detection identical to current JSON MCP scanners.

## Out Of Scope

- Extension catalog parsing
- Workspace DB/state inspection
- Write support or config mutation

## Follow-up

- If Trae later exposes a first-party MCP registry outside the Cline compatibility path, add fixtures and switch to that source only after verifying backward-compat behavior.
