# MCP Write Model Specification

## Overview

This document specifies the MCP write model for MCPskills Center. It defines how MCP governance dry-run plans translate into safe, auditable config writes.

## Scope

This is a **design specification**. The types and interfaces described here are encoded in `src/types/index.ts` and `src/mcp/`. The runtime implementation (apply, restore, CLI commands) is deferred to `mcp-write-apply-v1`.

## Write Action Types

| Action Type | Meaning |
|---|---|
| `add-server` | Add a new MCP server definition to a target agent config |
| `update-server` | Update an existing MCP server definition in a target agent config |
| `remove-server` | Remove an MCP server definition from a target agent config |
| `enable-server` | Set an existing MCP server to enabled |
| `disable-server` | Set an existing MCP server to disabled |

## Governance-to-Apply Bridge

Only `canonical-candidate` governance actions with a `canonicalAgentName` produce apply actions. `skip` and `manual-review` actions are excluded.

The bridge function `buildMcpApplyPlan()` converts governance actions into apply actions, validating per-agent write boundaries.

## Safety Model

### Confirm Flag

`McpApplyPlan.confirm` must be `true` before any writes happen. The CLI enforces this via `--confirm`.

### Approved Roots

`McpApplyPlan.approvedRoots` lists the only config file paths that may be written. Every apply action's `targetConfigPath` must resolve within one of these roots.

### Per-Agent Write Boundary

Only agents with `mcpApplySupport: 'write-ready'` in their support metadata are eligible for MCP writes. Currently: `claude-code`, `opencode`, `codex`.

### Backup and Restore

Before any write, the existing config file is backed up. A `McpBackupManifest` records all backup entries for the apply run. Restore copies backed-up content back to the original paths.

## Adapter Write Interface

`McpConfigAdapter.serialize(servers)` converts parsed servers back to the agent's native config format. Stubs throw until per-adapter serialization is implemented.

## Type Inventory

| Type | File | Purpose |
|---|---|---|
| `McpApplyActionType` | `src/types/index.ts` | Union of write action kinds |
| `McpApplyAction` | `src/types/index.ts` | Single write action with `requiresWrite: true` |
| `McpApplyPlan` | `src/types/index.ts` | Plan containing actions, confirm flag, approved roots |
| `McpApplyReceipt` | `src/types/index.ts` | Receipt for a single applied action |
| `McpApplyResult` | `src/types/index.ts` | Result of applying a plan |
| `McpBackupEntry` | `src/types/index.ts` | Single backup entry |
| `McpBackupManifest` | `src/types/index.ts` | Collection of backup entries |
| `McpConfigAdapter.serialize` | `src/mcp/adapters/base.ts` | Adapter write-back interface |
| `assertMcpApplyConfirm` | `src/mcp/safety.ts` | Confirm flag validation |
| `assertMcpApplyPathsWithinApprovedRoots` | `src/mcp/safety.ts` | Path safety validation |
| `assertMcpWriteBoundaryAllowed` | `src/mcp/safety.ts` | Per-agent write eligibility check |
| `buildMcpApplyPlan` | `src/mcp/apply-plan.ts` | Governance-to-apply bridge |

## Future Work

- `mcp-write-apply-v1`: Runtime implementation of apply/restore
- Per-adapter `serialize()` implementations (claude-code JSON, opencode JSON, codex TOML)
- `mcp apply` and `mcp restore` CLI commands
- MCP write receipts in governance reports
- MCP backup manifest generation and restore logic
