# Session 04：Jumbotron 赛马大屏 mock data 与时序帧序列

> 工作目录：与 ARY 同级的 `6.8/mock_data/`（6.8 是 GRS 课程「下半场」启动的 Jumbotron / DevCompass Racing 子系统）。
> 本轮把 6.8 的 Jumbotron 文档落成一套可接入 Race Live View 的 mock data，并扩展成可回放的时序帧序列。

## 目标

- 依据 6.8 的 Jumbotron 文档（信息架构、子系统定义、课程笔记、高保真图）制作 mock data。
- 严格对齐文档数据契约：字段完整、枚举合法、交叉一致。
- 规模 ≥ 10 个 rider。
- 在单帧快照之上扩展出时序帧序列，表现起跑、追赶反超、风险、状态切换、冲线。

## Step 1：读 Jumbotron 文档，建首版 mock data

### Prompt

根据 6.8 下的文档制作 mock data，内容放在新建的 `mock_data` 下，要考虑数据接入后的视觉美观。

### Agent Output

读取四份材料：`Jumbotron信息架构.md`、`Jumbotron子系统定义.md`、`6.8课程笔记.md`、`jumbotron.hifi.png`。

梳理出数据对象与契约出处：

- Competition（IA §3.1）、Racing Entry（IA §3.2 + §3.8 motionState）、Competition KPI（IA §3.3）
- Riding Message（IA §3.4）、Attention Item（IA §3.5）
- Track Profile（子系统定义 §5.1）、RacingEntrySnapshot（§5.2）、HorsePose（§5.3）

按高保真图的 6 匹马建首版，目录：

- `6.8/mock_data/race-snapshot.json`（DCR RaceSnapshot）
- `6.8/mock_data/racing-entry-snapshots.json`（RacingEntrySnapshot[]）
- `6.8/mock_data/tracks/grandstand-oval/track.profile.json`（赛道几何 + notes.md）
- `6.8/mock_data/index.js`、`README.md`、`preview.html`

### Steering

铁律来自 6.8 课程笔记：马匹位置不写死 x/y，由 `roundProgress → 采样中心线 → 切线/法线 → lane offset` 派生；底图只负责视觉，几何（centerline）负责定位。

### Result

首版 6 entry，node 校验通过。

## Step 2：改用中文思考，聚焦数据契约，扩到 ≥10 rider

### Prompt

任何问题都要用中文回答，包括思考过程；关注点是 mock_data 而不是视觉效果，要重点看文档里关于数据的要求，重新做；数据至少包括 10 个 rider。

### Agent Output

重做为 **12 个 rider / Racing Entry**，逐字段对齐契约。重写：

- `race-snapshot.json`：Competition + KPI + 12 Racing Entry + 12 Riding Message + 13 Attention Item
- `racing-entry-snapshots.json`：12 条 RacingEntrySnapshot（§5.2，status 仅取快照枚举，sprinting/slowed 留在 motionState）
- `track.profile.json`：扩到 12 车道（offset 不重复）

12 个 rider / 项目：AI Sudoku(林知衡)、DevCompass Racing(周聿明)、Travel AIAR(苏曼)、Study Copilot(高维)、DocPilot(陈彦)、CodeLab(罗骁)、DataForge(江照)、PixelMind(韩沐)、ChatOps Hub(邱泽)、FinSight(文澜)、MediScribe(叶临)、GreenRoute(秦野)。

赛事级 KPI（与高保真图一致）：完成度 68%、总 Tokens 12.84M、Codex 7.56M(58.9%)、Claude 5.28M(41.1%)、在线 24/36、活跃骑手 12。

### Steering

数据契约符合性与自洽性优先于演示视觉。穷尽文档里的对象/字段/枚举，再谈视觉。

### Result

node 跑 75 项交叉校验全过：

- 每匹马 codexUsage + claudeUsage = tokenCost；全场 Σ = 12.84M、Σcodex = 7.56M、Σclaude = 5.28M
- overallProgress 均值 = 完成度 0.68；primaryCA 对应用量更大
- rank 1..12 唯一，score / roundProgress / gap 与 rank 单调；Σ rankDelta = 0
- laneId 取遍 lane-1..lane-12 不重复且都存在于 track.profile.json
- KPI 风险/阻碍/违章计数 = attentionItems 各类别计数（6/4/3），逐 entry 计数吻合
- 枚举合法；RacingEntrySnapshot.status 不含 sprinting/slowed；快照与 snapshot 镜像一致

## Step 3：说明产出

### Prompt

讲讲你生成了哪些 mock data。

### Agent Output

1 个 Competition + 1 组 KPI + 12 个 Racing Entry + 12 条 Riding Message + 13 条 Attention Item + 1 份 Track Profile（16 点闭合椭圆中心线 + 12 车道 + checkpoints + 气泡区）+ 12 条 RacingEntrySnapshot（Adapter 输出）。

## Step 4：扩展时序动态过程

### Prompt

数据能不能按时序表现出队伍前进的动态过程，包括 Top3 排名变化、队伍追赶反超、出现风险、不同状态等动态变化。

### Agent Output

新增生成器 `6.8/mock_data/build-timeline.mjs`（单一事实来源），产出 `6.8/mock_data/race-timeline.json`：

- 8 帧 Snapshot 序列（§5.4），最后一帧严格收敛到 race-snapshot.json
- 每帧仅含动态字段 rank / rankDelta / roundProgress / status / motionState + events
- 事件类型：overtake（含 passed 名单）/ status_change（kind: risk/pit_stop/info）/ lead_change

生成器同时把 race-snapshot.json 各 entry 的 rankDelta 回写为「净名次变化」，使最终快照与时间线一致。`index.js` 增加 frames / frameAt / top3At / eventsAt / top3Changes。

### Steering

帧间需严格自洽（进度单调、每帧 rank 为 1..N 置换、末帧 = 快照），采用单源 node 生成 + 确定性校验，而非多副本手写。

### Result

8 帧，3 次 Top3 拉锯（DevCompass 与 Travel 争第 2）、CodeLab/DataForge 中段连超、DocPilot blocked / DataForge pit_stop / ChatOps takeover / MediScribe stale。node 校验通过。

## Step 5：移除 preview.html

### Prompt

不需要 preview.html，只要提供数据。

### Agent Output

不再维护可视化预览，`preview.html` 移除。校验脚本去掉 preview 漂移检查，保留纯数据 + 时序对齐校验。

### Steering

交付聚焦数据本身，不做可视化页面。

### Result

数据 + 时序校验全过。

## Step 6：补起跑与冲线帧，引入 finished 状态

### Prompt

起始开跑和最后冲线补几帧，主要是冲线，因为冲线还列了一个特殊状态（finished）出来，也算一个点。

### Agent Output

重写 `build-timeline.mjs`，时间线扩成 **13 帧三段**：

- 起跑 start（idx0..1，10:16:40 起，roundProgress 从 ~0 起步，带 race_start 事件）
- 比赛 race（idx2..9）
- 冲线 finish（idx10..12）

关键设计：`currentFrameIndex = 9` 标记「当前直播帧」并严格等于 race-snapshot.json；冲线段发生在它之后，而不是改写快照。

新增逻辑：

- finished 状态：AI Sudoku 冲线（idx11），DevCompass、Travel 随后冲线（idx12），status/motionState = finished、roundProgress = 1.0
- 名次锁定：已冲线者按 finishFrame 升序排前，未冲线者按 roundProgress 排，平局按固定 ORDER
- 冲线段反超：健康队越过卡死/进站/掉线队（CodeLab 超 DocPilot、PixelMind 超 DataForge/DocPilot、FinSight 超 ChatOps）
- 事件类型新增 race_start，status_change 增加 kind=finish
- `index.js` 增加 currentFrame / currentFrameIndex；README 时序章节更新为 13 帧三段

九种状态全部覆盖：idle / running / sprinting / slowed / blocked / pit_stop / takeover / stale / finished。

### Steering

race-snapshot.json 是「当前直播画面」（AI 仍在 0.93 推进），所以它对应时间线中间帧（idx9），冲线是其之后的演化，不能把快照本身改成冲线。

### Result

13 帧，node 跑 53 项断言全过：

- 每帧 rank 为 1..12 置换；每队进度逐帧单调不减
- idx9 全字段严格等于 race-snapshot.json（rank / roundProgress / status / motionState）
- 冲线段 3 队 finished 且 roundProgress = 1.0、占据前 3 名
- 起跑帧进度 < 0.2；净 rankDelta（开赛 idx2 → 当前 idx9）与快照一致、Σ = 0
- 19 个事件（含 race_start ×1、finish ×3）、3 次 Top3 变化

## Step 7：总结 Riding Record 并推送

### Prompt

根据与 6.8 同级的 ARY 仓库，参考已有的 riding-record / coding-agent-sessions，总结本次 riding-record，推送到 riding-record-jhy 分支。

### Agent Output

先 fetch 校验本地 `riding-record-jhy` 与 `origin/riding-record-jhy` 一致（0/0）、工作区干净；再参考 session-03 格式写本文件 `session-04-jumbotron-mockdata-claude-code.md`，并在 `INDEX.md` 增加索引。

### Result

本次交付物（均在 `6.8/mock_data/`）：

- `race-snapshot.json`：DCR RaceSnapshot（当前直播帧）
- `racing-entry-snapshots.json`：12 条 RacingEntrySnapshot（Adapter 输出）
- `tracks/grandstand-oval/track.profile.json` + `notes.md`：赛道几何
- `race-timeline.json`：13 帧时序帧序列（起跑 / 比赛 / 冲线）
- `build-timeline.mjs`：时序生成器（可复跑，自带自洽校验）
- `index.js`：ESM 入口（含 frameAt / top3At / eventsAt / currentFrame）
- `README.md`：用法、契约对照、时序剧情、校验说明

提交记录推送到 `riding-record-jhy` 分支。
