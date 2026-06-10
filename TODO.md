# TODO

## Current Focus

- Current milestone: `mcp-scope-governance-v1`
- Goal: preserve MCP scope metadata through inventory and make MCP dry-run governance scope-aware before any MCP write workflow exists
- Status: planned, not started

## Next Execution Queue

1. Preserve adapter scope in scanner/inventory MCP definitions.
2. Add scope-aware MCP planner classification.
3. Surface scope evidence in MCP governance reports and inventory outputs.
4. Improve `mcp plan` CLI summary for scope-related manual review.
5. Run full verification and prepare review branch.

## After This Milestone

1. Revisit whether baseline MCP governance is ready for write-model design.
2. If not, keep MCP report-first and improve governance explainability again before any apply/restore work.
3. Keep Web, SQLite, and routing deferred until governance semantics are stable.

## Cleanup Notes

- Git cleanup is complete for merged historical worktrees and branches.
- One empty residual directory may still remain under `.worktrees/multi-agent-registry` if Windows or BaiduNetdisk keeps it locked; this is not a Git state problem.
