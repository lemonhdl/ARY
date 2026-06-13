# Calibrator 实现交接文档

交接对象：继续实现或复审 `/jumbotron/calibrator` 的组员<br>
当前结论：Calibrator 已从开发者工具页升级为可画布操作的 Track Profile Calibrator。主流程支持真实底图、centerline 点位拖拽、右键插点、Undo / Redo、start / finish 可视化设置、checkpoint 可视化编辑、lane 快捷生成、三类 zone 画布编辑、Advanced JSON、Validate / Preview / Export。

> 2026-06-13 更新：旧复审记录中“画布只能看”“拖拽 pending”“zones 仍是高级 JSON”等判断已不代表当前实现。下文保留原需求和问题分析，用作追踪为什么要做这轮改造；当前验证证据见 `Week2-Jumbotron/review-ledger/screenshots/2026-06-13-jumbotron-calibrator-full-interaction/`。

## 1. 当前判断

当前 `/jumbotron/calibrator` 可以作为 Calibrator PoC 证明技术链路：

- 有独立入口。
- 有 Top Toolbar / Main Canvas / Right Inspector / Bottom Preview Bar。
- 能导入候选 profile。
- 能编辑 TrackProfile 的关键字段。
- 能用 scrubber 预览单马。
- 能预览多马。
- 能 Validate。
- 能 Export frozen `track.profile.json` candidate。
- Preview 复用 `createJumbotronRuntime / sampleHorsePose`。

但它的主交互仍然偏工程调试：

- centerline 点位主要靠 JSON textarea 和 `addPointX / addPointY` 数字输入。
- lanes、checkpoints、messageZones、noBubbleZones、riskZones 都主要靠 JSON textarea。
- start / finish 需要输入 `s` 数值。
- 画布只能看，不能直接拖拽编辑。
- 当前 DOM 没有 `draggable`，也没有 pointer / mouse / drag handler。

因此建议对外表述为：

> 当前实现是开发者工具页级 Calibrator MVP。它能证明 track profile、preview、validation、export 的链路，但还不是一个真正给设计 / 资产同学自然使用的校准工具。

## 2. 当前实现入口

运行入口：

```text
http://127.0.0.1:<port>/jumbotron/calibrator
```

本地启动示例：

```bash
env ARY_GRS001_PORT=4438 ARY_GRS001_ORGANIZER_PORT=4439 \
  node /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/src/start.js
```

主要代码入口：

```text
/media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/src/server.js
```

关键函数：

| 位置 | 作用 |
|---|---|
| `server.js:774` `createJumbotronRuntime(trackProfile)` | Jumbotron 和 Calibrator 共享的 track-runtime 逻辑，负责 path sampling、lane offset、horse pose。 |
| `server.js:1089` `validateTrackProfile(trackProfile, runtime)` | TrackProfile 自动校验。 |
| `server.js:1896` `exportTrackProfileShape(trackProfile)` | 导出 frozen `track.profile.json` candidate 的字段形状。 |
| `server.js:1950` `buildCalibratorProfile(body)` | 从表单 body 构建 / 修改 TrackProfile。当前大部分编辑逻辑在这里。 |
| `server.js:1995` `buildCalibratorMultiHorseEntries(trackProfile, settings)` | 构造多马预览数据。 |
| `server.js:2007` `buildCalibratorP1Backlog()` | 页面上标记 pending / implemented 的 P1 backlog。 |
| `server.js:2068` `buildCalibratorWorkbench(body)` | 汇总 profile、runtime、preview pose、validation、export JSON、diff rows。 |
| `server.js:2114` `renderTrackCalibrator(session, body)` | 渲染 `/jumbotron/calibrator` 页面。当前 UI 主要在这个大函数里。 |
| `server.js:2367` | GET `/jumbotron/calibrator` 路由。 |
| `server.js:2371` | POST `/jumbotron/calibrator` 路由。 |

验证入口：

```text
/media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/src/verify.js
```

相关断言集中在：

```text
verify.js:376-473
```

覆盖内容包括页面加载、四区结构、导入、Validate、Preview、Export、添加点、删除点、反转方向、非法 direction、重复 lane、越界 checkpoint、坏 JSON、缺失背景、尖角、短路径。

## 3. 当前已经实现的能力

### 3.1 页面结构

当前页面已经呈现 Calibrator IA 的四块：

- Top Toolbar
  - Import Background
  - Import Candidate Profile
  - Validate
  - Preview
  - Export
- Main Canvas
  - Background Layer
  - Centerline Layer
  - Control Points Layer
  - Lane Preview Layer
  - Checkpoint Layer
  - Horse Preview Layer
  - Message Bubble Preview Layer
- Right Inspector
  - Track Info
  - Geometry
  - Start / Finish
  - Direction
  - Lanes
  - Checkpoints
  - Message Bubble
  - Validation Results
- Bottom Preview Bar
  - Progress Scrubber
  - Horse Count
  - Speed
  - Play / Pause
  - Scenario Presets

### 3.2 数据与 profile 编辑

当前支持：

- 粘贴候选 `profileJson`。
- 选择 allowlist 中的 background。
- 输入自定义 `/assets/...` background。
- 编辑 `trackId`、`name`。
- 编辑 `direction`、`closed`、`smoothing`。
- 添加 centerline point。
- 删除 centerline point。
- 反转路径方向。
- 编辑 `startS`、`finishS`。
- 编辑 `lanes` JSON。
- 编辑 `checkpoints` JSON。
- 编辑 `messageZones` JSON。
- 编辑 `noBubbleZones` JSON。
- 编辑 `riskZones` JSON。

### 3.3 Preview 与导出

当前支持：

- scrubber 单马预览。
- 多马预览。
- message bubble preview。
- lane preview。
- checkpoint marker。
- Validation Results。
- Export frozen `track.profile.json` candidate。
- Imported profile → Exported frozen candidate 的 JSON diff preview。

### 3.4 复用 runtime

当前 `buildCalibratorWorkbench()` 会调用：

```js
const runtime = createJumbotronRuntime(trackProfile);
```

并通过：

```js
runtime.sampleHorsePose(entry)
runtime.samplePoint(checkpoint.s)
runtime.samplePoints(34)
```

生成单马、多马、checkpoint、lane preview。这个方向是对的，必须保留。

## 4. 当前主要问题

### 4.1 最大问题：主编辑方式不像人用的工具

复审时抓取当前页面 DOM：

```text
textarea 8
input 10
select 6
button 17
has draggable attr False
has pointer/mouse/drag handlers False
```

当前 textarea：

```text
profileJson
centerlinePoints
lanes
checkpoints
messageZones
noBubbleZones
riskZones
```

当前 input：

```text
backgroundSrcCustom
trackId
name
addPointX
addPointY
startS
finishS
previewProgress
horseCount
previewSpeed
```

这说明校准动作主要依赖：

- 手写 JSON。
- 输入 x / y 坐标。
- 输入 s 值。
- 输入 lane offset。

这对开发者可用，对设计 / 资产同学不友好。

### 4.2 文档要求的“拖拽 centerline points”未实现

文档把“添加、删除、拖拽 centerline points”列为 Calibrator MVP。当前只做到添加和删除，没有拖拽。

当前页面也直接写了：

```text
拖拽 centerline points：pending。
```

这部分需要优先补齐。

### 4.3 Main Canvas 不是主要操作面

当前 Main Canvas 能展示 background、centerline、control points、lanes、checkpoints、horse、bubble，但用户不能直接在画布上操作它们。

这会造成割裂：

- 用户在画布上看到问题。
- 但必须回到右侧 textarea 或数字输入里猜坐标。
- 修改后再看 preview。

真正的 Calibrator 应该让用户直接在画布上拖点、点选、移动、框选。

### 4.4 zones 仍是高级 JSON，不是可视化编辑

当前：

- `messageZones`
- `noBubbleZones`
- `riskZones`

都可以通过 JSON 编辑，也会在画布上显示。但这不是完整的区域编辑体验。

更合适的主交互：

- 在画布上拖一个矩形。
- 选择 zone 类型。
- 右侧编辑 zoneId / label / priority。
- JSON 只作为高级模式或导出结果。

### 4.5 Export 仍是 candidate，不是正式资产冻结

当前导出的是 frozen candidate。页面也说明“不等于正式资产 confirmed”。这是诚实的，但如果要冲高分，还需要更完整的资产冻结材料：

- `background.webp`
- `track.profile.json`
- `preview.png`
- `notes.md`
- `source.prompt.md`，如果使用 AI 生成底图

当前还没有完整资产包生成流程。

## 5. 三份核心文档中的 Calibrator 原文

以下原文是后续需求的依据。实现时以这些要求为准。

### 5.1 `ARY GRS 002 Jumbotron 评审标准.md`

#### 硬性门槛

```md
### 2. 必须有 Calibrator 或可验证的赛道校准流程

作品必须说明并演示赛道底图如何变成可运行的语义赛道资产。

至少需要体现：

- 导入或使用一张赛道底图；
- 定义或编辑 centerline points；
- 设置起点 / 终点或方向；
- 配置 lane offsets；
- 预览单马或多马运行；
- 导出或展示 `track.profile.json`；
- 说明 Jumbotron 如何使用该 profile。

Calibrator 可以是完整工具、简化工具、开发者工具页，或具备清楚操作流程的 PoC，但不能完全没有赛道校准过程。
```

#### 20 分评分项

```md
## 3. Calibrator 与赛道资产生产｜20 分

评审重点：团队是否证明了赛道资产可以被生产、校准、验证和复用。

评分要点：

- 是否提供 Track Profile Calibrator 或等价校准工具；
- 是否能导入或使用赛道底图；
- 是否能创建、编辑或导入 centerline points；
- 是否能设置起点 / 终点、方向、闭合路径；
- 是否能配置 lane offsets；
- 是否能配置 checkpoints；
- 是否能通过 scrubber 或 preview 预览单马 0% → 100% 运行；
- 是否能预览多马运行，证明 lane offset 可用；
- 是否能 Validate 并展示校验结果；
- 是否能 Export `track.profile.json`；
- 是否能解释 `track.profile.json` 中的关键字段；
- 是否能说明 AI 生成底图与人工校准之间的关系；
- 是否能提交至少一套可用赛道资产。

高分作品特征：

> Calibrator 不是摆设，而是真正让一张视觉底图变成可运行赛道资产；评委能看到从底图、路径校准、预览、验证到导出 profile 的完整流程。
```

#### runtime 复用要求

```md
- 是否保证 Calibrator Preview 与 Jumbotron 使用同一套或同一逻辑的 track-runtime；
- 是否避免直接在 x/y 上粗暴补间导致马匹穿越弯道。
```

#### 短视频要求

```md
作品必须提交一段短视频，用于说明 Jumbotron 和 Calibrator 的使用。

短视频建议 3–5 分钟，至少应包含：

4. Calibrator 导入或使用赛道底图；
5. Calibrator 编辑 / 校准路径、预览马匹运行、Validate、Export；
6. 导出的 `track.profile.json` 如何被 Jumbotron 使用；
7. 哪些数据是真实接入，哪些数据是 mock，哪些部分仍是 PoC。
```

#### 加分项

```md
### 2. Calibrator 体验完整

Calibrator 不只是开发者临时工具，而是具备较好交互体验：

- 拖拽路径点自然；
- 支持路径反转；
- 支持多马预览；
- 支持 validation 面板；
- 支持 JSON diff 或 debug preview；
- 支持 no bubble zone / message zone / risk zone 等增强能力。
```

#### 一票否决相关项

```md
出现以下情况，原则上不能获得高分，严重时可直接判定不合格：

2. 没有 Calibrator，也无法说明赛道资产如何被校准为可运行 profile；
5. 赛马位置、排名、气泡和风险标记全部写死在图片或设计稿中；
6. 无法解释 `track.profile.json` 或等价赛道语义资产的作用；
```

### 5.2 `Jumbotron信息架构.md`

这份文档没有单独的 Calibrator 评分表，但约束了 Calibrator 必须解决的问题。

```md
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
```

对 Calibrator 的含义：

- 赛道几何要显式存在。
- 底图不能承担语义。
- 设计稿 x/y 不能作为业务事实。
- Calibrator 要生产可被 runtime 使用的 TrackProfile，而不是只调静态坐标。

### 5.3 `Jumbotron子系统定义.md`

#### 子系统定位

```md
> Jumbotron 子系统由运行时 **Jumbotron / Race Live View** 与设计时 **Track Profile Calibrator** 组成，目标是让赛马主视觉可以被稳定资产、可信几何和 DCR 快照数据驱动。
```

```md
同时，它提供设计时 Calibrator，用于把 AI 生成或人工绘制的赛道底图校准为可运行的 `track.profile.json`。
```

```text
AI / Design Track Background
  → Track Profile Calibrator
  → track.profile.json
  → track-runtime
  → Jumbotron / Race Live View
```

#### Calibrator 职责

```md
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
```

#### 共享 runtime 原则

```md
关键原则：Calibrator 预览必须复用 `track-runtime`，不能另写一套预览逻辑。

track.profile.json
  → track-runtime
      ├── Jumbotron / Race Live View
      └── Track Profile Calibrator Preview
```

#### Calibrator IA

```md
## 4. Calibrator IA

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

#### Calibrator MVP 功能

```md
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
```

#### Calibrator P1 功能

```md
### 4.2 Calibrator P1 功能

1. 气泡区域编辑；
2. no bubble zone 编辑；
3. 风险区域编辑；
4. AI 候选点导入；
5. 自动检测尖角；
6. 自动分配 lanes；
7. 导出 debug-preview.png；
8. JSON diff preview。
```

#### 资产生产流程

```md
### 8.1 AI-assisted Asset Pipeline

AI 不参与运行时可信计算，只参与设计时候选资产生产。

推荐流程：

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

#### 资产冻结规则

```md
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
```

#### Track Profile Validation

```md
### 9.1 Track Profile Validation

导出前必须校验：

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

#### Visual Validation

```md
### 9.3 Visual Validation

Calibrator 提供人工确认：

- 马是否跑在赛道上
- 弯道处是否自然
- 多马是否严重重叠
- 气泡是否遮挡标题 / KPI / 顶部区域
- checkpoint 是否符合视觉语义
```

#### MVP 验收口径

```md
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
```

## 6. 基于评分标准提出的实现需求

### P0：把 centerline 编辑变成画布直接操作

目标：不再要求用户输入 `addPointX / addPointY` 才能添加点。

需求：

1. 点击画布添加 centerline point。
2. 点击已有 point 选中。
3. 拖拽 point 更新坐标。
4. 删除选中 point。
5. 拖动后实时更新：
   - centerline polyline / path；
   - lane preview；
   - scrubber 单马位置；
   - 多马预览；
   - validation results；
   - export JSON。
6. 保留 JSON 编辑，但折叠到 Advanced / JSON mode，不作为主入口。

验收：

- 不输入 x/y，也能完成添加、移动、删除 centerline point。
- 页面中不再把“拖拽 centerline points：pending”作为当前状态。
- 拖动点位后 Export JSON 中 `centerline.points` 变化。
- Preview 仍复用 `createJumbotronRuntime / sampleHorsePose`。

### P0：起点 / 终点改为路径上可视化设置

目标：不要求用户手写 `startS` / `finishS` 才能设置起终点。

需求：

1. 在路径上显示 start / finish handle。
2. 支持拖拽 handle 或点击路径设置 start / finish。
3. 右侧 Inspector 显示当前 `s` 值，但不是主输入方式。
4. 修改后 checkpoint、preview、validation 同步更新。

验收：

- 用户能在画布上完成起点 / 终点设置。
- Export JSON 中 `startFinish` 更新。
- `startFinish.s` validation 仍在 0~1 范围内。

### P0：checkpoint 改为可视化编辑

目标：不再要求用户手写 checkpoint JSON 才能增删改。

需求：

1. 点击路径添加 checkpoint。
2. checkpoint 显示 label 和 handle。
3. 拖动 checkpoint 沿路径移动。
4. 右侧 Inspector 编辑 label / checkpointId。
5. 支持删除 checkpoint。

验收：

- 不编辑 JSON，也能添加、移动、删除 checkpoint。
- Export JSON 中 `checkpoints` 更新。
- checkpoint preview 在画布上立即更新。

### P0：lane offsets 提供人类可调控件

目标：不要求用户直接写 lanes JSON 才能配置多泳道。

需求：

1. 提供 lane count。
2. 提供 lane spacing。
3. 自动生成 offsets，例如 `[-42, -28, -14, 0, 14, 28, 42]`。
4. 支持每条 lane 微调 offset。
5. 保留 lanes JSON 作为高级模式。

验收：

- 用户能通过 lane count / spacing 快速生成 lanes。
- 多马预览能立刻反映 lane offset。
- Validation 能检查 lane offsets 不重复。

### P1：message / no-bubble / risk zone 画布框选

目标：把区域编辑从 JSON textarea 升级为画布框选。

需求：

1. 用户选择 zone 类型：message zone、no bubble zone、risk zone。
2. 在画布上拖拽矩形区域。
3. 支持移动和缩放区域。
4. 右侧 Inspector 编辑 zoneId、label、用途。
5. Export JSON 更新对应字段。

验收：

- 不编辑 JSON，也能创建和修改三类 zone。
- message bubble preview 能避开 noBubbleZones。
- riskZones 在画布中可见。

### P1：保留 JSON diff，并把它服务于审阅

当前 JSON diff preview 已实现，建议保留并加强。

需求：

1. 当用户拖点、调 lanes、改 checkpoints 时，diff 表显示变化字段。
2. diff 不只显示“几项”，最好能展示关键摘要：点数变化、lane 数量、checkpoint 数量、zone 数量。
3. 支持复制导出的 `track.profile.json`。

验收：

- 修改后 diff 能让审阅者看出发生了什么变化。
- Export JSON 与当前画布状态一致。

### P1：debug-preview.png 或等价截图导出

文档要求 P1 支持 debug-preview.png。当前还没有。

需求：

1. 提供导出当前 overlay preview 的按钮。
2. 如果浏览器端直接导 PNG 成本较高，先提供“保存预览截图”的说明和固定视口路径。
3. 输出文件至少能呈现 background、centerline、control points、lanes、checkpoints、horse preview。

验收：

- 提交材料中能放入 `preview.png` 或等价 overlay 截图。
- 截图能解释当前 profile 如何映射到画面。

### P1：AI 候选点导入保持为候选，不进入 runtime 可信计算

文档强调 AI 只参与设计时候选资产生产。

需求：

1. 允许导入 AI 生成的 candidate points JSON。
2. 页面明确标注 candidate 状态。
3. 必须经过人工校准、Validate、Preview、Export 后才能作为 frozen candidate。
4. 不要让 AI 输出直接成为 runtime 事实来源。

验收：

- UI 能区分 imported candidate、edited profile、exported candidate。
- 文案不声称 AI 自动生成可信赛道。

## 7. 实现建议

### 7.1 不要先大重构

当前所有 Calibrator 页面都在 `server.js`。为了尽快补齐评分缺口，可以先在 `renderTrackCalibrator()` 输出的页面中增加少量前端脚本，完成画布交互。

优先目标是跑通交互证据，不是拆出完美前端架构。

### 7.2 推荐状态流

```text
SVG pointer event
  → 更新前端 workbench state
  → 同步 hidden input / textarea
  → POST 或本地重绘 preview
  → buildCalibratorProfile(body)
  → createJumbotronRuntime(trackProfile)
  → render preview / validation / export
```

如果先做服务器渲染，允许每次操作后提交表单刷新。若要体验更顺，可以先本地更新 SVG，再通过按钮 Validate / Export。

### 7.3 JSON 编辑保留为高级模式

不要删除 JSON textarea。它对调试和审阅仍有价值。建议改成：

```text
高级 JSON 编辑
├── centerline.points
├── lanes
├── checkpoints
├── messageZones
├── noBubbleZones
└── riskZones
```

默认折叠。普通用户先用画布操作。

### 7.4 不要破坏 runtime 复用

所有 preview 的 horse pose 仍应来自：

```js
createJumbotronRuntime(trackProfile)
runtime.sampleHorsePose(entry)
runtime.samplePoint(s)
runtime.samplePoints(count)
```

不要在前端另写一套与 runtime 不一致的坐标采样逻辑。若为了拖拽需要前端辅助计算，也要保证最终 Validate / Export 仍以 server 端 runtime 为准。

## 8. 交付验收清单

完成后请回传：

1. 改了哪些文件。
2. `/jumbotron/calibrator` 如何启动和访问。
3. 一张 1920 宽截图，展示画布拖拽编辑后的状态。
4. 一个短操作说明：
   - 如何添加 centerline point；
   - 如何拖拽 centerline point；
   - 如何设置 start / finish；
   - 如何配置 lanes；
   - 如何添加 checkpoint；
   - 如何 Validate；
   - 如何 Export。
5. Export JSON 示例，证明画布操作真的更新了 `track.profile.json`。
6. Validation 结果截图。
7. 是否仍有 pending 项。
8. 是否需要 cc-Jumbotron 做视觉 / 评分复审。

## 9. 当前最重要的一句话

当前 Calibrator 的技术链路是对的，但主要交互不像人用的工具。下一步不要继续堆更多 JSON 字段，先把 centerline、start / finish、checkpoint、lanes 变成画布可操作对象。这样才能从“开发者工具页”升级为评审标准里说的 Track Profile Calibrator。