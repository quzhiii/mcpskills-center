# 支持的 Agents

本文汇总 MCPskills Center 当前已知本地 agents 的支持状态。

项目当前采用分层支持模型：

- `仅发现（Discovery only）`：可以发现疑似安装根，但 scanner 可信度仍然较低。
- `通用只读（Generic read-only）`：可以通过 fallback generic scanner 扫描已知 skills 目录。
- `专用只读（Dedicated read-only）`：已经有产品专属 scanner，可解析已知本地格式。
- `可写（Write-capable）`：在备份与恢复语义被验证后，未来可进入 sync/apply 写入支持。

当前版本策略：

- 只有 `claude-code`、`opencode`、`codex` 在 registry 中属于 write-capable 线。
- 当前写入支持只表示 skills governance：canonical promotion、per-agent distribution、backup manifest 与 restore。
- MCP governance 已经进入只读主线，但 MCP 配置写入仍要等 scope、source-of-truth、backup 与 rollback 语义被证明后再开放。
- 所有新增 agent 默认仍保持 `enabled: false` 且 `readOnly: true`。
- 对来源不明确或证据不足的 MCP 配置，一律维持 read-only / report-first。
- CLI 继续作为治理内核。未来 Web console 应该包裹 CLI/report 产物，而不是创造另一套写入语义。

## 总览矩阵

| Agent | Registry Scanner | Discovery 可信度 | Skill 支持 | MCP 支持 | 当前级别 | Source-of-Truth 可信度 | 写入支持 |
|---|---|---|---|---|---|---|---|
| `claude-code` | `claude-code` | 高 | 专用 | 专用 | 专用只读 + 已具备 write-ready workflow support | 高 | 是 |
| `opencode` | `opencode` | 高 | 专用 | 专用 | 专用只读 + 已具备 write-ready workflow support | 高 | 是 |
| `codex` | `codex` | 高 | 专用 | 专用 | 专用只读 + 已具备 write-ready workflow support | 高 | 是 |
| `codebuddy` | `codebuddy` | 高 | 专用 | 专用 | 专用只读 | 中：本机上 home-root `mcp.json` 足够清晰 | 否 |
| `workbuddy` | `workbuddy` | 高 | 专用 | 专用 | 专用只读 | 中：本机上 home-root `.mcp.json` 足够清晰 | 否 |
| `trae` | `trae` | 高 | 专用 | 专用 | 专用只读 | 低：当前只确认了 compatibility-style `cline_mcp_settings.json`，且本机均为空 | 否 |
| `qoder` | `generic` | 中 | 已配置占位路径，但尚未验证 | 未证明 | 通用只读占位 | 低：已发现 app/root 状态，但没有可靠的 active MCP source of truth | 否 |
| `qoder-work` | `generic` | 中到高 | 通用 | 未证明 | 通用只读占位 | 低：有多份 MCP 相关文件，但仍没有可信的 active MCP source of truth | 否 |

## Agent 说明

### Claude Code

- Registry scanner: `claude-code`
- Skills 根目录：`~/.claude/skills`
- MCP 配置：`~/.claude.json`
- 说明：
  - 当前项目的基线支持对象。
  - 已支持 project-scoped 与 global MCP 解析。
  - 已纳入 sync/apply/restore 工作流。

### OpenCode

- Registry scanner: `opencode`
- Skills 根目录：`~/.opencode/skills`
- MCP 配置：`~/.opencode/opencode.json`
- 说明：
  - 已支持 JSON MCP 配置解析，包括数组形式命令。
  - 已纳入 sync/apply/restore 工作流。

### Codex

- Registry scanner: `codex`
- Skills 根目录：`~/.codex/skills`
- MCP 配置：`~/.codex/config.toml`
- 说明：
  - 已支持 TOML MCP 配置解析。
  - 已纳入 sync/apply/restore 工作流。

### CodeBuddy

- Registry scanner: `codebuddy`
- Skills 根目录：`~/.codebuddy/skills-marketplace/skills`
- MCP 配置：`~/.codebuddy/mcp.json`
- 当前级别：专用只读
- 说明：
  - home-root MCP 配置已经足够清晰，可以作为只读扫描输入。
  - extension-host 与 connector marketplace 状态仍存在，但当前不是主 scanner 输入。

### WorkBuddy

- Registry scanner: `workbuddy`
- Skills 根目录：`~/.workbuddy/skills`
- MCP 配置：`~/.workbuddy/.mcp.json`
- 当前级别：专用只读
- 说明：
  - home-root `.mcp.json` 比泛化 app settings 更强。
  - 其他 runtime/channel 状态仍明确排除在当前 scanner 范围外。

### Trae

- Registry scanner: `trae`
- Skills 根目录：`~/.trae/skills`
- 当前 MCP 候选路径：`%APPDATA%/Trae/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- 当前级别：专用只读
- 说明：
  - discovery 可信度已经较高，当前同时支持 `%APPDATA%/Trae` 与 `%LOCALAPPDATA%/Trae` 的嵌套 `User/settings.json` 确认规则。
  - 当前已验证的 MCP 形态仍是 compatibility-style `cline_mcp_settings.json`，而且本机上是空的。
  - 还没有确认到更强的一手 MCP registry。

### Qoder

- Registry scanner: `generic`
- 当前认为相关的 discovery 根：
  - `~/.qoder`
  - `%APPDATA%/Qoder`
- 当前级别：通用只读占位
- 说明：
  - `%APPDATA%/Qoder` 看起来才是本机真实 app root。
  - registry 目前仍把 skills 指到 `~/.qoder/skills`，但这个路径在本机上还没有被验证为稳定的真实 skill 来源。
  - `%APPDATA%/Qoder` 下虽然存在多份 MCP 相关文件，但当前都为空，或者更像 cache / compatibility state。
  - dedicated MCP parsing 继续 deferred。

### Qoder Work

- Registry scanner: `generic`
- 当前认为相关的 discovery 根：
  - `~/.qoderworkcn`
  - `~/.qoder-work`
  - `%APPDATA%/QoderWork CN`
  - `%APPDATA%/Qoder Work`
  - `%LOCALAPPDATA%/Qoder Work`
- 当前级别：通用只读占位
- 说明：
  - skills 根已经足够清晰，可以继续用 generic read-only 扫描。
  - `cache/mcp/market.json` 更像 connector catalog metadata，不是 active enablement state。
  - `%APPDATA%/QoderWork CN/data/agents.db` 含 MCP 邻近 schema，但本机上未能证明 active MCP enablement。
  - 一旦发现多份 independently confirmed roots，discovery 会故意退回 manual review，而不是猜当前活跃安装。
  - dedicated MCP parsing 继续 deferred。

## 可信度说明

可以这样理解 `Source-of-Truth 可信度`：

- `高`：已有稳定、直接可解析的 MCP 配置或 skill 根，并且已经被测试覆盖。
- `中`：存在较可信的一手本地配置来源，scanner 已在使用，但同时还存在其他产品态状态来源。
- `低`：虽然已经能找到 app root，但当前 MCP 证据仍然是空的、compatibility-style、cache-style，或不足以信任为 active config source。

## 接下来应该怎么做

- 对 `codebuddy`、`workbuddy`、`trae`：
  - 继续提升 read-only 可信度，再考虑任何 write support。
- 对 `qoder`、`qoder-work`：
  - 继续 research，直到确认真实 active MCP source of truth。
  - 不要仅凭 catalog、cache、空的 compatibility 文件就上 dedicated MCP parser。
- 对所有非基线 agent：
  - 在恢复语义没有被验证前，继续保持 `enabled: false` 与 `readOnly: true`。
- 对产品路线图：
  - 先继续提高只读 MCP governance 的证据质量，再开放 MCP write governance。
  - 在治理后的 capability state 稳定前，继续推迟 routing。
