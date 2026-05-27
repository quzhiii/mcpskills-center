# OpenCode 历史恢复排查交接

日期：2026-05-17  
工作区：`C:\Users\quzhi\Documents\New project`

## 当前目标

OpenCode Desktop 左侧历史/项目列表已从“全空”恢复到“部分有、部分空”。本轮重点排查历史不完整的原因，并做了一个最小数据库兼容性修复。后续 agent 需要继续处理仍未完整恢复的旧对话。

## 用户要求和安全约束

- 不要删除或重置 OpenCode 历史数据库。
- 修改前必须备份：
  - `C:\Users\quzhi\.local\share\opencode\opencode.db`
  - `C:\Users\quzhi\AppData\Roaming\ai.opencode.desktop\opencode.global.dat`
  - 相关配置文件如有改动也要备份。
- 读写真实 OpenCode DB/配置时建议用提权命令，沙箱容易产生误报的 SQLite/WAL/权限错误。
- 写库前关闭 OpenCode Desktop，避免 SQLite WAL 锁。
- 当前最优先目标仍是恢复对话框/历史列表，而不是重装或清空缓存。

## 本轮关键结论

1. 历史主体没有全丢。数据库中仍有：
   - `project`: 17
   - `session`: 147
   - `message`: 6585
   - `part`: 18670
2. Desktop 之前历史加载不完整的一个明确原因是新版 OpenCode 不再接受旧数据库里的 `project.vcs = "none"`。
3. 日志中曾出现：
   - `Expected "git", got "none"`
   - 调用栈在 `Project.list`
4. 已把 5 条旧项目记录的 `vcs = "none"` 修为 `NULL`。修复后 CLI 可以正常列出 session。
5. 仍未完全收口的问题：
   - `opencode.global.dat` 中 `globalSync.project` 仍只有 4 个项目。
   - `server.projects.local` 有 26 个项目。
   - 一些 `layout.page.lastProjectSession` 指向的 session id 在当前 DB 中找不到，说明还有一批旧会话可能只在旧文件存储或旧缓存中，没有进入当前 SQLite DB。

## 已做备份

本轮修复前备份目录：

```text
C:\Users\quzhi\AppData\Roaming\ai.opencode.desktop\repair-backups\fix-project-vcs-none-20260517-143000
```

包含：

```text
opencode.db
opencode.db-shm
opencode.db-wal
opencode.global.dat
```

此前已知 BOM 修复备份：

```text
C:\Users\quzhi\AppData\Roaming\ai.opencode.desktop\repair-backups\remove-global-bom-20260517-140000\opencode.global.dat
```

## 已执行的修复

修复脚本：

```text
C:\Users\quzhi\Documents\New project\repair-opencode-project-vcs.js
```

实际修改：

```sql
update project set vcs = NULL where vcs = 'none';
```

被修改的 5 条项目：

```text
/
C:\
E:\BaiduSyncdisk\koni电脑\创业\模拟器\医保模拟器
E:\BaiduSyncdisk\koni电脑\毕业论文\初稿\数据\opencode-test
G:\我的云端硬盘\品牌星球\巨量引擎
```

修复后只读复查结果：

```json
{
  "none": 0,
  "projects": 17,
  "sessions": 147,
  "messages": 6585,
  "parts": 18670
}
```

CLI 验证命令能正常返回会话：

```powershell
& 'C:\Users\quzhi\AppData\Roaming\npm\opencode.cmd' session list --format json --max-count 5
```

返回了会话，例如：

```text
ses_1db374d96ffe8j6ryPXExD5J67  答辩PPT制作技能与计划设计
ses_1de72ad47ffe3gblofOiuzyJ7b  C盘和F盘空间清理与迁移建议
ses_3b23cfd70ffep8YfPvsHfbuRHv  输出两份图表：sampling_score_and_weights.png 的 svg 与 png 版本
```

## 本轮排查证据

### Desktop 缓存状态

`opencode.global.dat` 当前关键状态：

```text
server.projects.local: 26 个项目
globalSync.project: 4 个项目
layout.page.lastProjectSession: 约 18 个条目
```

`globalSync.project` 仍只有：

```text
E:\BaiduSyncdisk\koni电脑\创业\模拟器\医保模拟器\medpay-sandbox
E:\BaiduSyncdisk\koni电脑\创业\科研小工具\BP\thesis-skills-git
E:\BaiduSyncdisk\koni电脑\创业\easy-paper\comet
E:\BaiduSyncdisk\koni电脑\创业\科研小工具\word-best
```

### Desktop 代码逻辑理解

从 `D:\Program Files\opencode\resources\app.asar` 中抽到的关键逻辑：

- Desktop 启动后会对左栏项目调用：

```js
globalSync.project.loadSessions(project.worktree)
```

- `loadSessions` 内部调用：

```js
globalSDK.client.session.list({ directory, roots: true, limit })
```

- `Project.list` 会读取 DB 的 `project` 表，并把 `vcs` 解码为：

```js
ProjectVcs = Schema.Literal("git")
```

因此旧值 `none` 会导致 `Project.list` 抛错。

### 日志证据

相关日志路径：

```text
C:\Users\quzhi\.local\share\opencode\log
```

修复前日志中出现：

```text
ERROR service=server error=Expected "git", got "none"
Project.list
```

修复后 CLI `session list` 可正常读库。

## 仍需继续调查的问题

### 1. Desktop 的 `globalSync.project` 没有刷新到 17 个 DB 项目

虽然 DB 的 `vcs='none'` 兼容性问题已修复，`opencode.global.dat` 中 `globalSync.project` 仍停在 4 个项目。下一步建议：

1. 关闭 OpenCode Desktop。
2. 备份 `opencode.global.dat`。
3. 只清理或重建 `globalSync.project` 这个缓存键，避免动 session/message DB。
4. 重启 Desktop，观察是否从服务端 `project.list` 重新拉取完整项目。

不要直接删除整个 Desktop 数据目录，除非用户明确同意。

### 2. 部分 `lastProjectSession` 指向的 session 不在当前 DB

已发现多个缓存中的 session id 在 DB 中不存在，例如：

```text
ses_2f19d76c8ffe606FbLMV0AIeeq
ses_33d5ed8d2ffewLpn5D3lNtV9Da
ses_33cd37501ffeOTrdHw8wEtqzXu
ses_28d4a0aa5ffeZ2Zc1PJpuIKPLt
ses_2fbf4ae93ffeYao3rJsPX2qrgu
ses_255c41653ffegs8bZiVn142NYu
```

这些 id 在旧文件存储中似乎有痕迹，例如：

```text
C:\Users\quzhi\.local\share\opencode\storage\agent-usage-reminder\*.json
C:\Users\quzhi\.local\share\opencode\storage\session
C:\Users\quzhi\.local\share\opencode\storage\message
C:\Users\quzhi\.local\share\opencode\storage\part
```

下一步需要判断：

- 旧 `storage/session` 中是否有完整 session info。
- 旧 `storage/message` 和 `storage/part` 中是否有这些 session 的消息内容。
- 是否需要用 OpenCode 自带 migration/import 逻辑，或手动把旧文件存储迁移进 SQLite。

### 3. 一些左栏项目本来就没有 DB 会话

对比结果显示，左栏 26 个项目中，有些确实没有当前 DB session，例如：

```text
C:\Users\quzhi\Documents\New project
E:\TRG
E:\BaiduSyncdisk\koni电脑\创业\科研小工具\my-agent
E:\BaiduSyncdisk\koni电脑\创业\科研小工具\token-kill
E:\BaiduSyncdisk\koni电脑\创业\科研小工具\skills
E:\BaiduSyncdisk\koni电脑\创业\token-pin
```

这些如果用户确认以前没有对话，就不需要恢复。不要把所有“空项目”都当作损坏。

## 可复用脚本

本轮在当前工作区创建了这些只读/辅助脚本：

```text
C:\Users\quzhi\Documents\New project\inspect-opencode-db.js
C:\Users\quzhi\Documents\New project\analyze-opencode-history.js
C:\Users\quzhi\Documents\New project\read-asar.js
C:\Users\quzhi\Documents\New project\repair-opencode-project-vcs.js
```

用途：

- `inspect-opencode-db.js`: 看 DB schema、表计数、样例。
- `analyze-opencode-history.js`: 对比 DB session、Desktop 项目缓存和 last session。
- `read-asar.js`: 从 `app.asar` 中列文件、grep、抽代码片段。
- `repair-opencode-project-vcs.js`: 已用来把 `vcs='none'` 修成 `NULL`。

## 建议下一步

1. 先让用户确认现在 Desktop 里哪些项目仍然空，优先处理用户最关心的几个项目。
2. 关闭 OpenCode Desktop。
3. 再备份一次 DB 和 `opencode.global.dat`。
4. 只读扫描旧文件存储：

```text
C:\Users\quzhi\.local\share\opencode\storage\session
C:\Users\quzhi\.local\share\opencode\storage\message
C:\Users\quzhi\.local\share\opencode\storage\part
```

5. 对缺失 session id 做三边对照：

```text
Desktop lastProjectSession -> SQLite session -> storage/session,message,part
```

6. 如果旧文件中有完整内容，再设计迁移方案。迁移前必须先在 DB 副本上验证。
7. 如只剩 Desktop 缓存不刷新，可只清理 `globalSync.project` 缓存键，让 Desktop 重新 bootstrap。

## 当前运行状态

本轮最后已重启 OpenCode Desktop。进程曾显示：

```text
D:\Program Files\opencode\OpenCode.exe
```

CLI 验证通过，但 Desktop UI 是否已经完全刷新还没有由用户最终确认。

