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
