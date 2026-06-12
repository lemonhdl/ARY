# DevCompass Racing Jumbotron 子系统定义

> 本文从 Horse-Racing PoC 工程方案中拆取 Jumbotron 子系统定义。  
> Jumbotron 子系统由运行时 **Jumbotron / Race Live View** 与设计时 **Track Profile Calibrator** 组成，目标是让赛马主视觉可以被稳定资产、可信几何和 DCR 快照数据驱动。

---

## 1. 子系统定位

Jumbotron 子系统是 DevCompass Racing 的赛事主视觉子系统。

它负责把 DCR 的赛事快照数据、赛道资产和 Riding Message 映射为一套可在 16:9 大屏上展示的 horse-racing live screen。

```text
DCR RaceSnapshot
  → Jumbotron Adapter
  → RacingEntrySnapshot[]
  → track-runtime
  → Jumbotron / Race Live View
```

同时，它提供设计时 Calibrator，用于把 AI 生成或人工绘制的赛道底图校准为可运行的 `track.profile.json`。

```text
AI / Design Track Background
  → Track Profile Calibrator
  → track.profile.json
  → track-runtime
  → Jumbotron / Race Live View
```

---

## 2. 子系统组成

```text
Jumbotron Subsystem
├── Runtime Side
│   ├── Jumbotron / Race Live View
│   ├── Jumbotron Adapter
│   ├── track-runtime
│   ├── ui-primitives
│   └── mock-racing-data
│
├── Design-time Side
│   ├── Track Profile Calibrator
│   ├── Track Profile Validator
│   └── AI-assisted Asset Pipeline
│
└── Shared Assets / Contracts
    ├── track-profile schema
    ├── track.profile.json
    ├── background.webp
    ├── preview.png
    └── RacingEntrySnapshot contract
```

### 2.1 Jumbotron / Race Live View

运行时大屏主视觉。

职责：

- 展示赛事标题、LIVE、Round / Phase、计时；
- 展示赛事 KPI：总进度、活跃骑手、Tokens、Codex / Claude 使用；
- 展示赛道主视觉；
- 根据 `RacingEntrySnapshot.roundProgress` 渲染马匹位置；
- 展示马匹编号、项目 / 骑手标签、TOP3、高亮 Entry；
- 展示 Riding Message 气泡；
- 展示底部 ticker 中的 Riding Message、风险和违规提醒；
- 支持 debug mode 验证几何、路径、车道和 stale 状态。

Jumbotron 不负责：

- 真实后端聚合；
- 权限、房间、Workshop 上下文；
- 排名语义最终定义；
- Remote Racing Cockpit 协作流程；
- 复杂 3D 或真实物理模拟。

### 2.2 Track Profile Calibrator

设计时赛道校准工具。

职责：

- 导入赛道底图；
- 创建或导入候选 Track Profile；
- 编辑 centerline points；
- 设置赛道方向；
- 设置起点 / 终点；
- 配置 lane offsets；
- 配置 checkpoints；
- 预览单马和多马运行；
- 预览消息气泡；
- 运行 validation；
- 导出冻结后的 `track.profile.json`。

Calibrator 不是运行时 UI。它是设计 / 资产生产工具。

### 2.3 track-runtime

Jumbotron 与 Calibrator 共享的核心运行包。

职责：

- 加载和校验 Track Profile；
- 将 centerline 转换为可采样路径；
- 计算路径长度；
- 根据 `s` 采样中心点；
- 计算切线方向；
- 计算法线方向；
- 应用 lane offset；
- 计算 horse pose；
- 管理 horse animation state；
- 提供 message bubble 的候选位置；
- 提供 runtime validation。

关键原则：Calibrator 预览必须复用 `track-runtime`，不能另写一套预览逻辑。

```text
track.profile.json
  → track-runtime
      ├── Jumbotron / Race Live View
      └── Track Profile Calibrator Preview
```

### 2.4 Jumbotron Adapter

DCR 主项目与 horse-racing runtime 之间的适配层。

输入：

```text
RaceSnapshot
  - competition metadata
  - KPI summary
  - racing entries
  - recent messages
  - risks / violations
```

输出：

```text
RacingEntrySnapshot[]
RidingMessageSnapshot[]
AttentionItem[]
```

职责：

1. 选择用于赛道位置的进度字段；
2. 默认使用 `roundProgress`；
3. 在只有 `overallProgress` 时显式标记临时映射；
4. 映射 CA provider；
5. 映射风险状态；
6. 分配 lane；
7. 处理缺失数据；
8. 处理 stale；
9. 提取 Riding Message。

---

## 3. 运行时 Jumbotron IA

```text
Jumbotron / Race Live View
├── Header
│   ├── Event Title
│   ├── LIVE
│   ├── Round / Phase
│   └── Time
│
├── KPI Strip
│   ├── Total Progress
│   ├── Active Riders
│   ├── Total Tokens
│   └── Codex / Claude Split
│
├── Main Track Area
│   ├── Background
│   ├── Track Overlay optional
│   ├── Horse Markers
│   ├── Message Bubbles
│   └── Checkpoints
│
├── Side / Floating Ranking
│   ├── Top 3
│   └── Highlighted Entry
│
└── Bottom Ticker
    ├── Riding Messages
    └── Risk / Violation Alerts
```

### 3.1 Debug Mode

Jumbotron Prototype 必须支持 debug mode，用于验证资产和运行时逻辑。

```text
- show centerline
- show sampled points
- show lane offsets
- show checkpoints
- show horse s value
- show collision boxes
- show stale entries
```

---

## 4. Calibrator IA

```text
Track Profile Calibrator
├── Top Toolbar
│   ├── Import Background
│   ├── Import Candidate Profile
│   ├── Validate
│   ├── Preview
│   └── Export
│
├── Main Canvas
│   ├── Background Layer
│   ├── Centerline Layer
│   ├── Control Points Layer
│   ├── Lane Preview Layer
│   ├── Checkpoint Layer
│   ├── Horse Preview Layer
│   └── Message Bubble Preview Layer
│
├── Right Inspector
│   ├── Track Info
│   ├── Geometry
│   ├── Start / Finish
│   ├── Direction
│   ├── Lanes
│   ├── Checkpoints
│   ├── Message Bubble
│   └── Validation Results
│
└── Bottom Preview Bar
    ├── Progress Scrubber
    ├── Horse Count
    ├── Speed
    ├── Play / Pause
    └── Scenario Presets
```

### 4.1 Calibrator MVP 功能

1. 导入底图；
2. 加载 / 创建 Track Profile；
3. 添加、删除、拖拽 centerline points；
4. 平滑路径预览；
5. 闭合路径；
6. 一键反转路径方向；
7. 设置起点；
8. 配置 lane offsets；
9. 配置 checkpoints；
10. 通过 scrubber 预览一匹马从 0% 到 100%；
11. 预览多匹马；
12. Validate；
13. Export JSON。

### 4.2 Calibrator P1 功能

1. 气泡区域编辑；
2. no bubble zone 编辑；
3. 风险区域编辑；
4. AI 候选点导入；
5. 自动检测尖角；
6. 自动分配 lanes；
7. 导出 debug-preview.png；
8. JSON diff preview。

---

## 5. 共享数据契约

### 5.1 Track Profile

Track Profile 是赛道的语义资产，也是运行时事实来源。

它描述：

- 画布尺寸；
- 背景图；
- 中心线；
- 路径是否闭合；
- 方向；
- 起终点；
- 马道偏移；
- checkpoints；
- 气泡区域；
- 风险区域；
- 调试信息。

推荐格式：

```text
TrackProfile
├── schemaVersion
├── trackId
├── name
├── viewBox
├── background
├── centerline
│   ├── type
│   ├── closed
│   ├── points
│   └── smoothing
├── direction
├── startFinish
├── lanes
├── checkpoints
├── messageZones
└── noBubbleZones
```

MVP 推荐 `polyline + smoothing`，而不是直接把 SVG Path 作为唯一事实。

原因：

- 更容易人工拖拽调整；
- 更容易 Git diff；
- 更容易校验异常点；
- 更容易支持一键反转；
- 更容易做路径采样表；
- 更适合 Calibrator。

### 5.2 RacingEntrySnapshot

Jumbotron runtime 消费的赛事条目快照。

```ts
export interface RacingEntrySnapshot {
  entryId: string;
  riderName: string;
  projectName: string;
  cockpitId?: string;

  caProvider: "codex" | "claude" | "other";

  rank?: number;
  overallProgress: number;
  roundProgress: number;
  phaseProgress?: number;
  currentPhase?: "PRD" | "DEV" | "REL" | "OPS" | "PM";

  costTokens?: number;
  costUsd?: number;

  riskLevel: "none" | "low" | "medium" | "high";
  obstacleCount: number;
  violationCount: number;

  status:
    | "idle"
    | "running"
    | "blocked"
    | "pit_stop"
    | "takeover"
    | "finished"
    | "stale";

  laneId?: string;
  lastMessage?: RidingMessageSnapshot;
  updatedAt: string;
}
```

### 5.3 HorsePose

`track-runtime` 输出给 Jumbotron 的马匹姿态。

```ts
export interface HorsePose {
  entryId: string;
  x: number;
  y: number;
  rotation: number;
  s: number;
  laneId: string;
  state: HorseMotionState;
  zIndex: number;
}
```

### 5.4 Snapshot 与 Event

- Snapshot 用于当前画面状态；
- Event 用于触发临时动画和消息；
- Runtime 应能只靠 Snapshot 渲染当前画面；
- Event 不应成为唯一事实来源。

---

## 6. 位置与动画规则

### 6.1 位置计算

赛马位置不能手写 `x/y`，也不能运行时从图片识别。

正确流程：

```text
RacingEntrySnapshot.roundProgress
  → normalized s
  → sampled centerline point
  → tangent vector
  → normal vector
  → lane offset
  → horse x/y/rotation
```

### 6.2 进度语义

DCR 至少有三种进度：

```text
overallProgress
  - 用于整体项目完成度

roundProgress
  - 用于 Race Live View 赛马位置

phaseProgress
  - 用于阶段检查点和局部进度
```

Jumbotron 子系统优先使用 `roundProgress` 作为赛道位置来源。

### 6.3 动画状态机

MVP 状态：

```text
idle
running
sprinting
slowed
blocked
pit_stop
takeover
finished
stale
```

动画只接受两类输入：

```text
RacingEntrySnapshot
RaceEvent
```

不直接接受 UI 指令修改位置。

### 6.4 补间策略

位置补间应在 `s` 轴上进行，而不是直接在 `x/y` 上补间。

```text
s0 → s1 → sample pose at s(t)
```

这样可以避免弯道处马匹穿越赛道内侧。

### 6.5 stale 策略

如果某个 Racing Entry 超过阈值没有更新：

```text
lastUpdatedAt > staleThreshold
  → state = stale
```

表现方式：

- 停止前进；
- 降低亮度；
- 显示 stale 或 no recent update；
- 不再做 running 动画。

---

## 7. Riding Message 展示规则

同一条 Riding Message 可以在 Race Live View 中以多种方式出现：

```text
bubble on track
bottom ticker
risk alert item
```

### 7.1 Bubble 位置

默认流程：

```text
horse pose
  → message zone lookup
  → bubble offset
  → collision check
  → final bubble position
```

如果没有合适位置，可以 fallback 到底部 ticker。

### 7.2 MVP 降噪策略

```text
每个 Racing Entry 同时最多 1 条 bubble
全局同时最多 3 条 bubble
风险 / 里程碑消息优先
普通消息进入 ticker
```

---

## 8. 资产生产与冻结

### 8.1 AI-assisted Asset Pipeline

AI 不参与运行时可信计算，只参与设计时候选资产生产。

推荐流程：

```text
1. 编写赛道视觉 prompt
2. AI 生成 16:9 赛道底图
3. AI 输出候选 centerline points
4. 导入 Calibrator
5. 人工校准路径
6. 预览多马运行
7. Validate
8. Export
9. 提交资产
```

### 8.2 资产目录规范

```text
assets/tracks/<track-id>/
  background.webp
  track.profile.json
  preview.png
  notes.md
  source.prompt.md
```

说明：

- `background.webp`：最终视觉底图；
- `track.profile.json`：运行时事实来源；
- `preview.png`：带 overlay 的预览图；
- `notes.md`：人工校准说明；
- `source.prompt.md`：AI 生成提示词和生成过程记录。

### 8.3 资产冻结规则

一个 track asset 进入 DCR 前必须满足：

1. 通过 schema validation；
2. 通过 geometry validation；
3. 通过 0% → 100% 单马预览；
4. 通过至少 8 匹马多马预览；
5. 没有明显跑出赛道；
6. checkpoint 显示正确；
7. 在 16:9 大屏下视觉稳定；
8. profile 与 background 一起提交。

---

## 9. Validation

### 9.1 Track Profile Validation

导出前必须校验：

```text
- schemaVersion 存在
- trackId 存在
- viewBox 合法
- background 存在
- centerline points 数量足够
- closed track 至少 4 个点
- open track 至少 2 个点
- direction 合法
- startFinish.s 在 0~1 范围内
- checkpoints.s 均在 0~1 范围内
- lanes 至少 1 条
- lane offsets 不重复
- path length 大于最小阈值
- sampled path 无明显 NaN / Infinity
- 相邻采样点距离无异常跳变
- 曲率或转角超过阈值时给 warning
```

### 9.2 Runtime Validation

运行时应防御：

```text
- progress 小于 0 或大于 1
- laneId 不存在
- entry 没有 updatedAt
- stale threshold 触发
- profile 版本不匹配
- background 加载失败
```

### 9.3 Visual Validation

Calibrator 提供人工确认：

```text
- 马是否跑在赛道上
- 弯道处是否自然
- 多马是否严重重叠
- 气泡是否遮挡标题 / KPI / 顶部区域
- checkpoint 是否符合视觉语义
```

---

## 10. 工程边界

### 10.1 DCR 主项目 owns

- real data source；
- Jumbotron orchestration；
- permissions / room / workshop context；
- ranking semantics；
- business events。

### 10.2 Jumbotron 子系统 owns

- track profile；
- path sampling；
- horse pose；
- animation states；
- visual race rendering；
- calibrator tooling；
- asset validation；
- Jumbotron adapter contract。

---

## 11. 推荐工程结构

```text
dcr-horse-racing-poc/
  apps/
    track-calibrator/
    race-preview/

  packages/
    track-profile/
    track-runtime/
    mock-racing-data/
    ui-primitives/

  assets/
    tracks/
      <track-id>/
        background.webp
        track.profile.json
        preview.png
        notes.md

  docs/
    track-profile-spec.md
    calibrator-design.md
    dcr-handoff.md
    asset-pipeline.md
```

---

## 12. MVP 验收口径

Jumbotron 子系统 MVP 成立，需要满足：

1. `track.profile.json` 能描述一条完整赛道；
2. Calibrator 能从候选路径微调出可用赛道；
3. Calibrator 导出的 profile 能被 Jumbotron Preview 直接使用；
4. Calibrator 和 Jumbotron Preview 使用同一套 `track-runtime`；
5. 一匹马可按 0% → 100% 沿赛道移动；
6. 多匹马可通过 lane offset 同时展示；
7. 马匹在弯道处方向自然；
8. stale / blocked / pit_stop / takeover / finished 状态可表达；
9. Riding Message 可在气泡或 ticker 中降噪展示；
10. 至少有 2 条可用示例赛道资产；
11. DCR `RaceSnapshot` 能通过 Adapter 映射到 runtime 输入。

