# CodeBuddy Local Config Research

## Status

- Dedicated read-only scanner implemented in this Phase 7 batch.
- Scanner type: `codebuddy`
- Default registry state remains `enabled: false`, `readOnly: true`.

## Observed Local Roots On This Machine

- Home root: `~/.codebuddy`
- Marketplace skills root: `~/.codebuddy/skills-marketplace/skills`
- MCP config: `~/.codebuddy/mcp.json`
- Additional IDE-side state: `%LOCALAPPDATA%/CodeBuddyExtension/Data`
- Additional VS Code-style state: `%APPDATA%/CodeBuddy/User`

## Relevant Files

### Skills

- `~/.codebuddy/skills-marketplace/skills/<skill-id>/SKILL.md`

Observed shape matches directory-per-skill layout and is compatible with generic `SKILL.md` validation.

### MCP

- `~/.codebuddy/mcp.json`

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
    "github": {
      "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "<redacted>"
      }
    }
  }
}
```

## Non-Scanner Inputs Seen But Deferred

- `%LOCALAPPDATA%/CodeBuddyExtension/Data/default/CodeBuddyIDE/connectors/connector-servers.json`
- `%APPDATA%/CodeBuddy/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- `%APPDATA%/CodeBuddy/User/settings.json`

These look like connector catalog, IDE extension state, or extension-host compatibility files rather than the primary local MCP registry used by the home-root CLI/runtime.

## Scanner Decision

- Reuse generic skill-directory scanning rules against `~/.codebuddy/skills-marketplace/skills`.
- Parse `~/.codebuddy/mcp.json` read-only.
- Support `mcpServers` entries with:
  - string command
  - array-form command
  - URL-based server entries
  - sensitive env key detection without printing values

## Out Of Scope

- Connector OAuth files
- Connector runtime health or auth status
- Plugin marketplace metadata beyond skill directory presence
- Any write/apply support

## Follow-up

- If CodeBuddy later standardizes on extension-host MCP state instead of `~/.codebuddy/mcp.json`, add a second documented source and precedence rule before changing scanner behavior.
