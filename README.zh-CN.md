# MCPskills Center

<div align="center>

**面向 Claude Code、OpenCode、Codex、CodeBuddy、WorkBuddy、Trae、Qoder、Qoder Work 的本地优先 CLI，用来扫描、审计、规划 agent skills 同步，并盘点 MCP server。**

[![Runtime](https://img.shields.io/badge/runtime-Node.js-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Language](https://img.shields.io/badge/language-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Mode](https://img.shields.io/badge/mode-local--first-6f42c1)](#安全模型)
[![Default](https://img.shields.io/badge/default-read--only-success)](#安全模型)
[![Outputs](https://img.shields.io/badge/output-HTML%20%7C%20JSON%20%7C%20Markdown-lightgrey)](#输出物)

**中文** · [English](README.md)

[快速开始](#快速开始) · [输出物](#输出物) · [命令](#命令) · [典型场景](#典型场景) · [支持的 Agents](docs/supported-agents.md) · [Profiles](#profiles) · [安全模型](#安全模型) · [边界与限制](#边界与限制)

</div>

---

## 这是什么？

MCPskills Center 给一台本地机器上的多套 agent 能力提供统一的可视化和治理入口。

它会扫描已安装的 MCP server 与 skills 目录，归一化元数据，标出重复项和异常项，生成 dry-run 计划，执行健康检查，并输出适合人工审阅与自动化消费的报告。

产品方向是 CLI first。CLI 会继续作为治理内核，也是 scan、plan、apply、restore 的操作真相来源。本地 Web console 可以包裹这些产物，但不应该替代 CLI 执行模型。

```text
Claude Code / OpenCode / Codex ─┐
CodeBuddy / WorkBuddy / Trae ──┼─→ scan → audit → plan → verify → report
Qoder / Qoder Work ────────────┘                      │
                                                      ├─→ sync dry-run / apply / restore
                                                      ├─→ mcp plan / apply / restore
                                                      ├─→ governance（统一治理）
                                                      ├─→ route <task>
                                                      └─→ 离线 dashboard & console
```

| 能力 | 作用 |
|---|---|
| Inventory 扫描 | 统一查看 MCP server、skills、安装路径、元数据和问题项 |
| Audit 审计 | 识别重复 skills、重复 MCP、缺失 `SKILL.md`、需要人工复核的 symlink 条目、敏感环境变量风险 |
| Skills 同步 | Canonical skill 分发计划，支持 dry-run、apply、restore |
| MCP 治理 | MCP 配置规划、apply、restore，支持 write-ready 的 agent（Claude Code、OpenCode、Codex） |
| 统一治理 | `governance` 命令一次执行 skills sync + MCP governance |
| 操作历史 | SQLite 存储所有 apply/restore 操作记录 |
| Plan 对比 | 比较当前 vs 上一次计划，查看变更 |
| Agent 路由 | `route <task>` 根据能力和策略推荐最佳 agent |
| Profiles | 以 `coding`、`research` 等场景包做只读规划 |
| Health 检查 | 默认被动检查，显式 allowlist 后才做主动命令探测 |
| Dashboard & console | 静态离线 HTML 报告：`reports/dashboard.html` 和 `reports/governance-console.html` |

各 agent 当前支持状态可见 `docs/supported-agents.md`。

---

## 快速开始

```bash
git clone https://github.com/quzhiii/mcpskills-center.git
cd mcpskills-center

npm install
npm test
npm run scan
```

预期结果：

- TypeScript 成功构建到 `dist/`
- 测试全部通过
- `reports/` 下生成报告
- `reports/dashboard.html` 可以本地直接打开

下一步：

```bash
# Skills 同步计划
node dist/index.js sync --dry-run

# MCP 治理计划
node dist/index.js mcp plan

# 统一治理计划（skills + MCP）
node dist/index.js governance --dry-run

# 路由任务到最佳 agent
node dist/index.js route "implement a test"
```

---

## 输出物

`scan` 会生成：

- `reports/inventory-current.json`
- `reports/inventory-current.md`
- `reports/audit-current.md`
- `reports/dashboard.html`

`sync --dry-run` 会生成：

- `reports/sync-plan-current.json`
- `reports/sync-plan-current.md`

`mcp plan` 会生成：

- `reports/mcp-governance-plan-current.json`
- `reports/mcp-governance-plan-current.md`

`governance --dry-run` 会生成以上所有，另外还有：

- `reports/governance-current.json`（统一报告）
- `reports/governance-current.md`（统一报告）
- `reports/governance-console.html`（离线治理仪表板）

`matrix` 会生成：

- `reports/capability-matrix-current.json`
- `reports/capability-matrix-current.md`

`sync --apply --confirm` 和 `mcp apply --confirm` 会在 `backups/` 下写入带时间戳的备份目录，并生成一份 manifest。

---

## 命令

| 命令 | 作用 | 写入位置 |
|---|---|---|
| `npm run scan` | 扫描 inventory、归一化记录、执行审计并生成报告 | `reports/` |
| `npm run audit` | 在终端打印审计摘要 | 无 |
| `node dist/index.js sync --dry-run` | 生成 skills 同步计划 | `reports/` |
| `node dist/index.js sync --apply --confirm` | 应用 skills 同步计划并生成备份 | `backups/` |
| `node dist/index.js sync --restore <manifest>` | 根据 manifest 恢复之前的 sync apply | 目标路径 |
| `node dist/index.js mcp plan` | 生成 MCP 治理 dry-run 计划 | `reports/` |
| `node dist/index.js mcp apply --confirm` | 应用 MCP 治理计划并生成备份 | `backups/` |
| `node dist/index.js mcp restore <manifest>` | 根据 manifest 恢复 MCP 配置 | 目标路径 |
| `node dist/index.js governance --dry-run` | 统一 skills + MCP 治理计划 | `reports/` |
| `node dist/index.js governance --apply --confirm` | 同时应用 skills sync 和 MCP governance | `backups/` |
| `node dist/index.js governance --restore <manifest>` | 从 manifest 恢复两者 | 目标路径 |
| `node dist/index.js governance-diff` | 比较当前 vs 上一次治理计划 | 无 |
| `node dist/index.js history` | 查看治理操作历史 | 无 |
| `node dist/index.js route <task>` | 推荐用于某任务的 agent | 无 |
| `node dist/index.js profile list` | 列出本地 profile | 无 |
| `node dist/index.js profile show <name>` | 打印一个 profile 的 JSON | 无 |
| `node dist/index.js profile plan <name>` | 将 profile 与当前 inventory 对比 | 无 |
| `node dist/index.js agents list` | 列出注册的本地 agents | 无 |
| `node dist/index.js agents discover` | 发现本地 agent 配置候选路径 | `reports/` |
| `node dist/index.js matrix` | 生成跨 agent 能力矩阵 | `reports/` |
| `node dist/index.js health` | 执行被动 MCP 健康检查 | 无 |
| `node dist/index.js health --active --allow-command <cmd>` | 对 allowlist 命令做主动探测 | 无 |
| `node dist/index.js help` | 查看 CLI 帮助 | 无 |

---

## 典型场景

### 1. 快速看清当前机器上的 agent 能力分布

```bash
npm run scan
```

### 2. 在终端里快速看重复项和风险项

```bash
npm run audit
```

### 3. 先看 canonical skill 同步计划

```bash
node dist/index.js sync --dry-run
```

### 4. 显式确认后再应用同步计划

```bash
node dist/index.js sync --apply --confirm
```

### 5. 用 manifest 回滚之前的一次 apply

```bash
node dist/index.js sync --restore C:\path\to\manifest.json
```

### 6. 生成 MCP 治理计划

```bash
node dist/index.js mcp plan
```

生成 MCP 治理 dry-run 计划，包含 scope-aware 决策、canonical profile evidence、target policy。

### 7. 应用 MCP 治理计划

```bash
node dist/index.js mcp apply --confirm
```

### 8. 统一治理（skills + MCP 一次执行）

```bash
node dist/index.js governance --dry-run
node dist/index.js governance --apply --confirm
node dist/index.js governance --restore C:\path\to\manifest.json
```

### 9. 比较计划变更

```bash
node dist/index.js governance-diff
```

显示自上次 apply 以来新增、移除、变更的 actions。

### 10. 查看操作历史

```bash
node dist/index.js history
```

显示 SQLite 中存储的所有 apply/restore 操作记录。

### 11. 路由任务到最佳 agent

```bash
node dist/index.js route "fix this bug"
node dist/index.js route "research AI agents"
node dist/index.js route "set up a database"
```

根据路由策略和 agent 能力返回推荐 agent 及理由。

### 12. 健康检查

```bash
node dist/index.js health
node dist/index.js health --active --allow-command npx --timeout 3000
```

---

## Profiles

示例 profiles 位于 `config/profiles/`，全部以只读方式和当前 inventory 做对比。

| Profile | 作用 | Agents |
|---|---|---|
| `coding` | 核心开发工作流，包含测试与调试支撑 | `claude-code`, `opencode`, `codex` |
| `research` | 调研与网页阅读工作流 | `claude-code`, `opencode` |
| `lark-office` | 飞书 / Lark 与文档生产工作流 | `claude-code` |
| `security` | 安全审计与防御性 review 工作流 | `claude-code` |

示例：

```bash
node dist/index.js profile list
node dist/index.js profile show coding
node dist/index.js profile plan coding
```

---

## Sync Approval Config

可写的同步根目录由 `config/sync.json` 控制。路径按项目根目录和 `os.homedir()` 解析。

---

## 安全模型

- 默认行为是 read-only 或 dry-run。
- `sync --apply`、`mcp apply`、`governance --apply` 必须显式带 `--confirm`。
- Restore 必须提供 manifest 路径。
- Apply 与 restore 只会在 approved roots 内操作。
- 有旧 target 时会先备份再覆盖。
- 生成报告不会打印 secret value。
- 对敏感环境变量只报告 key 风险，不展示值。
- 被动 health check 不会启动命令。
- 主动 health check 需要 `--active` 和 `--allow-command`。

---

## 仓库结构

```text
mcpskills-center/
├── config/
│   ├── profiles/
│   ├── agents.json
│   ├── routing-policy.json
│   └── sync.json
├── data/
│   └── governance.db          (SQLite, 运行时生成)
├── docs/
│   └── plans/
├── fixtures/
├── reports/
├── backups/
├── src/
│   ├── cli/                   (CLI 命令和参数解析)
│   ├── db/                    (SQLite 数据库模块)
│   ├── governance/            (统一治理、历史、diff、console、reporter)
│   ├── mcp/                   (MCP adapters、planner、reporter、apply、restore、safety)
│   ├── routing/               (路由策略、能力索引、路由器)
│   ├── agents/                (agent 发现和支持元数据)
│   ├── config/                (配置加载器)
│   ├── dashboard/             (HTML dashboard 生成器)
│   ├── health/                (MCP 健康检查)
│   ├── matrix/                (能力矩阵)
│   ├── normalizer/            (inventory 归一化)
│   ├── profiles/              (profile 加载器)
│   ├── scanner/               (inventory 扫描器)
│   ├── sync/                  (skills sync planner、apply、restore)
│   └── types/                 (共享 TypeScript 类型)
├── README.md
└── README.zh-CN.md
```

---

## 文档

| 文档 | 作用 |
|---|---|
| `docs/supported-agents.md` | Agent 支持矩阵和说明 |
| `docs/plans/` | 实施计划文档 |
| `docs/mcp-write-model-spec.md` | MCP write model 设计规格 |

---

## 本地验证

```bash
npm run build
npm test
```

Smoke check：

```bash
npm run scan
node dist/index.js governance --dry-run
node dist/index.js route "implement a test"
node dist/index.js history
```

---

## License

MIT
