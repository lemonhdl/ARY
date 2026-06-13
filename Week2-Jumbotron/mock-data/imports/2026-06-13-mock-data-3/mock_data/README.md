# mock_data —— DevCompass Racing / Jumbotron 模拟数据

> 依据 `6.8/` 下四份材料制作：`Jumbotron信息架构.md`、`Jumbotron子系统定义.md`、`6.8课程笔记.md`、`jumbotron.hifi.png`。
> 目标：提供一套**严格符合数据契约、字段完整、交叉一致**的赛马大屏 mock data，可直接喂给 Jumbotron / Race Live View。
> 规模：**12 个 rider / Racing Entry**（≥10），覆盖文档定义的全部数据对象与枚举。

## 文件清单

| 文件 | 契约 / 角色 | 文档出处 |
|---|---|---|
| [`race-snapshot.json`](race-snapshot.json) | **DCR `RaceSnapshot`**（Adapter 输入）：Competition + KPI + 12 Racing Entry + 12 Riding Message + 13 Attention Item | 信息架构 §3、§7 |
| [`racing-entry-snapshots.json`](racing-entry-snapshots.json) | **`RacingEntrySnapshot[]`**（Adapter 输出 / 运行时直接消费），共 12 条 | 子系统定义 §5.2 |
| [`tracks/grandstand-oval/track.profile.json`](tracks/grandstand-oval/track.profile.json) | **`TrackProfile`** 赛道几何（16 点闭合中心线 + **12 车道** + checkpoints + 气泡区） | 子系统定义 §5.1、§9.1 |
| [`tracks/grandstand-oval/notes.md`](tracks/grandstand-oval/notes.md) | 赛道校准说明 + 资产冻结清单 | 子系统定义 §8 |
| [`index.js`](index.js) | ESM 入口：导入 JSON，导出 `raceSnapshot / entries / kpi / top3 / trackProfile / pickBubbles(...)` 等切片 | —— |
| [`race-timeline.json`](race-timeline.json) | **赛事时序帧序列**（§5.4 Snapshot 序列）：8 帧动态过程，末帧严格=race-snapshot | 子系统定义 §5.4 |
| [`build-timeline.mjs`](build-timeline.mjs) | 时序生成器（单一来源，`node build-timeline.mjs` 可复跑，自带自洽校验） | —— |

## 数据对象 → 文档契约对照

| 数据对象 | 字段来源 | 关键枚举（全部已合法取值） |
|---|---|---|
| Competition | IA §3.1 | liveStatus |
| Racing Entry（rich，12 条） | IA §3.2 + §3.8 | `motionState` ∈ idle/running/sprinting/slowed/blocked/pit_stop/takeover/finished/stale；`riskLevel` ∈ none/low/medium/high；`primaryCA/caProvider` ∈ codex/claude/other |
| Competition KPI | IA §3.3 | —— |
| Riding Message（12 条） | IA §3.4 | `type` ∈ progress_update/milestone/strategy_change/quality_signal/risk_alert/obstacle/violation/takeover/pit_stop；`displayMode` ∈ bubble/ticker |
| Attention Item（13 条） | IA §3.5 | `category` ∈ risk/obstacle/violation；`severity` ∈ low/medium/high/critical；`status` ∈ open/ack/resolved |
| RacingEntrySnapshot（12 条） | 子系统定义 §5.2 | `status` ∈ idle/running/blocked/pit_stop/takeover/finished/stale（**不含** sprinting/slowed）；`currentPhase` ∈ PRD/DEV/REL/OPS/PM |
| TrackProfile | 子系统定义 §5.1 | direction；centerline.type=polyline；smoothing=catmull-rom |

> 状态分工：`motionState`（§3.8 展示态，9 种）留在 rich Racing Entry；`status`（§5.2 快照生命周期态，7 种）进 RacingEntrySnapshot。sprinting/slowed 是 track-runtime 由进度差派生的展示态，不写进快照 status。

## 12 个 rider 数据一览

| Rank | Entry / Project | Rider | Lane | roundProgress | CA | status / motion | risk | gap |
|---|---|---|---|---|---|---|---|---|
| 1 | AI Sudoku | 林知衡 | lane-6 | 0.930 | claude | running / **sprinting** | none | 领先 |
| 2 | DevCompass Racing | 周聿明 | lane-1 | 0.872 | codex | running | none | +12.47s |
| 3 | Travel AIAR | 苏曼 | lane-9 | 0.845 | claude | running | medium | +18.75s |
| 4 | Study Copilot | 高维 | lane-3 | 0.808 | codex | running / slowed | low | +27.30s |
| 5 | DocPilot | 陈彦 | lane-12 | 0.760 | claude | **blocked** | high | +41.60s |
| 6 | CodeLab | 罗骁 | lane-5 | 0.728 | codex | running / **sprinting** | medium | +49.20s |
| 7 | DataForge | 江照 | lane-2 | 0.690 | codex | **pit_stop** | medium | +1:03.50 |
| 8 | PixelMind | 韩沐 | lane-8 | 0.655 | claude | running | none | +1:18.90 |
| 9 | ChatOps Hub | 邱泽 | lane-11 | 0.612 | codex | **takeover** | high | +1:35.20 |
| 10 | FinSight | 文澜 | lane-4 | 0.560 | claude | running / slowed | medium | +1:58.40 |
| 11 | MediScribe | 叶临 | lane-7 | 0.515 | claude | **stale** | high | +2:22.60 |
| 12 | GreenRoute | 秦野 | lane-10 | 0.470 | codex | **idle** | low | +2:51.30 |

赛事级（与高保真图一致）：完成度 **68%** · 总 Tokens **12.84M** · Codex **7.56M (58.9%)** · Claude **5.28M (41.1%)** ·
在线选手 **24/36** · 活跃骑手 12 · ROUND 3 · 已用时 01:24:37 · 系统时间 10:21:38 · 主题 Agentic Development。

> 12 条 entry 覆盖了 §5.2 status 的 6 种（running/blocked/pit_stop/takeover/stale/idle）与 §3.8 motionState 的 8 种，
> 以及 currentPhase 全部 5 种（PRD/DEV/REL/OPS/PM）、message type 7 种、attention 三大类别与多档 severity——便于验证 UI 各分支。

## 时序动态过程（race-timeline.json）

把单帧快照扩成 **13 帧时序序列**（§5.4 Snapshot 序列），分**起跑 / 比赛 / 冲线**三段，可"播放"出发车、追赶反超、风险出现、状态切换、直到冲线夺冠。`currentFrameIndex=9` 标记**当前直播帧**并严格等于 `race-snapshot.json`；冲线段发生在它**之后**（不是把快照改成冲线）。

- **帧**：idx0..12，时间 10:16:40 → 10:22:22（非等距，见各帧 `systemTime/elapsedTime/phase`）。`phase` ∈ `start`(0..1) / `race`(2..9) / `finish`(10..12)。
- **每帧 entry**：仅含动态字段 `rank / rankDelta(相对上帧) / roundProgress / status / motionState`；静态字段按 `entryId` 从 `race-snapshot.json` 取。
- **每帧 events**：`race_start` / `overtake`（含 `passed` 名单）/ `status_change`（含 `kind`: risk/pit_stop/**finish**/info）/ `lead_change`。
- **冲线 finished**：领先者冲过终点进入 `finished`（§3.8/§5.2 收尾特殊态），名次按冲线先后锁定。

剧情看点（共 **19 个事件、3 次 TOP3 变化、3 队冲线**）：

| 帧 | 时间 | 段 | 关键动态 |
|---|---|---|---|
| idx0 | 10:16:40 | 起跑 | **发车**！12 队从 ~0 起步 |
| idx4 | 10:19:20 | 比赛 | CodeLab 连超 PixelMind、ChatOps；DataForge 超 ChatOps |
| idx5 | 10:20:00 | 比赛 | DataForge 超 PixelMind；ChatOps 远程接管 takeover |
| idx6 | 10:20:40 | 比赛 | MediScribe 掉线 stale |
| idx7 | 10:21:10 | 比赛 | **DevCompass 反超 Travel 抢第 2**；DocPilot 卡死 blocked；DataForge 进站 pit_stop |
| idx8 | 10:21:30 | 比赛 | **Travel 夺回第 2** |
| **idx9** | 10:21:38 | **当前** | **DevCompass 再反超夺第 2（= race-snapshot 当前画面）**；GreenRoute 转待机 idle |
| idx10 | 10:21:55 | 冲线 | 末段冲刺；CodeLab 超 DocPilot、PixelMind 超 DataForge |
| idx11 | 10:22:08 | 冲线 | **AI Sudoku 冲线 finished（夺冠）**；FinSight 超 ChatOps |
| idx12 | 10:22:22 | 冲线 | **DevCompass、Travel 冲线 finished（锁定 2/3 名）**；PixelMind 超 DocPilot |

净名次变化（开赛 idx2 → 当前 idx9）：DevCompass +1 / CodeLab +2 / DataForge +2 上升，Travel −1 / PixelMind −2 / ChatOps −2 下降——已回写为 `race-snapshot.json` 各 entry 的 `rankDelta`，保证当前快照与时间线一致。

## 已做的交叉校验（node 全量交叉校验）

- 每匹马 `codexUsage + claudeUsage = tokenCost`；全场 **Σ tokenCost = 12.84M**、**Σ codex = 7.56M**、**Σ claude = 5.28M**。
- 每匹马 `primaryCA` 对应的用量 > 另一方（codex 主则 codexUsage 更大，反之亦然）。
- `overallProgress` 12 项均值 = **0.68** = `completionRate`；`codexShare/claudeShare` = 对应占比且和 ≈ 1。
- `activeRiders(12) = entries 数`；`rank` 1..12 唯一；`score/roundProgress/gap` 与 `rank` 严格单调；`Σ rankDelta = 0`（名次互换守恒）。
- `laneId` 取遍 lane-1..lane-12 互不重复，且全部存在于 `track.profile.json`（profile 提供 12 条 offset 不重复的车道）。
- KPI `riskCount/obstacleCount/violationCount`（6/4/3）= `attentionItems` 各类别计数；逐 entry 的 obstacle/violation 计数与挂在其上的 attention 一致。
- 每个 entry 恰有 1 条 `latestMessage` 且 `latestMessageId` 能在 `messages` 中解析。
- 所有枚举字段取值合法；`RacingEntrySnapshot.status` 不含 sprinting/slowed；`racing-entry-snapshots.json` 与 `race-snapshot.json` 对应字段镜像一致。
- `TrackProfile` 通过《子系统定义》§9.1 静态校验（闭合 16 点 / s∈[0,1] / 12 车道 offset 不重复 …）。

复跑校验：`mock_data/` 下 `node`（脚本见交付说明），输出 `ALL 75 CHECKS PASSED`。

## 接入方式

```js
// 打包器 / Vite / Svelte（项目实际消费路径，支持 JSON import）
import { raceSnapshot, entries, kpi, top3, trackProfile, pickBubbles } from './mock_data';

// 位置由数据派生：trackProfile.centerline + entry.roundProgress 交给 track-runtime 计算 HorsePose
// 气泡降噪：pickBubbles(3) —— 每匹马最多 1 条、全局最多 3 条、risk_alert/milestone 优先

// 时序动态过程（起跑→追赶反超→风险→冲线，13 帧）
import { raceTimeline, frameAt, top3At, eventsAt, currentFrame, currentFrameIndex } from './mock_data';
currentFrame;            // 当前直播帧（idx9，= race-snapshot 状态）
frameAt(7);              // idx7 = DevCompass 反超 Travel 抢第 2 的时刻
frameAt(11);             // idx11 = AI Sudoku 冲线 finished（夺冠）
top3At(11);              // 该帧 TOP3（entryId 数组）
eventsAt(11);            // 该帧事件：overtake / status_change(kind=finish) / lead_change
```

纯数据消费直接读 `*.json`。Adapter 链路：`race-snapshot.json` →(Jumbotron Adapter)→ `racing-entry-snapshots.json`。

## 约束（课程铁律）

- 位置**不写死 x/y**，由 `roundProgress → s → 采样中心线 → 切线/法线 → lane offset` 派生；补间在 **s 轴**。
- 底图只负责视觉，几何（centerline）才负责定位；排名/进度不能从图片反推。
- 无新数据则原地待机或转 `stale`（见 MediScribe），不伪造连续推进。
