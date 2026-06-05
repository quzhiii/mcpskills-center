# MCPskills Center

<div align="center">

**面向 Claude Code、OpenCode、Codex 的本地优先 CLI，用来扫描、审计、规划 agent skills 同步，并盘点 MCP server。**

[![Runtime](https://img.shields.io/badge/runtime-Node.js-43853d?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Language](https://img.shields.io/badge/language-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Mode](https://img.shields.io/badge/mode-local--first-6f42c1)](#安全模型)
[![Default](https://img.shields.io/badge/default-read--only-success)](#安全模型)
[![Outputs](https://img.shields.io/badge/output-HTML%20%7C%20JSON%20%7C%20Markdown-lightgrey)](#输出物)

**中文** · [English](README.md)

[快速开始](#快速开始) · [输出物](#输出物) · [命令](#命令) · [典型场景](#典型场景) · [Profiles](#profiles) · [安全模型](#安全模型) · [边界与限制](#边界与限制)

</div>

---

## 这是什么？

MCPskills Center 给一台本地机器上的多套 agent 能力提供统一的可视化和治理入口。

它会扫描已安装的 MCP server 与 skills 目录，归一化元数据，标出重复项和异常项，生成 dry-run skill 同步计划，执行健康检查，并输出适合人工审阅与自动化消费的报告。

```text
Claude Code 配置 ─┐
OpenCode 配置 ────┼─→ scan → audit → plan → verify → report
Codex 配置 ───────┘                      │
                                         ├─→ sync dry-run
                                         ├─→ sync apply + backup manifest
                                         ├─→ restore from manifest
                                         └─→ 离线 dashboard.html
```

当前版本已经覆盖一条完整的本地工作流：

| 能力 | 作用 |
|---|---|
| Inventory 扫描 | 统一查看 MCP server、skills、安装路径、元数据和问题项 |
| Audit 审计 | 识别重复 skills、重复 MCP、缺失 `SKILL.md`、需要人工复核的 symlink 条目、敏感环境变量风险 |
| Sync 规划 | 在真正写入前先生成 canonical skill 分发计划 |
| 安全 apply / restore | 显式 `--confirm`、approved roots 校验、时间戳备份、restore manifest |
| Profiles | 以 `coding`、`research` 等场景包做只读规划 |
| Health 检查 | 默认被动检查，显式 allowlist 后才做主动命令探测 |
| Dashboard | 生成 `reports/dashboard.html` 静态离线页面 |

各 agent 当前支持状态可见 `docs/supported-agents.md`。

---

## 快速开始

克隆仓库、安装依赖、跑测试，然后生成第一份本机 inventory。

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
- `reports/dashboard.html` 可以本地直接打开，无需外部静态资源

如果想继续看只读同步计划：

```bash
node dist/index.js sync --dry-run
```

---

## 输出物

### 主要报告

`scan` 会生成：

- `reports/inventory-current.json`
- `reports/inventory-current.md`
- `reports/audit-current.md`
- `reports/dashboard.html`

`sync --dry-run` 会生成：

- `reports/sync-plan-current.json`
- `reports/sync-plan-current.md`

`matrix` 会生成：

- `reports/capability-matrix-current.json`
- `reports/capability-matrix-current.md`

`sync --apply --confirm` 会在 `backups/` 下写入带时间戳的备份目录，并生成一次 apply 对应的 consolidated manifest。

### Dashboard 预览

静态 dashboard 会把当前本地状态压缩成一个离线 HTML 页面：

```text
Summary cards     Recommendations table     Skills table     Issues table
     │                     │                    │                │
     └───────────── 全部来自当前本地 inventory 的生成结果 ─────────────┘
```

HTML 页面更适合阅读。JSON 与 Markdown 报告仍然是可审计、可自动化处理的主输出。

---

## 命令

| 命令 | 作用 | 写入位置 |
|---|---|---|
| `npm run scan` | 扫描 inventory、归一化记录、执行审计并生成报告 | `reports/` |
| `npm run audit` | 在终端打印审计摘要 | 无 |
| `node dist/index.js sync --dry-run` | 生成同步计划，不改动 agent 配置 | `reports/` |
| `node dist/index.js sync --apply --confirm` | 应用当前同步计划并生成备份 | `backups/` |
| `node dist/index.js sync --restore <manifest>` | 根据 manifest 恢复之前的 apply 结果 | 目标路径 |
| `node dist/index.js profile list` | 列出本地 profile | 无 |
| `node dist/index.js profile show <name>` | 打印一个 profile 的 JSON | 无 |
| `node dist/index.js profile plan <name>` | 将 profile 与当前 inventory 对比 | 无 |
| `node dist/index.js agents list` | 列出 `config/agents.json` 中注册的本地 agents | 无 |
| `node dist/index.js agents discover` | 发现 Qoder、CodeBuddy、WorkBuddy、Trae 等本地 agent 配置候选路径 | `reports/` |
| `node dist/index.js matrix` | 为已注册 agents 上发现的 skills 和 MCP servers 生成能力矩阵 | `reports/` |
| `node dist/index.js health` | 执行被动 MCP 健康检查 | 无 |
| `node dist/index.js health --active --allow-command <cmd> [--timeout <ms>]` | 对 allowlist 中的命令做显式主动探测 | 无 |
| `node dist/index.js help` | 查看 CLI 帮助 | 无 |

---

## 典型场景

### 1. 快速看清当前机器上的 agent 能力分布

```bash
npm run scan
```

适合一次性拿到 inventory、audit 和离线 dashboard。

### 2. 在终端里快速看重复项和风险项

```bash
npm run audit
```

这个命令会汇总重复 skills、重复 MCP、缺失 `SKILL.md`、需要人工复核的 symlink 条目、敏感环境变量 key 风险。

### 3. 先看 canonical skill 同步计划，再决定是否写入

```bash
node dist/index.js sync --dry-run
```

可选自定义 canonical 目录：

```bash
node dist/index.js sync --dry-run --canonical-dir C:\path\to\canonical-skills
```

当前 planner 会围绕 canonical store 和各 agent skill root 的分发动作生成计划。建议先审阅计划输出，再决定是否 apply。

如果后续要用自定义 canonical 目录执行 `sync --apply`，需要先把该目录加入 `config/sync.json` 的 `approvedSyncRoots`。apply 会同时校验 source path 和 target path。

### 4. 显式确认后再应用同步计划

```bash
node dist/index.js sync --apply --confirm
```

apply 模式会重新计算当前计划，必要时先备份已有 target，然后写出一份后续可 restore 的 manifest。

### 5. 用 manifest 回滚之前的一次 apply

```bash
node dist/index.js sync --restore C:\path\to\manifest.json
```

restore 模式会先做 approved roots 校验，再把备份内容复制回原目标路径。

### 6. 针对具体工作场景做 profile 规划

```bash
node dist/index.js profile plan coding
```

输出会按 `already-present`、`missing`、`disable` 三类展示，不会修改 live config。

### 7. 查看已注册的本地 agents

```bash
node dist/index.js agents list
```

这个命令只读取当前加载后的 registry，不扫描 live config。仓库里的 `config/agents.json` 还包含 Qoder、Qoder Work、CodeBuddy、WorkBuddy、Trae 的 disabled/read-only 占位配置，但 disabled 条目不会出现在运行时加载后的列表里。

### 8. 发现本地 agent 候选配置路径

```bash
node dist/index.js agents discover
```

Discovery 是只读操作。它会检查常见本地路径，并写出 `reports/agent-discovery-current.json` 与 `reports/agent-discovery-current.md`。

### 9. 查看当前 inventory 的跨 agent 能力矩阵

```bash
node dist/index.js matrix
```

适合在当前 inventory 之上快速看到哪些 skill 和 MCP 能力分布在多个 agent 上、哪些 agent 缺失对应能力，以及共享能力数量。它会写出 `reports/capability-matrix-current.json` 与 `reports/capability-matrix-current.md`。

### 10. 先做安全的被动 MCP 健康检查

```bash
node dist/index.js health
```

被动模式不会启动命令，只检查 transport 形态、command 是否存在、URL 是否有效、敏感 env key 风险等。

### 11. 对 allowlist 命令做显式主动探测

```bash
node dist/index.js health --active --allow-command npx --timeout 3000
```

主动模式只会对 allowlist 中的命令执行 `--version` 探测，使用参数数组而不是 shell 字符串，并带超时限制。

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

可写的同步根目录由 `config/sync.json` 控制。

```json
{
  "approvedSyncRoots": [
    "config/canonical-skills",
    "C:/Users/quzhi/.claude/skills",
    "C:/Users/quzhi/.opencode/skills",
    "C:/Users/quzhi/.codex/skills"
  ]
}
```

相对路径会按项目根目录解析。配置值非法时，apply 开始前就会失败。

---

## 安全模型

- 默认行为是 read-only 或 dry-run。
- `sync --apply` 必须显式带 `--confirm`。
- `sync --restore` 必须提供 manifest 路径。
- apply 与 restore 只会在 approved roots 内操作。
- 有旧 target 时会先备份再覆盖。
- 生成报告不会打印 secret value。
- 对敏感环境变量只报告 key 风险，不展示值。
- 被动 health check 不会启动命令。
- 主动 health check 需要显式带 `--active`。
- 主动探测只有在命令通过 `--allow-command` 加入 allowlist 后才会成功。
- `--timeout` 是可选参数；省略时默认使用 `3000` ms。
- 主动探测采用 `spawn(command, ['--version'], { shell: false })` 语义，而不是 shell 字符串。

---

## 仓库结构

```text
mcpskills-center/
├── config/
│   ├── profiles/
│   └── sync.json
├── docs/
├── fixtures/
├── reports/
├── backups/
├── src/
├── README.md
└── README.zh-CN.md
```

Fixture 策略：

- `.claude/` 被视为本地机器配置，不作为 live repository payload 跟踪。
- 仓库内可跟踪的 skill 样例放在 `fixtures/skills/`。
- 这些 fixtures 是 synthetic 且保持最小化。

---

## 边界与限制

- 当前示例 `config/sync.json` 偏向单机使用，换机器后通常需要调整。
- Profile 匹配支持把 `playwright` 这类 short MCP id 匹配到 `C:/Users/quzhi:playwright` 这类 project-scoped id。
- 被动 HTTP / SSE 健康检查会校验配置里保留下来的 URL 或 host 值。
- 主动健康检查验证的是 `--version` 级别的命令可达性，不是完整 MCP handshake。
- OpenCode 的 array-form command 当前会归一化为前导可执行文件名用于 health probing。
- 目前还没有 packaged binary，构建后通过 `node dist/index.js ...` 使用。

---

## 文档

| 文档 | 作用 |
|---|---|
| `docs/MCPskills-center-background-and-plan.md` | 产品背景、本机上下文与最初项目定位 |
| `docs/migration-notes.md` | 迁移决策、保留内容与排除内容 |
| `docs/plans/2026-06-03-mcpskills-center-completion.md` | 当前 CLI 工作流的实施计划 |

---

## 本地验证

```bash
npm run build
npm test
npm audit --audit-level=moderate
```

如果要补一轮工作流 smoke check：

```bash
npm run scan
npm run audit
node dist/index.js sync --dry-run
node dist/index.js health
```

---

## License

MIT
