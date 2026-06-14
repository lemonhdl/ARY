# Week2 Jumbotron

Week2 Jumbotron 是 ARY / DevCompass Racing 的第二周项目交付：我们做的是一个“赛事现场大屏子系统”PoC，而不是一张静态大屏设计图。

如果你没有读过三份核心文档，可以先把这个项目理解成：

> DevCompass Racing 把多个团队使用 Coding Agent 完成任务的过程包装成一场“赛马式”的公开比赛。Jumbotron 就是现场大屏：它要让观众、组织者、教师和助教快速看懂比赛进行到哪里、谁领先、哪些团队发生了关键动态、有没有风险或违规，以及这些画面是不是由真实数据和可校准赛道驱动。

本 README 从零介绍我们做了什么、为什么这么做、如何运行、如何验收，以及哪些仍然是 PoC 边界。

## 1. 项目背景

DevCompass Racing 的核心不是单纯展示排行榜，而是把 Agent Riding 的过程变成可以被公开理解的赛事现场。

在这个语境里：

- 一个团队、项目或 Racing Cockpit 可以被抽象成一个 `Racing Entry`。
- Coding Agent 的推进、风险、阻碍、消息和结果可以被抽象成赛事状态。
- 赛道不是装饰图，而是承载多个 Entry 位置、进度和动态的公开视觉框架。
- 现场观众不应该看到完整终端日志、完整 Coding Agent Session 或复杂代码 diff，而应该看到经过降噪后的公开摘要。

因此 Jumbotron 的任务是把底层比赛数据变成一个可读、可运行、可解释的大屏。

## 2. 我们要解决的问题

三份核心文档反复强调同一个判断标准：

> 一个合格的 Jumbotron 不能靠“背景图 + 写死坐标 + 固定动画”伪装出来。它必须证明大屏由可信数据、可信赛道几何和可维护资产流程驱动。

所以本项目重点解决四个问题：

1. **现场观众能不能看懂比赛？**  
   大屏需要展示赛事标题、LIVE 状态、Round / Phase、计时、KPI、赛道、马匹位置、TOP3、Riding Message、风险和违规提醒。

2. **马匹位置是不是数据驱动？**  
   马匹不能直接画死在图片上，而要由 `roundProgress`、`track.profile.json`、centerline、lane offset 和 track-runtime 计算出来。

3. **赛道资产是不是可校准？**  
   AI 生成或人工绘制的赛道底图必须进入 Calibrator，校准成可运行的 `track.profile.json`，再被 Jumbotron 使用。

4. **公开大屏有没有信息边界？**  
   Jumbotron 展示公开摘要和赛事态势，不展示完整 Coding Agent Session、终端日志、长评论流、复杂 diff 或未授权私密内容。

## 3. 目标用户

这个子系统面向多类用户，不假设他们理解内部实现。

| 用户 | 他们关心什么 | Jumbotron 提供什么 |
| --- | --- | --- |
| 现场观众 | 当前比赛发生了什么，谁领先，哪里有变化 | Race Live View、主赛道、TOP3、ticker、消息气泡 |
| 组织者 | 比赛整体是否健康，哪些队伍需要关注 | KPI、风险/阻碍/违规提醒、焦点详情 |
| 教师和助教 | 学生是否真的完成了可运行系统，而不是静态演示 | debug evidence、validation、data profile、Riding Record |
| 参赛团队 | 自己的项目在比赛中的公开状态 | Entry 标签、排名、进度、消息摘要 |
| 资产/工程维护者 | 赛道底图如何变成可运行资产 | Calibrator、trace centerline、track.profile.json、preview、validation |

## 4. 我们实际做了什么

当前实现已经接入 `PoC-GRS-001` 服务，主入口是：

```text
/jumbotron
```

它不是独立静态网页，而是在现有 PoC 服务里扩展出的 Jumbotron 子系统。

### 4.1 Race Live View：公开赛事大屏

Race Live View 是观众看到的主页面。它包含：

- 顶部赛事状态：赛事名称、LIVE、Round、Phase、计时。
- KPI chips：完成度、活跃骑手、Tokens、Codex / Claude 使用、风险统计。
- 主赛道舞台：底图、赛道几何、马匹、队伍标签、排名、状态。
- TOP3：领先队伍和追赶关系。
- Riding Message：消息气泡和底部现场播报 ticker。
- Risk / Obstacle / Violation：风险、阻碍和违规提醒。
- Focus Detail Rail：点击队伍、消息或风险项后，右侧展开完整摘要。

公开页的目标是“现场可读”，所以长文本不会直接堆到赛道画面里，而是通过 tooltip、ticker 和焦点详情承载。

### 4.2 Jumbotron Adapter：把比赛数据变成大屏模型

Jumbotron 不直接消费杂乱的原始数据。我们实现了一层 Adapter，把比赛快照转换成大屏需要的对象：

```text
DCR RaceSnapshot
  -> Jumbotron Adapter
  -> RacingEntrySnapshot[]
  -> RidingMessageSnapshot[]
  -> AttentionItem[]
  -> Race Live View
```

其中：

- `Competition` 描述赛事标题、阶段、时间和主题。
- `RacingEntrySnapshot` 描述队伍、排名、进度、状态、风险和 Agent 使用情况。
- `RidingMessageSnapshot` 描述现场消息、里程碑、风险提示和播报内容。
- `AttentionItem` 描述需要现场关注的风险、阻碍或违规。

这样做的目的，是让 UI 只依赖稳定的大屏数据契约，而不是散落的后端字段。

### 4.3 Track Profile Runtime：用赛道几何计算马匹位置

马匹位置不是写死的。当前运行时使用下面的链路计算 HorsePose：

```text
roundProgress
  -> normalized s
  -> centerline sampled point
  -> tangent
  -> normal
  -> lane offset
  -> HorsePose(x, y, rotation, laneId, state)
```

关键点：

- `roundProgress` 表示比赛进度。
- `track.profile.json` 提供中心线、方向、起终点、车道偏移和 checkpoints。
- `track-runtime` 沿 centerline 采样，计算马匹位置和朝向。
- lane offset 让多支队伍分布在不同车道上，而不是重叠在同一条线上。
- 底图只负责视觉；位置事实来自 `track.profile.json` 和 runtime。

这正是核心文档要求的“不能把赛马位置写死在图片或设计稿里”。

### 4.4 Track Profile Calibrator：把底图校准成可运行赛道

Calibrator 是设计时工具，不是公开大屏的一部分。它负责把 AI 生成或人工绘制的赛道底图变成可运行的 `track.profile.json`。

当前 Calibrator 支持：

- 导入或使用赛道底图。
- 编辑 centerline points。
- 设置方向、起点、终点。
- 配置 lane offsets 和 checkpoints。
- 配置 message zones、no-bubble zones、risk zones。
- 单马和多马 preview。
- Trace Centerline：沿底图用鼠标描线，生成中心线点集。
- Safe Keypoint Mode：只调整起终点和 checkpoint 的 `s` 值，不破坏已确认中心线。
- Validate：检查 profile、路径、车道、背景、checkpoint、过短路径、过大转角等问题。
- Export：导出 frozen candidate 形式的 `track.profile.json`。
- debug preview PNG：生成可复核的赛道 overlay 证据。

Calibrator Preview 和 Jumbotron 使用同一套 `track-runtime`。这保证了“工具里看到的赛道预览”和“公开大屏里马匹运行的位置”不是两套逻辑。

### 4.5 默认第二赛道

当前 `/jumbotron` 默认使用已人工确认的第二赛道：

```text
real-explicit-closed-course
```

资产目录：

```text
Week2-Jumbotron/mock-data/raw/mock_data/tracks/real-explicit-closed-course/
```

该目录包含：

- `background.webp`：公开大屏使用的赛道底图。
- `preview.png`：带 overlay 的复核图。
- `track.profile.json`：运行时使用的语义赛道。
- `asset-provenance.json`：资产来源记录。
- `asset-validation.json`：资产验证记录。
- human trace 证据：人工描线产出的 centerline 依据。

旧公开赛道仍可显式打开：

```text
/jumbotron?profile=full&track=default-public-track
```

### 4.6 Replay Patch Runtime：回放不是重挂整页

当前 Jumbotron 支持 replay。回放时不是重新加载整页，而是局部更新：

- 主赛道马匹位置。
- TOP3。
- mini map。
- race queue。
- event bubbles。
- bottom ticker。

底部现场播报 ticker 已按用户最新要求修正为队列语义：

- `readyQueue`：等待播报的消息队列。
- `runningQueue`：当前前台正在滚动的消息。
- replay 中按绝对时间 FIFO：更早发生的消息先进队列。
- 运行中的消息未从左侧离开前，不被直接替换。
- 新消息从右侧 append 入场。
- 前台最多 5 条运行消息。
- readyQueue 越长，滚动速度可自适应加快。
- 点击 replay ticker 消息会展开右侧焦点详情。

## 5. 当前页面和接口

默认本地服务端口按 `PoC-GRS-001` 配置为 4400。当前复核会话也可使用 45940。

### 默认启动

在仓库根目录下：

```bash
npm --prefix PoC-GRS-001 start
```

打开：

```text
http://127.0.0.1:4400/jumbotron
```

### 指定端口启动

如果需要使用本轮复核端口：

```bash
ARY_GRS001_PORT=45940 ARY_GRS001_ORGANIZER_PORT=45941 npm --prefix "/media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001" start
```

打开：

```text
http://127.0.0.1:45940/jumbotron
```

### 常用复核 URL

```text
/jumbotron
/jumbotron?profile=full
/jumbotron?profile=smoke-8
/jumbotron?profile=coverage-9
/jumbotron?debug=1&profile=full
/jumbotron?profile=full&track=default-public-track
/jumbotron/calibrator
/jumbotron/calibrator?candidate=real-explicit-closed-course
/jumbotron/calibrator/keypoints?candidate=real-explicit-closed-course
/jumbotron/debug-preview.png
/api/jumbotron-data-evidence?profile=full
```

## 6. Data Profiles

当前提供三套 data profile，方便展示不同场景：

| Profile | Canonical id | 用途 |
| --- | --- | --- |
| `full` | `curated-full-12` | 完整压力 profile，覆盖 12 支队伍和主要现场状态 |
| `smoke-8` | `smoke-8-visual-low-load` | 低负载视觉 smoke profile，适合录屏时先看清楚布局 |
| `coverage-9` | `coverage-9-enum-complete` | 枚举覆盖和 debug profile，适合验证状态机、风险和边界 |

非法 profile 不会 silent fallback，而会进入明确错误状态。这是为了避免 demo 看似正常、实际数据 profile 配错。

## 7. 验证方式

在仓库根目录下：

```bash
npm --prefix PoC-GRS-001 run verify
```

当前验证通过时输出：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

验证覆盖包括：

- 既有 GRS001 创建、公开、生命周期、riding evidence、result radar 主线。
- `/jumbotron` 公开页可访问。
- 默认赛道是 `real-explicit-closed-course`。
- 多 profile 可切换。
- Jumbotron 不泄漏 raw URL、本地绝对路径、完整 session、终端日志或复杂 diff。
- Track Runtime、HorsePose、bubble、ticker、focus detail、replay patch 的关键约束。
- Calibrator、trace centerline、safe keypoint mode、debug preview PNG。
- replay ticker 的 FIFO readyQueue / runningQueue、append 入队、focus detail 覆盖。

## 8. 如何按核心文档验收

如果你是评审者或队友，可以按下面的问题检查。

### 8.1 Jumbotron 是否可运行？

打开 `/jumbotron`，应能看到：

- 赛事标题和 LIVE 状态。
- Round / Phase / 计时。
- KPI chips。
- 主赛道和多个 Entry。
- TOP3。
- Riding Message 气泡或底部 ticker。
- 风险、阻碍或违规提醒。

### 8.2 赛道位置是否写死？

检查 debug 或代码链路，应能确认：

```text
roundProgress -> track-runtime -> HorsePose -> SVG / HTML render
```

而不是把马匹、排名编号、气泡或风险标记直接画在底图里。

### 8.3 Calibrator 是否存在？

打开 `/jumbotron/calibrator?candidate=real-explicit-closed-course`，应能看到：

- 赛道底图。
- centerline points。
- lane offsets。
- checkpoints。
- 单马和多马 preview。
- Validate。
- Export。
- Trace Centerline 入口。

### 8.4 公开信息边界是否正确？

公开页应展示摘要，不应展示：

- raw `targetUrl`。
- raw `remoteCockpitUrl`。
- 本地绝对路径。
- 完整 Coding Agent Session。
- 完整终端日志。
- 长评论流。
- 复杂代码 diff。
- 未授权私密内容。

### 8.5 Riding Record 是否存在？

过程记录在：

```text
riding_record/
```

其中记录了 Jumbotron、Calibrator、mock data、资产生成、人工纠偏、验证和 replay ticker 队列语义修复过程。

## 9. 仍然是 PoC 的部分

当前实现不声称完成完整 DevCompass Racing 平台。

未实现或不在本轮范围内：

- 真实后端赛事聚合服务。
- 权限、房间和 Workshop 管理上下文。
- 正式 Remote Racing Cockpit 协作流程。
- 最终排名语义。
- 正式多赛道资产管理后台。
- 复杂 3D 或真实物理模拟。
- 正式提交用 demo video。

其中 demo video 是核心文档明确要求的提交材料。代码已经具备录制条件，但视频文件本身仍需要另行录制并纳入提交。

## 10. 建议短视频结构

核心文档要求短视频建议 3–5 分钟，至少说明 Jumbotron 和 Calibrator 的使用。当前建议录制 4 分 30 秒左右，结构如下：

1. **开场：项目是什么**  
   说明这是 ARY / DevCompass Racing 的公开赛事大屏，不是静态设计稿。

2. **Race Live View**  
   展示 `/jumbotron`：Header、KPI、主赛道、TOP3、ticker、风险提醒。

3. **数据驱动和 track-runtime**  
   说明 `roundProgress -> s -> centerline -> lane offset -> HorsePose`。

4. **Riding Message 和 replay ticker**  
   展示消息气泡、底部 ticker、FIFO readyQueue / runningQueue、点击展开焦点详情。

5. **Calibrator**  
   展示底图、centerline、lane offsets、checkpoints、单马/多马 preview、Validate、Export。

6. **边界说明**  
   说明哪些是 mock data，哪些是当前 PoC，哪些没有实现，公开页不展示完整 session 或私密内容。

更完整的录制计划见：

```text
review-ledger/2026-06-14-jumbotron-healthcheck-and-video-plan.md
```

## 11. 目录索引

```text
Week2-Jumbotron/
├── README.md
├── TODO.md
├── docs/
│   ├── core/
│   │   ├── ARY GRS 002 Jumbotron 评审标准.md
│   │   ├── Jumbotron信息架构.md
│   │   └── Jumbotron子系统定义.md
│   └── source/
├── mock-data/
│   └── raw/mock_data/tracks/real-explicit-closed-course/
├── review-ledger/
└── jumbotron-workflow-visual.html

PoC-GRS-001/
├── src/server.js
├── src/verify.js
└── jumbotron-mock-data/curated/
```

当前主线实现位于：

```text
PoC-GRS-001/src/server.js
PoC-GRS-001/src/verify.js
```

`Week2-Jumbotron/index.html` 和 `Week2-Jumbotron/src/` 保留为早期独立前端试验记录，不作为最终主线。