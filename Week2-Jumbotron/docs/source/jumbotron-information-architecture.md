# DevCompass Racing Jumbotron 信息架构

> 本文独立抽取 DevCompass Racing MVP 中的 Jumbotron 信息架构。  
> Jumbotron 是 Workshop / Hackathon / 团队协作场景下的公开大屏容器，负责展示赛事化摘要、实时态势、赛道位置、风险和协作入口；它不展示完整 Coding Agent Session 细节。

---

## 1. 定位

### 1.1 产品定义

Jumbotron 是 DevCompass Racing 的公开大屏容器。

它用于把多个项目、骑手、Racing Cockpit 和 Coding Agent 的运行状态聚合为可被现场观众、组织者、教师、助教快速理解的赛事画面。

### 1.2 核心目标

Jumbotron 需要回答五个问题：

1. 当前比赛进行到哪里？
2. 谁领先，谁在追赶？
3. 哪些项目正在发生关键动态？
4. 整体进度、资源消耗和参与情况是否健康？
5. 哪些风险、阻碍或违规需要现场关注？

### 1.3 展示边界

Jumbotron 展示摘要，不展示完整 Session。

应展示：

- 赛事标题、阶段、时间、LIVE 状态；
- Racing Entry 的排名、位置、进度、成本、风险和消息摘要；
- 赛事级 KPI；
- 实时 TOP3；
- Riding Message；
- Risk / Obstacle / Violation；
- 进入 Remote Racing Cockpit 的入口。

不应展示：

- 完整终端日志；
- 完整 Coding Agent Session；
- 长文本评论流；
- 复杂代码 diff；
- 细粒度项目管理后台；
- 需要个人授权才能展示的私密内容。

---

## 2. Display Scope

Jumbotron 是大屏容器，MVP 范围内只保留 Race Live View。

```text
Jumbotron
└── race_live
    └── jumbotron / Race Live View
```

### 2.1 race_live

Race Live View 是赛事直播视图。

它面向现场观众和组织者，强调赛道、位置、追赶关系、实时消息和现场氛围。

### 2.2 范围约束

MVP 不包含独立的第二大屏模式，不要求表格主榜或多维排行。

---

## 3. 核心信息对象

### 3.1 Competition

赛事级上下文。

```text
Competition
├── competitionId
├── title
├── subtitle
├── theme
├── organizer
├── liveStatus
├── currentPhase
├── currentRound
├── nextPhase
├── elapsedTime
└── systemTime
```

### 3.2 Racing Entry

Racing Entry 是 Jumbotron 中被展示和比较的基本单元。

它可以对应一个项目、一名 Rider、一个团队，或一个项目下的主要 Racing Cockpit。

```text
Racing Entry
├── entryId
├── displayName
├── riderName
├── projectName
├── rank
├── rankDelta
├── score
├── overallProgress
├── roundProgress
├── phaseProgress
├── tokenCost
├── primaryCA
├── codexUsage
├── claudeUsage
├── riskLevel
├── motionState
├── latestMessage
└── remoteCockpitUrl
```

### 3.3 Competition KPI

赛事级摘要指标。

```text
Competition KPI
├── completionRate
├── totalTokens
├── activeRiders
├── onlineRiders
├── activeCockpits
├── codexTokens
├── claudeTokens
├── codexShare
├── claudeShare
├── riskCount
├── obstacleCount
└── violationCount
```

### 3.4 Riding Message

来自项目、骑手或 Racing Cockpit 的过程消息。

```text
Riding Message
├── messageId
├── entryId
├── source
├── type
├── severity
├── summary
├── createdAt
├── displayMode
└── targetUrl
```

消息类型包括：

- progress_update；
- milestone；
- strategy_change；
- quality_signal；
- risk_alert；
- obstacle；
- violation；
- takeover；
- pit_stop。

### 3.5 Risk / Obstacle / Violation

Jumbotron 统一展示三类异常或注意事项。

```text
Attention Item
├── itemId
├── entryId
├── category        // risk | obstacle | violation
├── severity        // low | medium | high | critical
├── summary
├── status
├── createdAt
└── targetUrl
```

### 3.6 Track Template

Race Live View 的空间展示基础。

赛道模板由视觉底图和语义赛道共同构成。

```text
Track Template
├── trackId
├── backgroundAsset
├── viewBox
├── designSize
├── centerlinePath
├── startLine
├── finishLine
├── checkpoints
├── laneOffsets
└── safeZones
```

`backgroundAsset` 是视觉皮肤，`centerlinePath` 才是用于定位的赛道中心线。

### 3.7 Racing Position

Race Live View 中的赛马位置不是固定 `x / y` 坐标，而是由进度和赛道几何派生。

```text
Racing Position = Track Template + Progress + Lane Offset + Display Adjustment
```

默认映射规则：

```text
roundProgress → centerlinePath distance → point → rotation → laneOffset → displayAdjustment
```

### 3.8 Racing Motion State

Race Live View 中的动态展示状态。

| 状态 | 语义 | 展示方式 |
|---|---|---|
| idle | 暂无明显推进 | 原地轻微待机 |
| running | 正常推进 | 常规奔跑动效 |
| sprinting | 近期推进明显 | 更快奔跑 / 高亮 |
| slowed | 推进变慢 | 慢速移动 / 弱化 |
| blocked | 被阻碍或存在高风险 | 停顿 / 警示标记 |
| pit_stop | 进入 Pit Stop | 停靠 / 维修提示 |
| takeover | 远程接管中 | 接管徽标 |
| finished | 当前 Round 或阶段完成 | 冲线 / 完成标记 |
| stale | 长时间无新数据 | 降低透明度 / 离线提示 |

---

## 4. 容器级信息架构

Jumbotron 应保留一套稳定的大屏骨架，用于承载 Race Live View。

```text
Jumbotron Container
├── Header
│   ├── Brand
│   ├── Subtitle
│   ├── LIVE Status
│   ├── Current Phase / Round
│   ├── Elapsed Time
│   └── Online / Active Riders
│
├── Global KPI Strip
│   ├── Completion Rate
│   ├── Total Tokens
│   ├── Codex Usage
│   ├── Claude Usage
│   └── Risk / Obstacle / Violation Count
│
├── Main Content
│   └── Race Live View
│
├── Attention / Message Area
│   ├── Riding Message
│   └── Risk / Obstacle / Violation
│
└── Footer
    ├── LIVE Status
    ├── Theme
    ├── Organizer
    ├── Current Phase
    ├── Next Phase
    └── System Time
```

---

## 5. Race Live View IA

Race Live View 是当前高保真图中的主视图。

它以赛道主视觉为中心，用马匹位置、排名编号、项目气泡、TOP3 和底部 ticker 表达赛事进行态。

### 5.1 区域结构

```text
Race Live View
├── Header / Status Bar
│   ├── DevCompass Racing
│   ├── Workshop / Hackathon Live Screen
│   ├── LIVE Badge
│   ├── Current Round
│   ├── Elapsed Time
│   └── Online Riders
│
├── Top Summary Row
│   ├── Real-time TOP3
│   │   ├── Rank 1 Entry
│   │   ├── Rank 2 Entry
│   │   └── Rank 3 Entry
│   └── Competition KPI Cards
│       ├── Completion Rate
│       ├── Total Tokens
│       ├── Codex Usage
│       └── Claude Usage
│
├── Track Stage
│   ├── Track Background
│   ├── Semantic Track Overlay
│   ├── Racing Entry Markers
│   ├── Ranking Number Badges
│   ├── Horse / Rider Visuals
│   ├── Riding Message Bubbles
│   └── LIVE Indicator
│
├── Left Rail
│   ├── Track Mini Map
│   ├── Checkpoints
│   └── Entry Legend
│
├── Bottom Ticker
│   ├── Risk Items
│   ├── Obstacle Items
│   ├── Violation Items
│   ├── Recent Message Items
│   └── View More
│
└── Footer
    ├── Theme
    ├── Organizer
    ├── Current Phase
    ├── Next Phase
    └── System Time
```

### 5.2 信息优先级

1. 当前赛事正在发生什么；
2. 谁领先，谁在追赶；
3. 每个重点 Racing Entry 位于哪里；
4. 哪些 Riding Message 值得现场看到；
5. 哪些风险、阻碍或违规需要关注；
6. 总进度、资源消耗和 CA 使用情况。

### 5.3 主视觉规则

赛道主视觉需要同时承载视觉氛围和数据定位，但二者必须解耦。

```text
Static Track Background
  +
Semantic Track Geometry
  +
Dynamic Racing Entry Layer
  +
Message / Attention Overlay
```

约束：

- 马匹、编号、气泡和风险标记不能写死在底图里；
- 排名和进度不能从图片中推断；
- 赛道位置由 `roundProgress` 映射到 `centerlinePath`；
- 气泡、标签和马匹需要落在 `safeZones` 内或经过避让计算；
- 无新数据时只保留原地动效或进入 stale，不持续制造虚假推进。

### 5.4 TOP3 规则

实时 TOP3 展示当前最强竞争焦点。

每个 TOP3 Item 包含：

- rank；
- entryName；
- rider / project visual；
- time gap / lead status；
- current motion hint；
- click target。

TOP3 只表达当前 Race Live View 的实时领先关系，不扩展为独立看板。

### 5.5 Riding Message 气泡规则

气泡用于表达现场播报感。

适合展示：

- 短句；
- 里程碑；
- 追赶、反超、守住名次；
- 风险或阻碍提示；
- Guidance / Takeover / Pit Stop 状态。

不适合展示：

- 长文本评论；
- 完整日志；
- 复杂分析；
- 多段解释。

### 5.6 Bottom Ticker 规则

底部 ticker 用于横向滚动最新注意事项。

Ticker Item 包含：

- category；
- severity；
- time；
- entryName；
- summary；
- status badge；
- targetUrl。

点击风险项可进入详细风险列表或对应 Remote Racing Cockpit。

---

## 6. 核心交互

### 6.1 查看全局赛况

观众通过 Race Live View 的赛道主视觉理解比赛推进状态。

### 6.2 查看实时领先者

观众通过 TOP3 区快速识别当前领先和追赶关系。

### 6.3 查看项目位置

观众通过赛道上的 Racing Entry 位置、排名编号和项目名理解相对进度。

### 6.4 查看实时消息

观众通过 Riding Message 气泡或 ticker 看到重点动态。

### 6.5 查看风险

组织者通过底部 ticker 或赛道上的风险标记识别需要介入的项目。

### 6.6 进入单个项目

组织者可以从以下对象进入 Remote Racing Cockpit：

- Racing Entry 标记；
- TOP3 Item；
- Riding Message；
- Risk / Obstacle / Violation Item。

---

## 7. 高保真对象到 IA 对象映射

| 高保真对象 | IA 对象 | 所属区域 |
|---|---|---|
| DevCompass Racing 标题 | Brand / Competition Title | Header |
| Workshop / Hackathon Live Screen | Competition Subtitle | Header |
| 赛事直播中 | LIVE Status | Header |
| ROUND 3 | Current Round | Header / Footer |
| 已用时 | Elapsed Time | Header |
| 在线选手 24/36 | Online Riders | Header |
| 实时 TOP3 | Real-time TOP3 | Top Summary Row |
| TOP3 马匹卡片 | Ranking Item / Racing Entry | Top Summary Row |
| 完成度 68% | Completion Rate KPI | KPI Cards |
| 总 Tokens | Total Tokens KPI | KPI Cards |
| Codex / Claude 参与 | CA Usage KPI | KPI Cards |
| 赛道地图 | Track Stage | Main Content |
| 赛道底图 | Track Template.backgroundAsset | Track Stage |
| 赛道路径 | Track Template.centerlinePath | Track Stage |
| 马匹与编号 | Racing Entry Marker | Track Stage |
| 气泡消息 | Riding Message Bubble | Track Stage |
| 左侧小地图 | Track Mini Map | Left Rail |
| 项目颜色图例 | Entry Legend | Left Rail |
| 风险与违章底栏 | Attention Ticker | Bottom Ticker |
| 查看更多 | View More / Drill Down | Bottom Ticker |
| 底部赛事主题 | Theme | Footer |
| 主办方 | Organizer | Footer |
| 下一阶段 | Next Phase | Footer |
| 系统时间 | System Time | Footer |

---

## 8. MVP 落地约束

1. Jumbotron 是大屏容器，MVP 只包含 `race_live` 显示范围。
2. Race Live View 默认用 `roundProgress` 映射赛道位置。
3. 赛道底图只负责视觉，不负责语义。
4. 赛道几何必须显式存在，不能从图片反推。
5. 马匹位置由进度和赛道几何派生，不把设计稿 `x / y` 当作业务事实。
6. 动态表现由状态机驱动，不做真实物理仿真。
7. 数据更新慢时，使用短时间补间、原地动效、气泡和高亮，不伪造连续推进。
8. 不包含独立第二大屏模式、项目主表或多维排行需求。
9. Jumbotron 只展示摘要，不承载完整 Session、完整日志或复杂分析。

---

## 9. 推荐 MVP 信息层级

```text
P0 必须可见
├── LIVE 状态
├── 当前 Round / 阶段 / 已用时
├── Race Live 主赛道
├── Racing Entry 位置与排名
├── TOP3
└── 风险 / 阻碍 / 违规提醒

P1 应该可见
├── 完成度
├── 总 Tokens
├── Codex / Claude 使用
├── 在线 / 活跃骑手
├── Riding Message
└── Footer 状态

P2 可增强
├── 更复杂的赛马动效
├── 气泡避让优化
└── 详细风险 Drill Down
```
