---
name: mcpskills-center
description: 当用户需要在本机扫描、审计、规划、同步或治理 MCP servers 与 agent skills 时使用，尤其适用于 Claude Code、OpenCode、Codex、CodeBuddy、WorkBuddy、Trae、Qoder、Qoder Work 等多 agent 环境下的本地优先治理、重复项检测、dry-run 同步计划、健康检查、路由推荐和离线报告生成。
---

# MCPskills Center

## 概览

MCPskills Center 是一个本地优先的 CLI 工具，用来帮助用户看清并治理自己电脑上的 agent 能力分布。

它可以扫描本机已安装的 agent skills 和 MCP servers，识别重复项、缺失项、异常项和敏感环境变量风险，生成 dry-run 同步计划，执行健康检查，构建跨 agent 能力矩阵，并输出离线 HTML / JSON / Markdown 报告。

核心原则是：

本地优先、默认只读、显式写入、可审计、可回滚。

## 隐私与本地优先规则

把 MCPskills Center 的所有输出都视为潜在敏感信息。

扫描结果和报告文件可能包含：

- 本机文件路径
- agent 名称
- skill 名称
- MCP server 名称
- MCP 配置元数据
- 环境变量 key 的风险信号
- 本机能力分布信息

不要把 `reports/`、`backups/`、`data/`、本地 agent 配置、MCP 配置或生成的 inventory 上传到外部服务，除非用户明确要求并确认可以分享这些数据。

默认只运行本地命令。

不要使用联网工具分析本地报告、配置文件或 inventory 结果，除非用户明确批准要分享哪些数据。

默认先使用只读命令。

不要在未获得用户明确确认前运行写入类命令，例如：

```bash
mcpskills sync --apply --confirm
mcpskills mcp apply --confirm
mcpskills governance --apply --confirm
```

不要暴露 secrets。

如果扫描结果提示存在敏感环境变量风险，只报告“存在敏感环境变量风险”，不要打印 token、cookie、API key、password、secret 或完整配置内容。

## 什么时候使用

当用户想做以下事情时，使用这个 Skill：

- 查看本机不同 agent 上安装了哪些 skills
- 查看本机不同 agent 上配置了哪些 MCP servers
- 审计重复 skills、重复 MCP servers、缺失 `SKILL.md`、无效 frontmatter、软链接风险
- 检查 MCP 配置中是否存在敏感环境变量 key 风险
- 在真正写入前生成 skill 同步 dry-run 计划
- 在真正修改 MCP 配置前生成 MCP governance plan
- 构建跨 agent 能力矩阵
- 推荐某个任务应该交给哪个本地 agent
- 生成离线 dashboard 和 Markdown / JSON 报告
- 在用户确认后执行 apply 或 restore

不要用这个 Skill 来：

- 上传 Skill 到 SkillHub
- 从零编写一个新 Skill
- 编辑无关项目代码
- 分析需要联网分享的私密本地配置

## 安全模型

MCPskills Center 的安全模型基于四个默认原则：

| 原则 | 含义 |
|---|---|
| 本地优先 | 默认只在用户自己的电脑上读取和生成文件 |
| 默认只读 | 优先运行 scan、audit、dry-run、plan 等只读命令 |
| 显式写入 | apply / restore 必须由用户明确确认 |
| 可回滚 | 写入类操作应产生 backup 和 manifest，便于恢复 |

如果用户要求执行有风险的操作，先展示 dry-run 结果或 manifest 路径，再请求确认。

## 安装检查

先检查 CLI 是否可用：

```bash
mcpskills help
```

如果当前就在 `mcpskills-center` 源码仓库中，可以使用源码方式：

```bash
npm install
npm run build
node dist/index.js help
```

如果已经全局安装：

```bash
mcpskills help
```

如果使用 `npx`：

```bash
npx mcpskills-center help
```

## 运行时数据位置

全局安装后，MCPskills Center 的可写运行时数据不写入 npm package 安装目录，而是写入用户 app data：

| 平台 | 默认位置 |
|---|---|
| Windows | `%APPDATA%\\mcpskills-center\\` |
| macOS | `~/Library/Application Support/mcpskills-center/` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/mcpskills-center/` |

常见子目录：

- `config/`：可编辑用户配置；包内 `config/` 仅作为只读默认模板
- `canonical-skills/`：canonical skill store
- `reports/`：JSON / Markdown / HTML 报告
- `backups/`：apply 前备份和 manifest
- `data/`：SQLite 历史数据，例如 `governance.db`

具体路径以 CLI 输出为准。

## 基础工作流

优先从只读扫描开始：

```bash
mcpskills scan
```

如果从源码运行：

```bash
node dist/index.js scan
```

扫描后查看 CLI 输出中的本地报告路径。全局安装时通常位于用户 app data 下，例如：

```text
%APPDATA%\\mcpskills-center\\reports\\inventory-current.json
%APPDATA%\\mcpskills-center\\reports\\inventory-current.md
%APPDATA%\\mcpskills-center\\reports\\audit-current.md
%APPDATA%\\mcpskills-center\\reports\\dashboard.html
```

这些报告是本地审阅材料，不要默认上传或发送给外部服务。

## 常用命令

| 目标 | 命令 |
|---|---|
| 初始化缺失用户配置 | `mcpskills init` |
| 查看有效配置来源 | `mcpskills config path` |
| 验证用户配置 | `mcpskills config validate` |
| 只读诊断本机环境 | `mcpskills doctor` |
| 扫描本机 inventory | `mcpskills scan` |
| 打印审计摘要 | `mcpskills audit` |
| 生成 skill 同步 dry-run | `mcpskills sync --dry-run` |
| 应用已审阅的 skill 同步计划 | `mcpskills sync --apply --confirm` |
| 恢复 skill 同步备份 | `mcpskills sync --restore <manifest>` |
| 生成 MCP governance plan | `mcpskills mcp plan` |
| 应用已审阅的 MCP plan | `mcpskills mcp apply --confirm` |
| 恢复 MCP 备份 | `mcpskills mcp restore <manifest>` |
| 构建能力矩阵 | `mcpskills matrix` |
| 被动 MCP 健康检查 | `mcpskills health` |
| 主动 MCP 健康检查 | `mcpskills health --active --allow-command <cmd>` |
| 推荐适合的 agent | `mcpskills route "<task>"` |
| 查看已注册 agents | `mcpskills agents list` |
| 发现本机 agent 配置候选路径 | `mcpskills agents discover` |
| 生成 unified governance dry-run | `mcpskills governance --dry-run` |
| 应用 unified governance | `mcpskills governance --apply --confirm` |
| 查看历史记录 | `mcpskills history` |
| 启动本地 Web console | `mcpskills web` |

如果从源码运行，把 `mcpskills` 替换成：

```bash
node dist/index.js
```

## 推荐只读审阅流程

大多数场景先跑这一组命令：

```bash
mcpskills scan
mcpskills audit
mcpskills sync --dry-run
mcpskills mcp plan
mcpskills matrix
```

然后总结：

- skills 总数
- MCP servers 总数
- 重复 skills 数量
- 重复 MCP servers 数量
- 缺失或无效的 skill 条目
- 敏感环境变量风险数量
- 需要人工复核的项目
- dry-run 中涉及的写入动作数量

这个流程只用于审阅，不执行任何写入。

## 写入流程

只有在用户明确确认后，才能运行写入类命令。

在执行 apply 前，必须先说明：

- 要修改的是 skills、MCP config，还是 combined governance
- 即将运行的完整命令
- 是否会生成 backup manifest
- 用户已经审阅了哪个 dry-run plan 或报告
- 是否还有 manual-review blocker

应用 skill 同步计划：

```bash
mcpskills sync --apply --confirm
```

应用 MCP plan：

```bash
mcpskills mcp apply --confirm
```

应用 combined governance：

```bash
mcpskills governance --apply --confirm
```

如果命令失败，如实报告失败原因，并保留 manifest 或 partial backup 信息。不要盲目重试写入命令。

## 恢复流程

当用户想回滚之前的 apply 操作时，使用 restore。

恢复 skill sync：

```bash
mcpskills sync --restore <manifest>
```

恢复 MCP 配置：

```bash
mcpskills mcp restore <manifest>
```

恢复 combined governance：

```bash
mcpskills governance --restore <manifest>
```

恢复前确认 manifest 路径确实是用户想使用的那一个。

## 健康检查

被动健康检查默认安全：

```bash
mcpskills health
```

主动健康检查可能会启动本地命令。只有在用户同意并明确 allowlist 后才运行：

```bash
mcpskills health --active --allow-command node
mcpskills health --active --allow-command npx
```

不要随意对未知命令做主动探测。

## 报告摘要规则

总结结果时，默认只给高层摘要。

可以报告：

- 数量
- 问题类别
- 风险等级
- 建议动作
- 本地报告路径

除非用户明确要求，否则避免报告：

- 完整本机路径
- 完整 MCP 配置内容
- 环境变量值
- token-like 字符串
- 完整 JSON 报告内容

推荐表达：

```text
扫描发现 2 个 MCP 条目存在敏感环境变量 key 风险。我没有打印具体变量值。
```

避免表达：

```text
下面是完整环境变量和配置内容。
```

## 常见错误

| 错误 | 正确做法 |
|---|---|
| 还没 dry-run 就 apply | 先生成并审阅 dry-run |
| 把 reports 当成公开材料 | reports 默认视为本地敏感材料 |
| 打印 secrets | 只报告风险，不打印值 |
| 把 inventory 上传给外部服务 | 默认本地分析，除非用户明确批准 |
| 随意运行 active health check | 必须使用 `--allow-command` 并获得用户确认 |
| 认为所有重复项都能自动合并 | scope、env、transport 差异必须人工复核 |
| 写入失败后反复重试 | 先报告失败、检查 manifest 和备份状态 |

## 完成前检查

在声称任务完成前，确认：

- 用户请求的命令确实运行过
- 已阅读命令输出
- 生成的报告路径存在
- 没有在未确认时运行写入命令
- 没有打印敏感值
- 失败、风险或 manual-review blocker 已如实报告

只能基于命令输出给结论，不要基于猜测。
