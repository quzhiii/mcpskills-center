# MCPskills 中台背景说明与项目计划书

> 日期：2026-05-21  
> 当前来源项目：`C:\Users\quzhi\Documents\New project`  
> 目标项目目录：`E:\BaiduSyncdisk\koni电脑\创业\MCPskills中台`

## 1. 项目背景

目前本机同时使用 Claude Code、OpenCode、Codex 三套 agent。三者各自维护 MCP、skills、plugins、commands、agents、缓存和备份目录，已经出现以下问题：

- 同一类能力在多个 agent 里重复安装，后续版本更新和排错成本高。
- MCP server 分散在不同配置文件里，难以判断哪些可用、哪些重复、哪些已经过期。
- skills 有些是复制安装，有些来自共享目录，有些目录不完整，长期会造成“看起来安装了，实际不可用”的情况。
- agent 配置、OpenCode 修复脚本、Codex 路由脚本、历史恢复脚本散落在同一个工作目录，项目边界不清晰。
- 飞书/Lark、研究/创业判断、文档处理、前端工程、安全审计等能力都很重要，但目前不是以统一产品形态组织。

本项目的核心目标，是把本机的 MCP 和 skills 变成一个“本地优先、可审计、可视化、可同步”的 agent 能力中台。它不替代 Claude Code、OpenCode 或 Codex，而是成为三者背后的统一配置层和治理层。

## 2. 已发现的本机现状

### 2.1 MCP 分布

Claude Code 当前能力最重：

- 全局 MCP：`milk-tea`、`web-reader`、`fetcher`、`zread`、`zai-mcp-server`、`web-search-prime`
- 项目级 MCP：`playwright`、`tavily`、`x-reader`、`chrome-devtools`

OpenCode 当前 MCP：

- `agentmemory`
- `web-search-prime`
- `web-reader`

Codex 当前 MCP：

- `agentmemory`

Codex 还通过插件提供：

- `documents`
- `spreadsheets`
- `presentations`
- `browser-use`

### 2.2 Skills 分布

明确同名重复：

- `hv-analysis`：Claude Code、Codex、OpenCode 都有
- `neat-freak`：Claude Code、Codex、OpenCode 都有，但 OpenCode 版本目前缺少完整 `SKILL.md`
- `lark-*` 系列：Claude Code 和 `C:\Users\quzhi\.agents\skills` 都有一套

功能级重复：

- 前端/UI：Claude Code 的 `frontend-design`、`ui-ux-pro-max` 与共享 skills 中的前端/UI 能力重叠
- 计划/执行：Claude Code 的 `writing-plans`、`executing-plans`、`gstack/superpowers` 与其他执行类技能重叠
- 安全审计：`security-auditor`、`clawdefender`、review/security 类技能重叠
- 文档/PPT/XLSX：Claude Code 有文档类 skills，Codex 有 Documents/Presentations/Spreadsheets 插件

### 2.3 当前 workspace 资产

当前目录更像“agent 配置实验和修复工作台”，主要包括：

- OpenCode 历史/缓存修复脚本
- OpenCode provider 管理脚本
- Codex API 路由切换脚本
- Feishu/Codex 初始化日志
- OpenCode 备份、缓存、临时数据
- 上游项目副本

迁移到新项目时，不应直接搬运全部缓存和备份。当前大目录包括：

- `opencode-recovery-backups`：约 843 MB
- `_opencode_cache`：约 690 MB
- `.git`：约 428 MB
- `.codex-repair`：约 231 MB

这些目录更适合作为“历史归档/按需恢复源”，不应进入新项目主干。

## 3. 项目定位

项目名称暂定：MCPskills 中台。

一句话定位：

为 Claude Code、OpenCode、Codex 等本地 agent 提供统一的 MCP 和 skills 管理、审计、同步、可视化中台。

目标用户：

- 同时使用多个 AI coding agent 的个人开发者
- 需要管理多套 MCP server、skills、plugins 的重度 AI 工作者
- 希望把 agent 能力变成稳定资产，而不是散落配置的人

本项目优先服务本机工作流，不一开始做 SaaS。先做一个可靠的本地工具，再考虑开源或产品化。

## 4. 产品目标

### 4.1 第一阶段目标

建立一个干净项目目录，并完成：

- 背景说明与计划书
- 当前本机 MCP/skills inventory 快照
- 迁移说明
- 初始目录结构
- 下一步实现计划

### 4.2 MVP 目标

MVP 需要做到：

- 扫描 Claude Code、OpenCode、Codex 的 MCP 和 skills 配置
- 输出统一 inventory：哪些已安装、哪些重复、哪些缺文件、哪些疑似不可用
- 支持 dry-run 同步，不直接破坏现有配置
- 支持 canonical skills store：同一个 skill 只保留一份
- 支持用 symlink 或 copy 策略分发到不同 agent
- 支持 MCP profiles：例如 `coding`、`research`、`lark-office`、`security`
- 支持基础健康检查：配置是否存在、命令是否可启动、skill frontmatter 是否有效

### 4.3 后续目标

后续可以增加本地 Web UI：

- 三套 agent 的 MCP/skills 矩阵视图
- 重复项和缺失项标红
- 一键生成清理建议
- 一键生成备份
- 一键应用 symlink 同步方案
- MCP server 启动测试和日志查看
- skills 版本、来源、最后更新时间管理

## 5. 建议架构

### 5.1 本地优先

所有核心功能优先在本机完成，不依赖云端。涉及 token、API key、环境变量时，只显示 key 名称和风险等级，不输出值。

### 5.2 分层设计

建议分为五层：

1. 扫描层：读取 Claude Code、OpenCode、Codex 配置和目录结构
2. 归一化层：把不同 agent 的 MCP/skills 表达转成统一 schema
3. 审计层：发现重复、缺失、无效配置、疑似密钥泄露、路径失效
4. 同步层：把 canonical store 分发到各 agent
5. 展示层：CLI 报告和本地 Web UI

### 5.3 建议目录结构

```text
MCPskills中台/
  README.md
  docs/
    MCPskills-center-background-and-plan.md
    migration-notes.md
    inventory/
  config/
    profiles/
    samples/
  scripts/
    legacy/
  src/
    scanner/
    normalizer/
    auditor/
    sync/
    dashboard/
  reports/
  backups/
```

## 6. 数据模型草案

### 6.1 Agent

记录每个 agent 的名称、配置目录、skills 目录、MCP 配置文件、可写策略。

### 6.2 Skill

记录：

- skill id
- 显示名称
- 来源路径
- agent 安装位置
- 是否 canonical
- 是否 symlink
- 是否缺 `SKILL.md`
- frontmatter 是否有效
- 最近更新时间

### 6.3 MCP Server

记录：

- server id
- agent 来源
- transport 类型：stdio/http/sse
- command 或 host
- 是否重复
- 是否启用
- 是否可启动
- 是否涉及敏感环境变量

### 6.4 Profile

记录不同使用场景需要启用的能力组合：

- `coding`
- `research`
- `lark-office`
- `security`
- `startup-diligence`
- `docs-production`

## 7. 安全原则

这个项目会接触大量 agent 配置，因此必须从第一天就内置安全约束：

- 默认 dry-run，不直接写入 agent 配置
- 每次写入前自动备份原文件
- 不打印 API key、token、cookie、authorization header
- 不跨盘移动原项目，只复制或生成干净新项目
- 清理建议先输出报告，再由用户确认执行
- 对 symlink 目标做路径白名单校验
- 大目录和缓存默认不迁移

## 8. 迁移策略

本次迁移建议采用“干净迁移”，不是全量复制。

迁入：

- 当前有用脚本：OpenCode 修复、provider 管理、插件管理、Codex 路由切换等
- 当前已有文档：Codex API 切换说明、OpenCode 历史恢复 handoff
- 本计划书
- 后续生成的 inventory 和 migration notes

不迁入主干：

- `_opencode_cache`
- `_opencode_data`
- `_opencode_home`
- `opencode-recovery-backups`
- `.codex-repair`
- `.git`
- 大型临时文件：`opencode.global.dat.simulated-merge`
- 日志文件

这些内容可以留在原目录，后续如有必要再做 `archive/` 或外部备份索引。

## 9. 分阶段计划

### Phase 0：项目落地与整理

目标：在 E 盘目标目录建立干净项目。

任务：

- 创建项目目录结构
- 复制可维护脚本和文档
- 排除缓存、日志、大型备份
- 写入背景说明与项目计划书
- 写入迁移说明

验收标准：

- E 盘目标目录存在
- `docs/MCPskills-center-background-and-plan.md` 存在
- `docs/migration-notes.md` 存在
- `scripts/legacy/` 中有当前可复用脚本

### Phase 1：Inventory 扫描器

目标：自动扫描本机三套 agent 的 MCP 和 skills。

任务：

- 定义 inventory schema
- 实现 Claude Code scanner
- 实现 OpenCode scanner
- 实现 Codex scanner
- 输出 `reports/inventory-current.json`
- 输出 `reports/inventory-current.md`

验收标准：

- 能列出所有 MCP server
- 能列出所有 skills
- 能识别缺 `SKILL.md` 的目录
- 能识别同名重复

### Phase 2：审计和清理建议

目标：从 inventory 生成可执行建议。

任务：

- 识别重复 skills
- 识别重复 MCP
- 识别失效路径
- 识别疑似敏感配置
- 生成清理建议报告

验收标准：

- 输出“建议保留/建议合并/建议删除/需人工确认”四类结果
- 不输出任何密钥值
- 报告能解释每个建议的原因

### Phase 3：Canonical Store 与同步

目标：让 skills 不再三套各装一份。

任务：

- 创建 canonical skills store
- 实现 symlink dry-run
- 实现 symlink apply
- 实现 restore
- 支持 copy fallback

验收标准：

- `hv-analysis` 和 `neat-freak` 可从一处同步到三套 agent
- Lark skills 可从一处同步到 Claude Code 和共享 skills
- OpenCode 不完整 skills 能被识别并修复

### Phase 4：MCP Profile 管理

目标：统一管理 MCP server 的启用场景。

任务：

- 定义 MCP profile
- 实现 profile apply dry-run
- 实现配置备份
- 实现配置写入
- 实现 MCP health check

验收标准：

- 可生成 `coding`、`research`、`lark-office`、`security` profile
- 可检测 `agentmemory`、`web-reader`、`web-search-prime`
- 可输出启动失败原因

### Phase 5：本地可视化 Dashboard

目标：做一个本地 Web UI，降低维护成本。

核心页面：

- Overview：当前 agent 状态总览
- MCP Matrix：MCP server 分布矩阵
- Skills Matrix：skills 分布矩阵
- Audit Report：重复/缺失/风险项
- Profiles：场景配置
- Actions：备份、dry-run、apply、restore

验收标准：

- 能在本地浏览器查看
- 不上传配置到外网
- 所有写操作需要二次确认

## 10. 需要自建的整合型 skills

目前没有发现特别成熟、完全匹配本需求的现成高星项目。建议后续自建：

### 10.1 agent-stack-auditor

用途：

- 审计本机 Claude Code、OpenCode、Codex 配置
- 检查 MCP、skills、plugins、agents、commands
- 输出重复项、失效项、风险项

### 10.2 startup-diligence

用途：

- 创业项目判断
- ICP、痛点强度、商业化路径、护城河、竞品、单位经济
- 适合评估 TRG、医疗管理、科研工具、B2B 自动化类项目

### 10.3 secrets-and-exposure-audit

用途：

- 检查 API key、token、公网 IP、日志泄露
- 支持脱敏报告
- 支持可用性保留和密钥掩码替换建议

### 10.4 windows-docker-wsl-ops

用途：

- 处理 Windows、Docker Desktop、WSL、磁盘迁移、环境变量、路径问题
- 适合本机 agent 环境维护

### 10.5 lark-workspace-operator

用途：

- 把 Lark/飞书 docs、sheets、base、im、calendar、task 串成工作流
- 统一管理飞书办公自动化

## 11. 外部项目参考

后续可以重点研究：

- `vercel-labs/skills`：多 agent skills 安装和同步思路
- `modelcontextprotocol/registry`：MCP registry 思路
- `modelcontextprotocol/inspector`：MCP 可视化调试思路
- `pathintegral-institute/mcpm.sh`：MCP package/profile 管理思路
- `larksuite/lark-openapi-mcp`：飞书官方 MCP
- `phuryn/pm-skills`：产品/创业/PM skills 参考
- `trailofbits/skills`：安全审计 skills 参考

## 12. 下一步建议

下一步先不要急着做完整 UI，先做一个可信的 CLI 核心：

1. 建立新项目目录结构
2. 生成当前本机 inventory 快照
3. 生成重复项和风险项报告
4. 设计 canonical skills store
5. 先拿 `hv-analysis`、`neat-freak`、`lark-*` 做同步试点
6. 确认不会破坏三套 agent 后，再做 Web UI

这样推进的好处是：先把“混乱”变成“可观测”，再做“可治理”，最后才做“可视化”。这条路更稳，也更适合你当前本机环境的复杂度。
