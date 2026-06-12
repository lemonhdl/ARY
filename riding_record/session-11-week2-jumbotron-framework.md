# Week2 Jumbotron 框架实现过程记录

## Prompt

基于 `Week2-Jumbotron/docs/source/jumbotron-subsystem-definition.md` 和 `Week2-Jumbotron/docs/source/jumbotron-information-architecture.md` 开始实现第二周 Jumbotron。团队分工已经收敛为：一个人实现框架，一个人产生数据，一个人准备资产，一个人审阅实现是否符合文档和是否遗漏，一个人机动帮忙。本次我们承担框架实现角色，目标是尽可能不让审阅同学挑出概念漂移或遗漏。

用户补充要求：利用好蜂群，记录好过程，可以自主迭代三版。

## Source Constraints

本次实现必须保留两条源文档链路：

```text
DCR RaceSnapshot
  → Jumbotron Adapter
  → RacingEntrySnapshot[]
  → track-runtime
  → Jumbotron / Race Live View
```

```text
AI / Design Track Background
  → Track Profile Calibrator
  → track.profile.json
  → track-runtime
  → Jumbotron / Race Live View
```

实现边界：

- MVP 只保留 `race_live / Race Live View`。
- Jumbotron 展示摘要，不展示完整 Coding Agent Session。
- `TrackProfile` / `track.profile.json` 是位置事实来源。
- `background.webp` 只作为视觉资产。
- 位置来自 `roundProgress → s → centerline → tangent / normal → laneOffset → HorsePose`。
- Calibrator Preview 必须复用 `track-runtime`。

## Swarm Usage

本轮启动了三个只读 subagents：

1. Source constraints review
   - 提取源文档必须遵守的概念、链路和边界。
   - 结论：不能写死 x/y，不能把底图当语义来源，不能绕过 `track-runtime`。
2. Repo structure advice
   - 检查 Week2 目录是否已有工程配置。
   - 结论：Week2 只有文档、TODO 和可视化 HTML，适合新建独立 Vite 前端。
3. Reviewer risk checklist
   - 从审阅同学角度挑刺。
   - 结论：最容易被挑错的是做成普通榜单、混用 `roundProgress` / `overallProgress`、遗漏 Debug / Validation / Calibrator 复用关系。

## Iteration 1：可运行框架骨架

新增：

- `Week2-Jumbotron/package.json`
- `Week2-Jumbotron/index.html`
- `Week2-Jumbotron/src/main.js`
- `Week2-Jumbotron/src/style.css`
- `Week2-Jumbotron/src/data/mockRaceSnapshot.js`
- `Week2-Jumbotron/src/assets/trackProfile.js`

目标：

- 独立运行 Week2 前端。
- 先搭出 Race Live View 页面区域。
- 数据和资产使用 demo 文件占位，方便后续同学替换。

## Iteration 2：源文档主链路接入

新增：

- `src/adapter/jumbotronAdapter.js`
- `src/runtime/trackRuntime.js`

实现：

- `adaptRaceSnapshot` 把 mock RaceSnapshot 转成运行时输入。
- 默认用 `roundProgress`，只有缺失时才显式标记 `temporary_overallProgress`。
- `createTrackRuntime` 负责校验 TrackProfile、采样 centerline、计算 tangent / normal、应用 lane offset、输出 HorsePose。
- Race Live View 使用 runtime 输出渲染马匹，而不是写死坐标。
- Debug Panel 展示 sampled points、lane offsets、checkpoints、runtime warnings。

## Iteration 3：审阅风险收口

补强：

- 在页面加入 `Framework Role` 边界面板，明确数据、资产、Adapter、runtime 的替换入口。
- 在页面加入 `Track Profile Calibrator Preview`，并复用同一个 `trackRuntime.sampleHorsePose`。
- 更新 `Week2-Jumbotron/README.md`，写明运行命令、已实现链路、未越界范围和审阅检查点。

## Validation Plan

计划执行：

```bash
npm install
npm run build
npm run dev
```

人工检查页面：

- Header、KPI、Track Stage、TOP3、Ticker 是否出现。
- 马匹是否沿 TrackProfile centerline 和 lane offset 分布。
- Debug Panel 是否显示 runtime 检查项。
- Calibrator Preview 是否展示 0 / 25 / 50 / 75 / 100 采样点。
- README 是否能让审阅同学直接对照源文档链路。

## Iteration 4：回到 PoC 内扩展

用户纠偏：独立 Week2 前端不能作为最终实现方向。本次应基于 `ARY/PoC-GRS-001` 现有服务扩展，而不是另起一个和第一周 PoC 脱节的页面。

修正动作：

- 在 `PoC-GRS-001/src/server.js` 增加 `/jumbotron` 公开路由。
- 复用现有公开数据构造 Jumbotron 所需的 RaceSnapshot。
- 在同一文件内补 `Jumbotron Adapter`、`track-runtime`、`HorsePose` 采样、消息降噪、Debug Mode、Calibrator Preview 和三层 Validation。
- 导航新增 `Jumbotron`，和 `Race`、`榜单` 同属公开入口。
- `PoC-GRS-001/src/verify.js` 增加 `/jumbotron` 检查，并复用公开页泄露检查。

本轮再次用蜂群反思覆盖缺口，重点补齐：

- RaceSnapshot → Adapter → RacingEntrySnapshot[] → track-runtime → Race Live View。
- Track Profile Calibrator → track.profile.json 概念 → track-runtime → Race Live View。
- Header、KPI Strip、Main Track Area、Side / Floating Ranking、Bottom Ticker、Attention Items。
- Track Template 字段、两条赛道、八条 lane offset、checkpoint、safe zone、message zone。
- `roundProgress → s → sampled centerline point → tangent → normal → lane offset → HorsePose`。
- 每个 Entry 最多一条 bubble，全局最多三条 bubble；风险、障碍、里程碑优先，其余进入 ticker。
- Debug Mode 展示 centerline samples、lane offsets、checkpoints、collision boxes、stale entries。
- Track Profile Validation、Runtime Validation、Visual Validation。
- 公开页只展示摘要，不展示完整 Session、终端日志、长文本评论流或复杂 diff。

验证结果：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：`VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds`

页面 smoke：

```text
http://127.0.0.1:4400/jumbotron
```

确认包含 Race Live View、Track Profile Calibrator、Debug Mode、Validation、Team 001、Team 002。

## Iteration 5：cc-Jumbotron 审阅后收敛

用户要求 cc-ARY 查看 cc-Jumbotron 消息，并开启持久监听。第一次实现中先用了前台轮询和后台 shell，用户指出不符合要求。随后改成 `Monitor` 监听 mailbox，只输出短事件，把详细消息留在共享 mailbox 和队列文件中。

收到审阅消息：`2026-06-11T07:49:07Z-cc-Jumbotron-38a9016a`。

cc-Jumbotron 结论是“有缺口，不是阻塞”。我重新复核两份源文档后，判断以下建议成立：

- `Calibrator` 是设计时工具，不应默认混入公开 `/jumbotron`。
- 默认公开页应收敛为 `Race Live View`，只展示摘要、态势、位置、风险和协作入口。
- `TrackProfile` 需要更接近源文档推荐契约，补 `name`、`background`、`centerline`、`lanes`、`displayAdjustment`、`riskZones`、`debug`。
- Validation 应拆成真实检查函数，而不是只在页面上列文案。
- Race Live View 缺 Left Rail 小地图、Entry 图例、Track Stage LIVE 标识、底部消息条查看更多、Footer 状态和系统时间。

修正动作：

- `/jumbotron` 默认只展示公开 Race Live View。
- `/jumbotron?debug=1` 才展示 Calibrator Preview、Debug Mode、HorsePose 和三层 Validation。
- `TrackProfile` 保留现有字段兼容渲染，同时补源文档推荐结构，并让 runtime 通过 `normalizeTrackProfile` 使用 `centerline.points` 和 `lanes`。
- 新增 `validateTrackProfile`、`validateRuntimeEntry`、`validateVisualLayout`，覆盖 viewBox、background、centerline、direction、startFinish、lanes、采样连续性、laneId、stale threshold、bubble limit、马匹重叠和气泡避让等检查。
- Race Live View 补小地图、Entry 图例、LIVE 标识、ticker 查看更多、Footer 的 live status、theme、organizer、phase、next phase 和 system time。
- `verify.js` 改成分别检查默认公开页和 `?debug=1` 审阅工具页，并继续对两页执行 `assertNoLeaks`。

本轮记录也回应用户要求：来回审阅、判断和更改过程必须写入 riding record。监听又捕获后续消息 `2026-06-11T08:04:47Z-cc-Jumbotron-5abbddc4`。这条消息补充了视觉审阅标准：Jumbotron 不能只按代码和源文档判断，还要打开 `/jumbotron` 截图，用人类观看大屏的方式检查信息层级、美观度、完整性和交互承载。该建议成立，因为信息架构文档把 Jumbotron 定义为公开大屏容器，P0/P1 信息层级必须能被现场观众快速读懂。

本次已将该标准纳入后续验收：代码验证之外，还要检查默认 `/jumbotron` 的公开画面是否收敛为 Race Live View，并把工具性信息留在 `/jumbotron?debug=1`。

收到复审消息：`2026-06-11T08:16:47Z-cc-Jumbotron-9e6a0d91`。

cc-Jumbotron 复审结论是主线通过，但保留三项后续缺口。我重新对照源文档后，判断这个结论成立：当前框架阶段可以通过，但仍不能把 Preview 说成完整 Calibrator MVP。

本次继续收口低风险项：

- 把页面和验证文案改为 `Track Profile 校准器 Preview`，明确它只是设计时预览，不是完整导入、拖拽编辑、校验导出工具。
- 继续补 Track Profile Validation：lane offset 不重复、profile 版本匹配、background 可加载、弯道转角 warning。
- 继续补 Runtime Validation：profile schema 校验、`obstacleCount`、`violationCount`、`primaryCA` 展示字段检查。
- 梳理 Entry 数据契约：`caProvider` 作为运行时契约字段，`primaryCA` 只作为公开展示文本。
- README 增加 Preview 边界，避免审阅同学误以为当前已经完成完整 Calibrator MVP。

仍不在本轮强行实现的项：

- 完整 Calibrator 设计时工具，包括导入底图、创建/导入 profile、拖拽 centerline、设置方向和起终点、配置 lanes/checkpoints、导出 `track.profile.json`。
- hover tooltip / focus details / 右侧固定详情栏，这属于下一轮视觉交互增强。
- 对弯道自然程度的真实人工视觉判定，目前只能在 Validation 中保留 warning 检查入口。

收到纠偏消息：`2026-06-11T08:59:28Z-cc-Jumbotron-e30db29c`。

cc-Jumbotron 修正了上一轮“主线通过”的表述：结构主线可以通过，但公开 `/jumbotron` 的视觉布局仍未通过。它指出当前首屏 Header 和 KPI 权重过高，主赛道没有成为最显眼的主体。

我重新复核源文档后，判断该纠偏成立：信息架构明确 Race Live View 以赛道主视觉为中心，信息优先级第一项是“当前赛事正在发生什么”；子系统定义也把 Jumbotron 称为运行时大屏主视觉，并要求展示赛道主视觉和根据 `roundProgress` 渲染马匹位置。

本次修正动作：

- 把 Header 压缩为顶部状态条，只保留 `LIVE`、`ARY GRS Jumbotron`、赛事标题、阶段、计时和在线 Rider。
- 把 KPI 从大卡片改成贴边状态 chips，保留总进度、活跃 Rider、Token、Codex / Claude、风险 / 阻塞。
- 扩大公开页宽度和主赛道高度，让 `Track Stage` 在首屏占主要视觉面积。
- 缩窄右侧辅助栏，降低侧栏、ticker 和卡片阴影对主赛道的抢占。

验证结果：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：`VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds`

## Current Boundaries

我们承担框架实现角色，当前只把框架、接口形状和可审阅证据跑通。

仍留给其他分工：

- 数据同学继续替换更真实的 RaceSnapshot、Riding Message 和 attention item 场景。
- 资产同学继续替换正式 `track.profile.json`、背景、checkpoint、safe zone、message zone。
- 审阅同学按两份源文档逐条检查是否还有遗漏或概念漂移。
- 机动同学协助样式、联调、临时阻塞和演示准备。


补充视觉复核：

生成并打开公开页 1920×1080 截图后，按 cc-Jumbotron 提出的“人类观看大屏”标准检查，本轮视觉主次已修正到可接受状态。首屏第一视觉已经从 Header / KPI 卡片转向赛道主视觉；顶部只保留状态条，KPI 变为贴边 chips，右侧栏和底部 ticker 作为辅助信息存在。

截图证据：

```text
Week2-Jumbotron/review-ledger/screenshots/2026-06-11-jumbotron-main-stage-priority-fix/jumbotron-public-1920x1080.png
```

仍保留的后续项：完整 Calibrator 设计时工具、hover tooltip / focus details / 右侧固定详情栏，以及弯道自然程度的人工视觉判定。

收到复审消息：`2026-06-11T09:25:34Z-cc-Jumbotron-2880e31f`。

cc-Jumbotron 复审结论是公开页视觉主次修正通过。我重新复核两份源文档后，判断该通过结论成立：子系统定义要求运行时大屏展示赛事标题、LIVE、KPI、赛道主视觉、马匹位置、消息气泡和底部 ticker；信息架构要求 MVP 只保留 Race Live View，并强调面向现场观众和组织者，突出赛道、位置、追赶关系、实时消息和现场氛围。当前实现已经把 Header 和 KPI 降为辅助状态信息，让 Track Stage 成为首屏最大视觉主体，因此无需继续在本轮修改实现。

本次处理动作：

- 读取 mailbox 最新消息并确认它来自 `cc-Jumbotron`、发给 `cc-ARY`，且此前未处理。
- 复核两份源文档中运行时大屏职责、Race Live View scope、赛道主视觉、KPI strip、Main Track Area 和 debug / Calibrator 边界。
- 采纳复审通过结论，不再做代码改动。
- 继续保留后续项：完整 Calibrator 设计时工具、hover tooltip / focus details / 右侧固定详情栏、弯道自然程度人工判定。

收到实现请求：`2026-06-11T11:28:43Z-cc-Jumbotron-8fc630dc`。

cc-Jumbotron 要求开始下一轮 `hover tooltip / focus details / 右侧固定详情栏`。我重新复核源文档后，判断该请求成立：信息架构的核心交互要求观众能查看项目位置、实时消息和风险，组织者能从 Racing Entry、TOP3、Riding Message、Risk / Obstacle / Violation Item 进入单个项目；同时 Riding Message 气泡规则要求首屏只展示短句，不展示长文本、完整日志或复杂分析。因此更完整的信息应该通过 hover / focus 延迟展示，而不是堆回首屏。

本次实现动作：

- 主赛道 horse / entry marker 增加 SVG hover tooltip，展示队伍名、排名、赛道进度、阶段进度、得分、状态、风险、CA 和最近消息。
- Riding Message 气泡和底部 ticker item 增加 hover tooltip，展示消息类型、severity、entry、summary、createdAt 和目标入口。
- 关注事项增加 hover tooltip，展示 category、severity、summary、status、关联 entry 和下一步建议。
- 右侧栏新增 `焦点详情栏`，点击赛道节点、TOP3、消息或风险项后，通过 anchor target 固定当前焦点对象详情。
- tooltip 以 CSS hover / focus 触发，不直接占据首屏；默认主赛道仍保持第一视觉中心。
- `verify.js` 增加默认 `/jumbotron` 对 hover tooltip 和 focus details 结构的检查，`/jumbotron?debug=1` 继续检查审阅工具。
- `Week2-Jumbotron/README.md` 增加 hover tooltip / 焦点详情栏能力和审阅检查点。

验证结果：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：`VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds`

Live smoke：

```text
JUMBOTRON_FOCUS_SMOKE_PASS
```

截图证据：

```text
Week2-Jumbotron/review-ledger/screenshots/2026-06-11-jumbotron-focus-details/jumbotron-public-1920x1080.png
Week2-Jumbotron/review-ledger/screenshots/2026-06-11-jumbotron-focus-details/jumbotron-entry-focus-1920x1080.png
Week2-Jumbotron/review-ledger/screenshots/2026-06-11-jumbotron-focus-details/jumbotron-message-focus-1920x1080.png
```

看图结论：默认首屏仍以赛道主视觉为中心；entry 和 message 焦点状态只在右侧详情栏展开，符合“短信息首屏展示，完整信息 hover / focus 展开”的边界。

收到复审消息：`2026-06-11T11:41:32Z-cc-Jumbotron-550c197c`。

cc-Jumbotron 复审结论是 `hover tooltip / focus details` 本轮通过。我重新复核源文档后，判断该结论成立：核心交互要求观众通过赛道节点、Riding Message、ticker 和风险标记理解项目位置、实时消息和风险；MVP 约束要求 Jumbotron 只展示摘要，不承载完整 Session、完整日志或复杂分析。当前实现把短信息留在首屏，把完整信息放到 hover / focus / 右侧焦点详情栏，符合该边界。

本次处理动作：

- 确认 11:41 消息来自 `cc-Jumbotron`、发给 `cc-ARY`，且此前未处理。
- 复核两份源文档的核心交互、Race Live View IA、MVP 信息层级和 Debug / Calibrator 边界。
- 采纳复审通过结论，本轮不再做代码改动。
- 继续保留后续项：完整 Calibrator 设计时工具、弯道自然程度人工判定；若后续允许更复杂交互，可把 CSS / anchor MVP 升级为 pointer-follow tooltip、平滑选中态和键盘可访问增强。

收到实现请求：`2026-06-11T14:47:09Z-cc-Jumbotron-accb420f`。

cc-Jumbotron 基于 effective read ledger 追踪到剩余可实现缺口，要求按 5 个工作包继续补齐。我重新复核两份源文档后，判断该请求整体成立：子系统定义明确 Jumbotron 子系统由运行时 Race Live View 和设计时 Track Profile Calibrator 组成；信息架构要求公开大屏只保留 Race Live View，但数据契约、状态机、message 降噪、Track Profile validation 和视觉验收都需要有可复核实现证据。因此本轮继续实现，不 commit / push。

本次实现动作：

1. Calibrator MVP：新增 `/jumbotron/calibrator` 设计时入口，支持粘贴候选 TrackProfile JSON、编辑 centerline points、切换 direction / closed、设置 startFinish、编辑 lanes / checkpoints、Validate、Preview 和 Export track.profile.json。Preview 复用 `createJumbotronRuntime / sampleHorsePose`，Export JSON 包含 schemaVersion、trackId、name、viewBox、background、centerline、direction、startFinish、lanes、checkpoints、messageZones、noBubbleZones、riskZones 和 debug。
2. 数据契约：在 Adapter 输出中明确 `caProvider` 是运行时契约字段，`primaryCA` 是展示标签；补齐 `costTokens`、`costUsd`、`obstacleCount`、`violationCount`、`updatedAt`、`currentPhase` 和 `status`，并新增 Competition / KPI / RacingEntrySnapshot 契约 validation。
3. Runtime / 状态机 / message 降噪：保留 9 个 MVP motionState 映射，新增 `sampleInterpolatedPose` 作为 s-axis interpolation 证据；debug 输出展示 idle、running、sprinting、slowed、blocked、pit_stop、takeover、finished、stale；message plan 保留每 entry 1 条 bubble、全局 3 条、风险/里程碑优先和 ticker fallback 规则。
4. Track Profile / Asset Validation：补方向、闭合/开放点数、startFinish.s、checkpoints.s、lane offset duplicate、NaN / Infinity、采样跳变、曲率 warning、profile version mismatch、background load failure、updatedAt、stale threshold、多马预览、bubble top-overlap、16:9 stable 和人工确认入口。当前已有两条示例 track profile，仍用现有公开资产作为 mock asset，不伪称正式冻结资产。
5. 公开页 IA：默认 `/jumbotron` 继续隐藏 Calibrator Preview、Debug、Validation 和 HorsePose；Calibrator 只作为 footer 链接进入独立设计时入口，不挤压主赛道。后续需要重新生成 1920×1080 截图并记录 3 秒 / 10 秒看图结论。

已更新文件：

```text
PoC-GRS-001/src/server.js
PoC-GRS-001/src/verify.js
Week2-Jumbotron/README.md
riding_record/session-11-week2-jumbotron-framework.md
```

剩余缺口明确保留：

- Calibrator 尚不支持拖拽点位、AI 候选导入、JSON diff preview、debug-preview.png 导出和真实资产冻结流程。
- 弯道自然、多马重叠、气泡遮挡和 checkpoint 视觉语义目前提供人工确认入口，仍需真实人工审阅和资产同学补正式 track asset。

验证结果：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：`VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds`

Live smoke：

```text
JUMBOTRON_NEXT_GAP_SMOKE_PASS
CALIBRATOR_POST_SMOKE_PASS
```

截图证据：

```text
Week2-Jumbotron/review-ledger/screenshots/2026-06-12-jumbotron-next-gap-fix/jumbotron-public-1920x1080.png
Week2-Jumbotron/review-ledger/screenshots/2026-06-12-jumbotron-next-gap-fix/jumbotron-debug-1920x1600.png
Week2-Jumbotron/review-ledger/screenshots/2026-06-12-jumbotron-next-gap-fix/jumbotron-calibrator-1920x1600.png
```

看图结论：公开 `/jumbotron` 3 秒内能识别 LIVE、赛事标题、阶段和在线 Rider；10 秒内能看懂主舞台是赛道主视觉、TOP3、Entry 位置、消息气泡和底部 ticker 共同表达赛事进展。Calibrator / Validation / Debug 没有回到默认首屏，仍通过独立入口或 `?debug=1` 延迟查看。

收到复审消息：`2026-06-11T17:47:04Z-cc-Jumbotron-908afa7f`。

cc-Jumbotron 复审结论是主体实现通过，但严格 validation 与人工确认仍为 partial。我重新复核两份源文档后，判断这 5 个 partial 项成立：子系统定义要求导出前校验 background、方向、lane、checkpoint、path、曲率，并要求 runtime 防御 background 加载失败；Visual Validation 要由 Calibrator 提供马在赛道上、弯道自然、多马严重重叠、气泡遮挡标题 / KPI / 顶部区域和 checkpoint 语义的人工确认。因此不能把“待人工复核”字符串当作通过，也不能只用文案证明 validation 存在。

本次修正动作：

1. 人工确认状态显式化：`manualChecks` 改为 `confirmed / pending / failed` 风格对象；`pending` 只显示“待人工复核”，不再通过 `manual curve confirmation`、`manual bubble clearance confirmation` 或 `manual checkpoint confirmation`。
2. 多马预览 validation 改为实际 HorsePose 证据：检查 8 匹马数量、是否出 viewBox、相互最小距离、严重重叠和弯道方向数值有效，而不是只看 lane 数量。
3. 背景验证拆分：`background file exists` 做真实静态文件存在检查；`background asset allowlist` 只表达当前允许的公开资产列表，不再把 allowlist 伪装成真实加载探测。
4. 气泡顶部遮挡改成矩形估算：按 messageZones offset 和气泡宽高估算 bubble rect，并与顶部保留区相交检测，不再只用 `pose.y > 90`。
5. `verify.js` 补 negative validation smoke：POST `/jumbotron/calibrator` 分别覆盖非法 direction、重复 lane offset、越界 checkpoint、坏 JSON、无效 background、过大转角 / 过短路径，断言页面出现失败态或 warning。

验证结果：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：`VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds`

```bash
git -C /media/lemonhdl/Shared/Software_Engineering/ARY diff --check
```

结果：通过。

本轮没有 commit / push。仍保留为后续 P1 的项：拖拽 centerline points、AI 候选点导入、JSON diff preview、debug-preview.png 导出、气泡区域 / no-bubble zone / risk zone 图形编辑和真实资产冻结流程。

收到复审消息：`2026-06-12T05:00:33Z-cc-Jumbotron-6b0d1d4c`。

cc-Jumbotron 复审结论是 strict validation 主体通过，但 `path length` 最小阈值和人工 confirmed 流程仍为 partial。我重新复核源文档后判断：`path length 大于最小阈值` 是明确 Track Profile Validation 要求，应该立即补；弯道自然和 checkpoint 语义属于 Calibrator 人工确认项，当前没有正式资产确认记录和 completed confirmed 流程，因此应继续保持 pending/partial，不应硬改成通过。

本次修正动作：

- 新增 `JUMBOTRON_MIN_PATH_LENGTH_RATIO`，用 `max(240px, viewBox 对角线 * 0.35)` 作为 MVP 最小路径长度阈值。
- `validateTrackProfile` 的 `path length` 从 `> 0` 改为 `>= minimumTrackPathLength(viewBox)`，并新增 `path length minimum threshold` 校验项。
- `verify.js` 新增 short-path negative smoke：POST `/jumbotron/calibrator` 使用 3 个相邻 1px 点构造过短路径，断言出现 `! 路径长度` 和 `! 路径长度最小阈值`。
- README 更新 strict validation 范围，明确过短路径也进入 negative smoke。
- 人工确认项继续保持 pending，不声称弯道自然和 checkpoint 语义完全 implemented。

验证结果：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：`VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds`

```bash
git -C /media/lemonhdl/Shared/Software_Engineering/ARY diff --check
```

结果：通过。

本轮没有 commit / push。

本轮没有 commit / push。

收到实现请求：`2026-06-12T05:54:46Z-cc-Jumbotron-535e0538`。

cc-Jumbotron 不是继续复审 path length，而是按 effective read ledger 主动推动低覆盖行：Calibrator 的工具 IA、MVP 交互完整性、P1 显式边界，以及 Race Live View 容器 / Footer 完整性确认。我重新复核源文档后判断该请求成立：`jumbotron-subsystem-definition.md:213-276` 明确 Calibrator 四区、MVP 13 项和 P1 8 项；`jumbotron-information-architecture.md:241-335` 明确 Jumbotron Container、Race Live View 主舞台和 Footer 字段。

本次实现动作：

1. Calibrator 从单段表单推进为设计 / 资产生产工具：`/jumbotron/calibrator` 改为 Top Toolbar、Main Canvas、Right Inspector、Bottom Preview Bar 四区；Top Toolbar 明确 Import Background、Import Candidate Profile、Validate、Preview、Export。
2. Main Canvas 显示 Background Layer、Centerline Layer、Control Points Layer、Lane Preview Layer、Checkpoint Layer、Horse Preview Layer、Message Bubble Preview Layer；Preview 继续复用 `createJumbotronRuntime / sampleHorsePose`。
3. Right Inspector 按 Track Info、Geometry、Start / Finish、Direction、Lanes、Checkpoints、Message Bubble、Validation Results 分组；支持 background asset 选择 / 输入、centerline JSON 编辑、添加点、删除点、反转路径方向、closed、direction、startFinish、lanes、checkpoints、messageZones、noBubbleZones 和 riskZones。
4. Bottom Preview Bar 增加 Progress Scrubber、Horse Count、Speed、Play / Pause、Scenario Presets；POST smoke 覆盖 scrubber 进度、多马数量和 scenario preset 状态。
5. Calibrator P1 八项全部作为 pending backlog 显示：气泡区域编辑、no bubble zone 编辑、风险区域编辑、AI 候选点导入、自动检测尖角、自动分配 lanes、导出 debug-preview.png、JSON diff preview。不把拖拽、AI、diff、png 或真实资产 confirmed 伪装成完成。
6. Race Live View Footer 保持 Theme、Organizer、Current Phase、Next Phase、System Time；默认 `/jumbotron` 继续以 Track Stage 为首屏最大视觉主体，Debug / Validation / Calibrator 不回默认首屏。

更新文件：

```text
PoC-GRS-001/src/server.js
PoC-GRS-001/src/verify.js
Week2-Jumbotron/README.md
riding_record/session-11-week2-jumbotron-framework.md
Week2-Jumbotron/review-ledger/review-events.jsonl
```

验证结果：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：`VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds`

```bash
git -C /media/lemonhdl/Shared/Software_Engineering/ARY -c core.filemode=false diff --check
```

结果：通过。

截图证据：

```text
Week2-Jumbotron/review-ledger/screenshots/2026-06-12-jumbotron-calibrator-ia-mvp-p1/jumbotron-public-1920x1080.png
Week2-Jumbotron/review-ledger/screenshots/2026-06-12-jumbotron-calibrator-ia-mvp-p1/jumbotron-calibrator-1920x1600.png
```

看图结论：公开 `/jumbotron` 的 Header / KPI 仍是辅助状态信息，Track Stage 继续占据首屏最大视觉面积；Footer 在页面底部保留赛事状态、主题、主办方、阶段、下一步和系统时间。Calibrator 截图能看到顶部工具条、候选 profile / background 导入、主画布层、右侧 inspector 和底部 preview bar；P1 backlog 继续显式标为 pending。

本轮没有 commit / push。

收到复审消息：`2026-06-12T06:38:52Z-cc-Jumbotron-acc8e5e4`。

cc-Jumbotron 复审结论是 Calibrator IA/MVP/P1 边界与 Race Live View Footer 证据主体通过，但 P1 八项、拖拽 centerline points、完整 smoothing、正式资产 confirmed 和 adapter 缺失数据负向 smoke 仍保持 partial/pending。我重新复核源文档后判断该结论成立：`jumbotron-subsystem-definition.md:267-276` 把 JSON diff preview 列为 P1 项，而它边界清楚、可 smoke、可截图；相比 zone editing 或 debug-preview.png，更适合作为本轮小目标先推进。

本次实现动作：

- 在 Calibrator workbench 中新增 imported profile 与 exported frozen candidate 的字段级差异计算，覆盖 trackId、name、background.src、centerline.closed、centerline.smoothing、centerline.points、direction、startFinish、lanes、checkpoints、messageZones、noBubbleZones 和 riskZones。
- `/jumbotron/calibrator` 新增 `JSON diff preview` 面板，展示字段、Imported profile、Exported candidate 和 changed 状态；默认无差异时显示“暂无字段差异”。
- P1 backlog 中只把 `JSON diff preview` 从 pending 改为 implemented，其余气泡区域编辑、no-bubble zone 编辑、风险区域编辑、AI 候选点导入、自动检测尖角、自动分配 lanes、导出 debug-preview.png 继续保持 pending。
- `verify.js` 增加默认空 diff 和 add-point POST 后 `centerline.points` 差异的 smoke。

验证结果：

```bash
node --check /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/src/server.js
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：`VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds`

仍 pending：拖拽 centerline points、完整 smoothing runtime / visual preview、正式资产 confirmed、气泡 / no-bubble / risk zone 画布编辑、AI 候选导入、自动检测尖角、自动分配 lanes、debug-preview.png 导出、malformed adapter input negative smoke。

本轮没有 commit / push。

## Iteration 13：主赛道信息密度与协作路由纠偏

本轮输入由两类 prompt 共同构成：

1. 用户直接 steer：继续以人类观看大屏的视角检查 `/jumbotron`，指出右侧侧边栏应改到左侧并与主视图等高；队伍名称 label 的逻辑 bbox 太大、Entry 与名称距离太远、可视白底文本框不必要；`Start / Finish`、`Far Turn`、`Back Straight`、`Home Straight` 等英文赛段术语不适合中文观众。
2. cc-Jumbotron 来信概括：先确认 label bbox 自适应布局主体通过，但提醒 tie-break 表述与实现要对齐、label-bubble overlap 仍是 soft penalty；随后一度转发 data profile / debug / adapter checklist 给 cc-ARY，后在用户纠偏后撤回该请求，并确认 data checklist 应由 cc-data 自行实现，cc-ARY 不需要修改 runtime/debug/adapter。之后 cc-Jumbotron 又发来下一轮待处理 prompt：聚焦 `/jumbotron` Race Live View 的页面文案去重、可读性、美观、赛事大屏体验、label-bubble overlap、风险/阻碍/违规摘要和 drill-down 表达；该来信已作为后续实现输入记录，本节不把它写成已完成事项。

本轮判断：这些不是新增功能，而是信息架构和视觉可读性的局部收敛。Jumbotron 面向现场观众，辅助栏、队伍名称和赛段文案都必须服务于“快速理解当前比赛在哪里、谁在什么位置、当前到了赛道哪一段”。因此应优先压缩视觉噪声和英文术语，而不是继续增加 debug 信息。

实现动作：

1. 左侧侧边栏：
   - 将 Race Live View 的专属布局容器改为 `jumbotron-live-layout`，只影响公开 `/jumbotron`，避免误改 Calibrator 的 inspector 布局。
   - 侧边栏放到左侧，主赛道放到右侧。
   - 主视图和侧边栏使用同一行固定高度；侧边栏内容超出时在侧栏内部滚动，避免把主赛道整行撑高。

2. 队伍名称 label 收紧：
   - 将 horse label 字号从 18px 收到 16px。
   - 将 label padding 从 `10 / 5` 收到 `6 / 3`。
   - 将 inner / outer candidate gap 从 `38 / 72` 收到 `28 / 52`。
   - 文本宽度估算同步收紧，减少队伍之间无意义空白。
   - 保留 `data-label-x/y/width/height` 作为逻辑 bbox 供避让和 verify 使用，但移除公开 SVG 中的可见 `horse-label-bg` rect；最终画面只显示队伍名称文字本身。
   - verify 改为断言不再渲染可见 label 背景框，同时继续检查逻辑 bbox、label-label overlap、label-marker overlap、viewBox 和完整 `displayName · progress%` 文本。

3. checkpoint / Calibrator 文案：
   - 将 curated `track.profile.json` 中 `Start / Finish` 改为 `终点线`。
   - 将 Calibrator inspector 面板中的 `Start / Finish` 标题改为 `终点线`。
   - 用户指出 `Far Turn`、`Back Straight`、`Home Straight` 不直观；本轮记录其含义分别是远端弯道、对面直道、终点直道。后续应优先改成中文赛段名，例如“第一弯道 / 对面直道 / 终点前弯道 / 冲刺直道”，避免让观众理解英文赛马术语。

4. cc-Jumbotron / cc-data 路由纠偏：
   - cc-Jumbotron 一度把 data profile / debug / adapter checklist 转给 cc-ARY 实现。
   - 用户明确纠正：cc-data 负责的内容应让 cc-data 自己实现，不应转给 cc-ARY 代做。
   - 我按用户决策回信 cc-Jumbotron，说明 cc-ARY 暂不接该任务；cc-Jumbotron 随后更正路由并撤回对 cc-ARY 的实现要求。
   - 当前结论：cc-ARY 本轮不修改 `/jumbotron` runtime、debug panel 或 adapter；只有当 cc-data 已给出可复验输入 / 输出契约，并由 cc-Jumbotron 拆成明确 UI/runtime 小项后，才进入实现线。

验证结果：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：`VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds`

页面 smoke 结果：

- `/jumbotron` 返回 200。
- `/jumbotron/calibrator` 返回 200。
- 页面已包含 `终点线`，不再包含 `Start / Finish` 或 `Start/Finish`。
- label summary：`data-label-overlaps=0`、`data-label-marker-overlaps=0`、`data-label-out-of-viewbox=0`。
- 公开 SVG 中不再渲染可见 `horse-label-bg` 文本框，但保留逻辑 bbox data attributes。

截图证据：

```text
Week2-Jumbotron/review-ledger/screenshots/2026-06-12-jumbotron-left-sidebar/jumbotron-left-sidebar-equal-height-4419-1920x1080.png
Week2-Jumbotron/review-ledger/screenshots/2026-06-12-jumbotron-compact-labels/jumbotron-left-sidebar-compact-labels-no-box-4419-1920x1080.png
```

本轮没有 commit / push。
