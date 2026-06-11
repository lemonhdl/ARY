# Week2 Jumbotron

第二周围绕 DevCompass Racing 的 Jumbotron 子系统展开。

## 核心文档

- `docs/source/jumbotron-subsystem-definition.md`：Jumbotron 子系统定义，覆盖运行时大屏、Calibrator、track-runtime、Adapter、资产契约、验证和工程边界。
- `docs/source/jumbotron-information-architecture.md`：Jumbotron 信息架构，覆盖 Race Live View、核心信息对象、页面层级、交互、展示边界和 MVP 落地约束。

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

## 框架实现边界

我们负责先跑通框架，不替数据同学和资产同学做最终内容。

已实现：

- `DCR RaceSnapshot → Jumbotron Adapter → RacingEntrySnapshot[] → track-runtime → Jumbotron / Race Live View`。
- `Track Profile → track-runtime → Race Live View / Track Profile Calibrator Preview`。
- `Track Profile Calibrator Preview` 不是完整 Calibrator MVP；完整导入、拖拽编辑、校验导出应作为独立设计时工具继续实现。
- 默认 `/jumbotron` 只展示公开 Race Live View；`/jumbotron?debug=1` 展示 Calibrator Preview、Debug Mode 和 Validation 审阅工具。
- Race Live View 的 Header、KPI Strip、Main Track Area、Side / Floating Ranking、Bottom Ticker。
- 公开 `/jumbotron` 把 Header 压缩为顶部状态条，把 KPI 改为贴边状态 chips，让赛道主视觉成为首屏第一视觉中心。
- 公开 `/jumbotron` 支持队伍节点、消息气泡、风险项和底部 ticker 的 hover tooltip；点击或键盘 focus 可把对象固定到右侧 `焦点详情栏`。
- `roundProgress → s → centerline point → tangent / normal → laneOffset → HorsePose`。
- Debug Mode 面板、runtime warnings、TrackProfile / lane / checkpoint 检查入口。
- Calibrator Preview 使用同一个 `track-runtime`，没有另写一套预览计算。

未越界：

- 不实现真实后端聚合。
- 不实现权限、房间、Workshop 上下文。
- 不定义最终排名语义。
- 不展示完整 Coding Agent Session、终端日志、长文本评论流或复杂代码 diff。
- 不把 `background.webp` 当语义事实来源；位置只来自 TrackProfile 几何和进度。

## 审阅检查点

- 是否仍然只保留 `race_live / Race Live View`，没有扩展第二大屏。
- 是否保留两条源文档链路，并在 `track-runtime` 汇合。
- 是否默认用 `roundProgress` 驱动马匹位置，而不是 `overallProgress` 或写死坐标。
- 是否把 `track.profile.json` / TrackProfile 当事实来源，底图只当视觉资产。
- 是否保留 Debug Mode、三类 Validation 和 MVP 验收入口；这些默认不出现在公开大屏，只在 `?debug=1` 中给审阅和资产校准使用。
- 是否把 Calibrator 明确称为 Preview，避免把当前页面误判为完整设计时工具。
- 是否把 Header 和 KPI 控制为辅助状态信息，让 Track Stage / 赛道主视觉成为首屏最大、最显眼的主体。
- 是否用 hover tooltip / 焦点详情栏承载完整信息，而不是把长文本重新堆回公开大屏首屏。
- 是否清楚标出数据、资产、审阅和机动同学的后续替换边界。

## 当前范围

- 使用 `ARY` 仓库继续第二周开发。
- 第二周文档、代办和可视化放在 `Week2-Jumbotron/`。
- 可运行 Jumbotron 基于 `ARY/PoC-GRS-001` 现有服务扩展，公开入口为 `/jumbotron`。
- 第一周提交存档在 `/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang`。
