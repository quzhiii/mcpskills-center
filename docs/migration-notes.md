# MCPskills 中台迁移说明

> 日期：2026-05-21  
> 来源目录：`C:\Users\quzhi\Documents\New project`  
> 目标目录：`E:\BaiduSyncdisk\koni电脑\创业\MCPskills中台`

## 迁移方式

本次采用干净迁移：

- 不移动原目录
- 不删除原文件
- 只复制可维护脚本、现有说明文档和新项目文档
- 排除缓存、日志、备份、大型临时文件

## 迁入内容

建议迁入：

- `analyze-opencode-history.js`
- `apply-opencode-global-project-cache-repair.ps1`
- `dry-run-repair-global-project-cache.js`
- `fix-opencode-kiro-provider-stability.js`
- `inspect-opencode-db.js`
- `launch-opencode-cache-repair.cmd`
- `manage-opencode-kiro-provider.js`
- `manage-opencode-plugins.js`
- `read-asar.js`
- `repair-opencode-project-vcs.js`
- `start-aiclient2api-kiro-relay.ps1`
- `switch-codex-route.ps1`
- `use-codex-api.ps1`
- `use-codex-plus.ps1`
- `CODEX-API-SWITCHING.md`
- `opencode-history-recovery-handoff-20260517.md`
- `docs/MCPskills-center-background-and-plan.md`
- `docs/migration-notes.md`

## 不迁入主干的内容

以下内容保留在原目录，不进入新项目主干：

- `.git`
- `.codex-repair`
- `_opencode_cache`
- `_opencode_config`
- `_opencode_data`
- `_opencode_home`
- `opencode-recovery-backups`
- `oh-my-openagent-upstream`
- `superpowers-upstream`
- `opencode.global.dat.simulated-merge`
- `*.log`
- `start-process-test.txt`

原因：

- 多数是缓存、备份、临时数据或上游副本
- 体积较大，不适合放进新项目主干
- 后续需要时可以建立 `archive-index.md` 记录位置，而不是复制整个目录

## 目标目录结构

```text
MCPskills中台/
  README.md
  docs/
    MCPskills-center-background-and-plan.md
    migration-notes.md
    inventory/
  scripts/
    legacy/
  config/
    profiles/
    samples/
  src/
  reports/
  backups/
```

## 后续动作

迁移完成后，下一步建议：

1. 在目标目录初始化 git
2. 把本次迁移作为第一个提交
3. 编写 inventory scanner
4. 生成当前本机 MCP/skills 快照
5. 以 `hv-analysis`、`neat-freak`、`lark-*` 作为第一批整合试点
