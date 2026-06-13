# Week2 Jumbotron

第二周围绕 DevCompass Racing 的 Jumbotron 子系统展开。

## 核心文档

当前审阅与实现以三份核心文档为准：

- `docs/core/ARY GRS 002 Jumbotron 评审标准.md`：评分标准与一票否决项。
- `docs/core/Jumbotron信息架构.md`：Race Live View、核心信息对象、页面层级、交互和展示边界。
- `docs/core/Jumbotron子系统定义.md`：运行时大屏、Calibrator、track-runtime、Adapter、资产契约、验证和工程边界。

`docs/source/` 下的两份早期文档保留为工作副本和历史来源，不再作为唯一审阅口径。

## 工作入口

- `docs/source/jumbotron-subsystem-definition.md`：Jumbotron 子系统定义，覆盖运行时大屏、Calibrator、track-runtime、Adapter、资产契约、验证和工程边界。
- `docs/source/jumbotron-information-architecture.md`：Jumbotron 信息架构，覆盖 Race Live View、核心信息对象、页面层级、交互、展示边界和 MVP 落地约束。
- `TODO.md`：完整代办清单、源文档内容关键路径、并行关系和后置责任挂载。
- `jumbotron-workflow-visual.html`：源文档内容路径、责任挂载和覆盖关系的可视化页面。
- `../PoC-GRS-001/src/server.js`：当前主实现，在现有 PoC 服务内提供 `/jumbotron`。
- `../PoC-GRS-001/src/verify.js`：公开页和 `/jumbotron` 验证入口。

`index.html` 和 `src/` 保留为早期独立前端试验记录，不作为最终主线。

## 运行

```bash
npm --prefix ../PoC-GRS-001 start
```

打开：

```text
http://127.0.0.1:4400/jumbotron
```

常用复核 URL：

```text
http://127.0.0.1:4400/jumbotron?profile=full
http://127.0.0.1:4400/jumbotron?profile=smoke-8
http://127.0.0.1:4400/jumbotron?profile=coverage-9
http://127.0.0.1:4400/jumbotron?debug=1&profile=full
http://127.0.0.1:4400/jumbotron/calibrator
http://127.0.0.1:4400/jumbotron/calibrator?demo=1
http://127.0.0.1:4400/jumbotron/debug-preview.png
http://127.0.0.1:4400/api/jumbotron-data-evidence?profile=full
```

## 框架实现边界

我们负责先跑通框架，不替数据同学和资产同学做最终内容。

已实现：

- `DCR RaceSnapshot → Jumbotron Adapter → RacingEntrySnapshot[] → track-runtime → Jumbotron / Race Live View`。
- `Track Profile → track-runtime → Race Live View / Track Profile Calibrator Preview`。
- 新增 `/jumbotron/calibrator` 作为 Track Profile Calibrator MVP：按 Top Toolbar / Main Canvas / Right Inspector / Bottom Preview Bar 四区组织，支持 Import Background、Import Candidate Profile、添加 / 删除 / 拖拽 centerline points、checkpoint / start-finish handle / zone proof、反转路径方向、平滑路径预览提示、scrubber 单马预览、多马预览、Message Bubble Preview、Validate、JSON diff preview、debug preview PNG evidence 和 Export frozen track.profile.json candidate。
- `/jumbotron/calibrator` 的 Preview 复用 `createJumbotronRuntime / sampleHorsePose`，Export JSON 可重新被 Race Live View 或 debug preview 消费；导出的 frozen candidate 需要经过 asset review 三态确认，不等于默认正式资产 confirmed。
- `/jumbotron/calibrator?demo=1` 提供推荐录制路径；`/jumbotron/debug-preview.png` 提供可引用的 debug preview PNG 证据。
- 默认 `/jumbotron` 只展示公开 Race Live View；`/jumbotron?debug=1` 展示 Calibrator Preview、Debug Mode 和 Validation 审阅工具。
- `/jumbotron?profile=full|smoke-8|coverage-9` 支持三套 data profile runtime 切换；canonical id 分别为 `curated-full-12`、`smoke-8-visual-low-load`、`coverage-9-enum-complete`。
- `/jumbotron?debug=1&profile=...` 和 `/api/jumbotron-data-evidence?profile=...` 展示 counts、coverage、publicHiddenFields、validatorStatus、profileUsageGuard 与 lastMessage mapping evidence；非法 profile 不 silent fallback。
- Race Live View 的 Header、KPI Strip、Main Track Area、Side / Floating Ranking、Bottom Ticker。
- 公开 `/jumbotron` 把 Header 压缩为顶部状态条，把 KPI 改为贴边状态 chips，让赛道主视觉成为首屏第一视觉中心。
- 公开 `/jumbotron` 支持队伍节点、消息气泡、风险项和底部 ticker 的 hover tooltip；点击或键盘 focus 可把对象固定到右侧 `焦点详情栏`。
- 默认 `/jumbotron` 使用已人工确认的第二赛道 `real-explicit-closed-course`；旧公开赛道仍可通过 `/jumbotron?profile=full&track=default-public-track` 显式切回。
- `real-explicit-closed-course` 资产位于 `mock-data/raw/mock_data/tracks/real-explicit-closed-course/`，底图、preview、profile、provenance、validation 和 human trace 证据共同构成第二赛道提交材料。
- 公开 `/jumbotron` 已接入 `background1.png`、第二赛道 `background.webp` 和 `rider3_run/walk/stay` 人马 sprite；label、排名、bubble、状态仍由 runtime 动态渲染，不写死进图片。
- 当前 `track.profile.json` 已按底图重新校准中心线和泳道偏移；HorsePose 仍保留 rotation 作为切向证据，渲染层只把人马 sprite 水平翻转为 left/right，文字与状态 pill 保持正向。
- `roundProgress → s → centerline point → tangent / normal → laneOffset → HorsePose`。
- Runtime 增加 `sampleInterpolatedPose` 作为 s-axis interpolation 证据，避免在弯道上做 x/y 直线补间。
- Debug Mode 面板、runtime warnings、TrackProfile / lane / checkpoint 检查入口。
- Validation 增加 Competition / KPI / RacingEntrySnapshot 契约、状态机覆盖、stale、bubble limit、ticker fallback、多马预览、气泡顶部遮挡和人工确认入口。
- 严格 validation 已区分真实失败态和人工 pending：`待人工复核` 不再算通过；多马预览检查实际 HorsePose 数量、出界、相互距离和严重重叠；气泡顶部遮挡用 message zone 与气泡矩形估算；背景检查区分真实文件存在和 allowlist；path length 使用基于 viewBox 对角线比例的 MVP 最小阈值；Calibrator POST 覆盖非法 direction、重复 lane offset、越界 checkpoint、坏 JSON、无效背景、过大转角和过短路径的 negative smoke。

未越界：

- 不实现真实后端聚合。
- 不实现权限、房间、Workshop 上下文。
- 不定义最终排名语义。
- 不展示完整 Coding Agent Session、终端日志、长文本评论流或复杂代码 diff。
- 不把 `background.webp` 当语义事实来源；位置只来自 TrackProfile 几何和进度。
- Calibrator 已完成 proof/demo、真实拖拽证据、zone proof、asset review `pending / confirmed / rejected` 三态、JSON diff preview、鼠标描线模式、自动尖角修复证据和 `debug-preview.png` 证据导出；第二赛道 `real-explicit-closed-course` 已通过人工确认并成为默认 Jumbotron 赛道。

## 审阅检查点

- 是否仍然只保留 `race_live / Race Live View`，没有扩展第二大屏。
- 是否保留两条源文档链路，并在 `track-runtime` 汇合。
- 是否默认用 `roundProgress` 驱动马匹位置，而不是 `overallProgress` 或写死坐标。
- 是否把 `track.profile.json` / TrackProfile 当事实来源，底图只当视觉资产。
- 是否保留 Debug Mode、三类 Validation 和 MVP 验收入口；这些默认不出现在公开大屏，只在 `?debug=1` 中给审阅和资产校准使用。
- 是否把 `/jumbotron/calibrator` 作为独立设计时工具入口，而不是把公开大屏或 debug 静态区误称为完整 Calibrator。
- 是否能在 Calibrator MVP 中完成 Import Background / Import Candidate Profile / Validate / Preview / Export，并确认 Preview 复用 `track-runtime`。
- 是否按源文档呈现 Calibrator 四区：Top Toolbar、Main Canvas、Right Inspector、Bottom Preview Bar，并包含 background、centerline、control points、lane、checkpoint、horse、message bubble preview layers。
- 是否用 POST smoke 证明 centerline 添加 / 删除、反转方向、scrubber progress、horse count 和 scenario preset 会改变页面状态，而不是只写文案。
- 是否把 Header 和 KPI 控制为辅助状态信息，让 Track Stage / 赛道主视觉成为首屏最大、最显眼的主体。
- 是否用 hover tooltip / 焦点详情栏承载完整信息，而不是把长文本重新堆回公开大屏首屏。
- 是否在 debug / validation 中能看到 caProvider、obstacleCount、violationCount、updatedAt、状态机、stale、bubble limit、ticker fallback 和多马预览证据。
- 是否把人工确认显式标成 `confirmed / pending / failed`，并保证 `pending` 不会被当成通过。
- 是否用 negative smoke 证明非法 direction、重复 lane offset、越界 checkpoint、坏 JSON、无效背景、过大转角和过短路径会进入失败或 warning 状态。
- 是否清楚标出数据、资产、审阅和机动同学的后续替换边界。

## 当前范围

- 使用 `ARY` 仓库继续第二周开发。
- 第二周文档、代办和可视化放在 `Week2-Jumbotron/`。
- 可运行 Jumbotron 基于 `ARY/PoC-GRS-001` 现有服务扩展，公开入口为 `/jumbotron`。
- 第一周提交存档在外部 Classroom 仓库，本仓库只保留内部开发材料和可回溯知识库。
