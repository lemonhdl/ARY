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

## 已做的交叉校验（node 跑通 75 项断言）

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
```

纯数据消费直接读 `*.json`。Adapter 链路：`race-snapshot.json` →(Jumbotron Adapter)→ `racing-entry-snapshots.json`。

## 约束（课程铁律）

- 位置**不写死 x/y**，由 `roundProgress → s → 采样中心线 → 切线/法线 → lane offset` 派生；补间在 **s 轴**。
- 底图只负责视觉，几何（centerline）才负责定位；排名/进度不能从图片反推。
- 无新数据则原地待机或转 `stale`（见 MediScribe），不伪造连续推进。
