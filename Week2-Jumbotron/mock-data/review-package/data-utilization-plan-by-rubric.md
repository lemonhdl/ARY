# 基于《ARY GRS 002 Jumbotron 评审标准》的 mock-data 高质量利用计划

- 生成时间：2026-06-12T13:41:12.890395+00:00
- 核心文档：`/media/lemonhdl/Shared/Software_Engineering/ary-grs-002-sinbawang/ARY GRS 002 Jumbotron 评审标准.md`
- 范围：严格以最新评审标准为主轴，逐行说明当前 mock-data 如何被利用；其中视觉资产、短视频、Calibrator UI 属于整套作品要求，但不计入狭义 data 缺口。
- 行号规则：以下 `Lx` 为 Markdown 文件实际行号，生成时从原文件逐行读取，保留 line -> text，避免段落摘要行号错位。

## 0. 当前 data 资产

- 全量数据：`PoC-GRS-001/jumbotron-mock-data/curated/race-snapshot.json`
- TrackProfile 数据：`PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json`
- 字段映射报告：`Week2-Jumbotron/mock-data/review-package/field-mapping-report.json`
- 三文档覆盖报告：`Week2-Jumbotron/mock-data/review-package/rubric-data-coverage-report.json`
- 低负载 smoke：`Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-8.json`
- 枚举覆盖 smoke：`Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-9-coverage.json`
- 校验脚本：`Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js`
- Runtime profile 入口：`/jumbotron?profile=full|smoke-8|coverage-9`
- Runtime debug 入口：`/jumbotron?debug=1&profile=full|smoke-8|coverage-9`
- Runtime JSON evidence：`/api/jumbotron-data-evidence?profile=full|smoke-8|coverage-9`

## 1. 结论

当前 mock-data 若被充分利用，足够支撑 100 分作品中的 data 证据链：RaceSnapshot、Racing Entry、KPI、Riding Message、AttentionItem、risk/obstacle/violation、progress、token/cost、motionState、stale、public-hidden 字段和 adapter 输入均具备。
Runtime 已接入 full / smoke-8 / coverage-9 profile selector、debug data evidence panel、lastMessage mapping evidence 和只读 JSON evidence endpoint。
但 mock-data 不能单独替代短视频、Calibrator UI、视觉资产、人工视觉审阅和最终展示质量；这些必须由 cc-ARY/cc-Jumbotron 把 data 接成可视化、debug、视频和文档证据。

## 2. 数据覆盖快照

- entries：12
- messages：13
- attentionItems：13
- motionStates：blocked, finished, idle, pit_stop, running, slowed, sprinting, stale, takeover
- messageTypes：milestone, obstacle, pit_stop, progress_update, quality_signal, risk_alert, strategy_change, takeover, violation
- attentionCategories：obstacle, risk, violation
- lanes：12
- checkpoints：4

## 3. 三套数据的高质量使用方式

| 数据 | 用途 | 不应误用 |
| --- | --- | --- |
| curated full 12 entries | 证明完整数据承载、完整 KPI、完整 attention/messages、真实压力 | 不一定作为视频主视觉，避免过载 |
| smoke-race-snapshot-8 | 证明 Race Live 视觉清爽、适合课堂大屏 | 不用于证明 9 种 motionState 全覆盖 |
| smoke-race-snapshot-9-coverage | 证明 9 种 motionState 和 9 种 message type 全覆盖 | 不用于证明最低视觉负载 |

## 4. 逐行利用计划

| 行号 | 原文 | 分类 | data 判断 | 利用计划 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| L1 | # ARY GRS 002 Jumbotron 评审标准 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L2 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L3 | ## 一、评审目标 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L4 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L5 | **ARY GRS 002：Jumbotron** 的评审重点，不是看谁做了一张更炫的大屏设计图，而是看参赛团队是否能够围绕 ARY / DCR 的赛事现场展示命题，提出并实现一个可运行、可解释、可校准、可复用的 **Jumbotron 子系统 PoC**，并通过短视频清楚说明： | 核心目标 | data 是“可运行、可解释、可复用”的证据之一；不能停留在 JSON 文件。 | 把 full / smoke-8 / coverage-9 三套数据分别用于完整性、视觉低负载、枚举覆盖展示。 | 文档和视频中必须指向 review-package 与 validator pass。 |
| L6 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L7 | > Jumbotron 如何把 RaceSnapshot、Racing Entry、Riding Message、风险与违章信息，映射为现场观众、组织者、教师和助教可以理解的赛事大屏； | 核心数据映射 | 当前 data 覆盖 RaceSnapshot、Racing Entry、Riding Message、risk/violation/obstacle。 | 在 Demo 中按 RaceSnapshot → Adapter → Runtime → Race Live View 讲解数据流。 | field-mapping-report 与 rubric-data-coverage-report 可追踪到字段。 |
| L8 | > Calibrator 如何把 AI 生成或人工绘制的赛道底图，校准为可被运行时稳定使用的 `track.profile.json`。 | TrackProfile 边界 | TrackProfile 数据存在；视觉底图与 Calibrator 体验不属于狭义 data 线。 | data 线只证明 profile 结构、centerline、laneOffsets、checkpoints 可被 runtime 使用。 | 视觉资产和 Calibrator 由 cc-Jumbotron/cc-ARY 另行截图验证。 |
| L9 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L10 | 本次 Race 评审的是学生作为 **智能体工程师 / Agentic Engineer** 的综合能力，包括实时可视化理解、交互与信息架构、前端工程实现、几何与动画建模、资产生产工具设计、演示表达，以及与 Agent 协同完成真实创造的 **Agent Riding Skill**。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L11 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L12 | GRS-002 的核心不是“做一个好看的 Jumbotron”，而是证明： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L13 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L14 | > 一块赛事大屏可以由可信数据、可信赛道几何和可维护资产流程驱动，而不是靠手写位置、静态贴图或一次性动画伪装出来。 | 可信数据驱动 | data 已避免把业务事实写成固定 x/y；用 roundProgress、laneId、track geometry 支撑位置派生。 | 在 debug mode 展示 s/pose/laneId，而不是展示硬编码坐标。 | validate 脚本检查 progress 范围和 lane 输入。 |
| L15 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L16 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L17 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L18 | ## 二、硬性入围门槛 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L19 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L20 | 作品必须满足以下 5 个基本条件，才进入正式评分。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L21 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L22 | ### 1. 必须有可运行或清楚可演示的 Jumbotron / Race Live View | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L23 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L24 | 作品必须提供一个可以运行或稳定演示的 Jumbotron 原型，用来展示赛事直播态势。 | 可运行大屏数据输入 | 当前 curated full 可直接驱动 /jumbotron。 | 用 full 数据作为主演示数据源，用 smoke 数据作为评审解释样例。 | PoC verify 与 data validator 均 pass。 |
| L25 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L26 | Jumbotron 至少应包含： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L27 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L28 | - 赛事标题、LIVE 状态、Round / Phase、计时； | 赛事上下文 | competition 覆盖 title/liveStatus/currentRound/currentPhase/elapsedTime/systemTime。 | Header/Footer/KPI 中展示这些字段。 | 页面截图需显示标题、LIVE、Round/Phase、计时。 |
| L29 | - 赛事级 KPI，例如完成度、活跃骑手、Tokens、Codex / Claude 使用； | KPI | kpi 覆盖 completionRate、activeRiders、tokens、Codex/Claude usage/share。 | KPI Strip 显示完成度、活跃骑手、tokens、Codex/Claude 占比。 | 验证页面中可见 KPI 且不泄漏内部路径。 |
| L30 | - Race Live 主赛道； | Race Live 主赛道 | TrackProfile 提供 viewBox、centerlinePath、laneOffsets、checkpoints。 | 用 roundProgress 驱动赛道位置，data 不写死马匹位置。 | debug mode 显示 centerline/lane/checkpoint。 |
| L31 | - 多个 Racing Entry 的位置、排名、项目 / 骑手标签； | 多个 Entry | 当前 full 有 12 个 entries，smoke-8 有 8 个，coverage-9 有 9 个。 | full 展示承载能力；smoke-8 展示低负载视觉；coverage-9 展示状态覆盖。 | 三个数据源的用途写入说明文档。 |
| L32 | - TOP3 或领先者展示； | TOP3 | entries 有 rank、score、progress、gapLabel。 | TOP3 卡片展示 rank/score/progress/risk/message。 | 截图确认 TOP3 不抢主赛道。 |
| L33 | - Riding Message 气泡或底部 ticker； | Message | messages 覆盖 bubble 与 ticker，两种 displayMode 都存在。 | 风险/里程碑优先 bubble，普通消息 fallback ticker。 | 运行时验证每 Entry 最多 1 bubble、全局最多 3 bubble。 |
| L34 | - 风险 / 阻碍 / 违规提醒。 | 风险提醒 | attentionItems 覆盖 obstacle, risk, violation。 | 右侧/底部/赛道标记展示 risk/obstacle/violation。 | 截图和 validator 共同证明三类注意事项存在。 |
| L35 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L36 | 如果作品只是静态设计稿、PPT 截图或不可操作的视频动画，不能进入高分区。 | 不是静态设计稿 | data 有进度、状态、消息、updatedAt，不是一次性静态画面。 | 视频中切换数据子集或展示 debug 数据源，证明页面由数据驱动。 | 不要只录静态页面。 |
| L37 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L38 | ### 2. 必须有 Calibrator 或可验证的赛道校准流程 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L39 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L40 | 作品必须说明并演示赛道底图如何变成可运行的语义赛道资产。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L41 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L42 | 至少需要体现： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L43 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L44 | - 导入或使用一张赛道底图； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L45 | - 定义或编辑 centerline points； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L46 | - 设置起点 / 终点或方向； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L47 | - 配置 lane offsets； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L48 | - 预览单马或多马运行； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L49 | - 导出或展示 `track.profile.json`； | profile 使用说明 | data 侧提供 track.profile.json，可被 runtime 使用。 | 文档说明 profile 如何进入 Jumbotron；不要宣称 asset 线已经完整。 | Calibrator 截图另行验收。 |
| L50 | - 说明 Jumbotron 如何使用该 profile。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L51 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L52 | Calibrator 可以是完整工具、简化工具、开发者工具页，或具备清楚操作流程的 PoC，但不能完全没有赛道校准过程。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L53 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L54 | ### 3. 不能把赛马位置写死在图片或设计稿里 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L55 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L56 | 作品必须明确体现： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L57 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L58 | - 赛道底图只负责视觉； | 底图只负责视觉 | data 线把 background 标为 asset/visual 边界。 | 公开说明 background 不承载语义，centerlinePath 才承载位置事实。 | 文档中避免把背景图说成业务事实来源。 |
| L59 | - 赛道几何由 `track.profile.json` 或等价结构描述； | 语义赛道几何 | track.profile.json 包含 centerlinePath、lanes、laneOffsets、checkpoints。 | debug 展示几何；validator 检查 profile 数据。 | 截图与 JSON 同时证明。 |
| L60 | - 马匹位置由进度、路径采样和 lane offset 派生； | 位置派生 | entries 有 roundProgress/laneId；track 有 path/offset。 | adapter/runtime 由 progress + sampling + lane offset 计算 horse pose。 | debug mode 展示 horse s value。 |
| L61 | - 排名、进度、风险和消息由数据驱动； | 排名风险消息由数据驱动 | rank/progress/riskLevel/messages/attention 都来自 RaceSnapshot。 | UI 只渲染摘要，不写死排名或风险标记。 | 修改数据可改变展示。 |
| L62 | - 不能把马匹、排名编号、气泡和风险标记直接画死在底图中。 | 不能画死 | data 不包含固定 horse x/y 业务事实。 | 把固定视觉调参限制在 displayAdjustment/profile，不作为 Entry 事实。 | 审查 Entry 字段不出现业务 x/y。 |
| L63 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L64 | 如果方案本质上只是“背景图 + 写死坐标 + 固定动画”，不符合 GRS-002 核心命题。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L65 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L66 | ### 4. 必须提交短视频 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L67 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L68 | 作品必须提交一段短视频，用于说明 Jumbotron 和 Calibrator 的使用。 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L69 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L70 | 短视频建议 3–5 分钟，至少应包含： | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L71 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L72 | 1. Jumbotron 运行效果； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L73 | 2. 多个 Racing Entry 在赛道上随进度变化； | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L74 | 3. TOP3、KPI、Riding Message、风险或违章提醒； | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L75 | 4. Calibrator 导入或使用赛道底图； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L76 | 5. Calibrator 编辑 / 校准路径、预览马匹运行、Validate、Export； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L77 | 6. 导出的 `track.profile.json` 如何被 Jumbotron 使用； | mock 边界说明 | review-package 已标注 data scope 与 out-of-scope。 | 视频中明确哪些是 mock、哪些是 adapter 派生、哪些仍是 PoC。 | 提交说明引用 README。 |
| L78 | 7. 哪些数据是真实接入，哪些数据是 mock，哪些部分仍是 PoC。 | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L79 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L80 | 没有短视频的作品，不能完整体现本次赛题要求。 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L81 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L82 | ### 5. 必须提交 Riding Record | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L83 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L84 | 作品必须保留与 Agent 协同完成任务的过程记录，体现学生如何规划、提问、判断、干预、修正与验收。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L85 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L86 | Riding Record 至少应说明： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L87 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L88 | - 如何拆分 Jumbotron、Calibrator、track-runtime、mock data、UI 等任务； | Agent 产出 | 产出 curated data、review package、validator、visualization、reports。 | 在 Riding Record 中列出文件与验证结果。 | 文件路径存在且 validator pass。 |
| L89 | - Agent 产出了哪些内容； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L90 | - 人如何审查、纠偏和重构； | 纠偏记录 | 已记录 0–1 progress、timestamp stale、API 泄漏词、行号错位修正。 | 把这些作为 Agent Riding Skill 的真实纠偏证据。 | Riding Record 更新或引用现有 session-12。 |
| L91 | - 遇到了哪些错误、幻觉或实现偏差； | 最终验收 | 数据 validator 与 PoC verify 均可作为验收。 | 提交前运行 full 与 coverage-9 两组 data validation。 | 结果 pass 无 warnings。 |
| L92 | - 最终如何验收 Jumbotron 和 Calibrator。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L93 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L94 | 没有过程记录的作品，不能完整体现 Agent Riding Skill。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L95 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L96 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L97 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L98 | ## 三、建议提交物 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L99 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L100 | 正式提交建议包括： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L101 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L102 | 1. **作品说明文档** | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L103 |    - 赛题理解； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L104 |    - 系统组成； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L105 |    - Jumbotron 信息架构； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L106 |    - Calibrator 使用流程； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L107 |    - 数据与资产说明； | PoC 边界 | data 文档声明 visual assets/short video/Calibrator UI 不属于狭义 data。 | 边界写入 README，避免把 data 完备误说成整套作品完备。 | 文档中有明确 out-of-scope。 |
| L108 |    - PoC 边界与未实现部分。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L109 | 2. **可运行 Demo 或演示入口** | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L110 |    - 本地运行说明； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L111 |    - 在线 Demo 地址，若有； | mock data 说明 | review-package/README.md 已说明文件用途。 | 最终提交说明引用 review-package。 | 评委不需要猜数据位置和用途。 |
| L112 |    - mock data 说明； | debug mode 说明 | data 可支撑 debug 展示 centerline/lane/horse state。 | 让 cc-ARY/cc-Jumbotron 在 debug UI 展示 data profile 和 coverage count。 | debug 页面截图。 |
| L113 |    - debug mode 说明，若有。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L114 | 3. **短视频** | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L115 |    - 展示 Jumbotron； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L116 |    - 展示 Calibrator； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L117 |    - 展示 profile 导出与运行时加载； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L118 |    - 说明关键技术路线。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L119 | 4. **赛道资产** | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L120 |    - `background.webp` 或等价底图； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L121 |    - `track.profile.json`； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L122 |    - `preview.png`，若有； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L123 |    - `notes.md` 或校准说明； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L124 |    - `source.prompt.md`，若使用 AI 生成底图。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L125 | 5. **数据样例** | RaceSnapshot 样例 | curated race-snapshot.json、smoke-8、coverage-9 均存在。 | 用 full/8/9 三套数据服务不同评审场景。 | validator 支持任意 RaceSnapshot 路径。 |
| L126 |    - RaceSnapshot 或 mock-racing-data； | RaceSnapshot / mock-racing-data | curated race-snapshot.json、smoke-8、coverage-9 共同构成 RaceSnapshot/mock-racing-data 样例。 | 用 full/8/9 三套数据服务完整承载、低负载视觉和枚举覆盖三种评审场景。 | validator 支持任意 RaceSnapshot 路径并 pass。 |
| L127 |    - RacingEntrySnapshot； | RacingEntrySnapshot | entries 覆盖 runtime contract；lastMessage 由 adapter 从 latestMessage/messages 派生。 | 在 adapter 文档里明确 latestMessage/latestMessageId/messages[] → lastMessage。 | 字段映射报告标记 adapterDerived。 |
| L128 |    - RidingMessageSnapshot； | RidingMessageSnapshot | messages 覆盖 9 种类型。 | coverage-9 用于展示全部 message type；full 用于压力和真实感。 | validator 无 message type warning。 |
| L129 |    - AttentionItem / Risk / Violation 数据。 | AttentionItem / Risk / Violation 数据 | attentionItems 覆盖 risk/obstacle/violation、severity/status。 | UI 明确三类注意事项，不把 targetUrl 直接公开。 | public-hidden 字段测试。 |
| L130 | 6. **Riding Record** | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L131 |    - 过程记录； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L132 |    - Prompt / Agent 操作记录； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L133 |    - 人工干预与纠错记录； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L134 |    - 复盘总结。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L135 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L136 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L137 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L138 | ## 四、100 分制评分标准 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L139 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L140 | ## 1. 问题理解与系统边界｜10 分 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L141 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L142 | 评审重点：是否真正理解 GRS-002 的核心命题。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L143 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L144 | 评分要点： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L145 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L146 | - 是否准确理解 Jumbotron 是赛事现场公开大屏，而不是后台管理系统； | 公开大屏定位 | Jumbotron 是公开赛事大屏，data 只提供公开摘要和受控 drill-down 字段。 | 说明它不是后台管理系统，不展示完整内部过程。 | 页面与文档都保持公开大屏口径。 |
| L147 | - 是否准确理解 Jumbotron 展示摘要，不展示完整 Coding Agent Session； | public boundary / session 摘要边界 | review package 标记 complete session/log/diff/private path/internal criteria 禁止公开。 | assertNoLeaks + validator 双重检查，Riding Record 只放摘要化过程证据。 | 公开页不出现完整 Session 日志或私密信息。 |
| L148 | - 是否清楚说明 Jumbotron 面向观众、组织者、教师、助教分别解决什么问题； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L149 | - 是否理解 Race Live View 的核心目标：进度、领先关系、关键动态、资源消耗、风险提醒； | 核心目标数据 | progress、rank、message、token/cost、risk 都有。 | KPI/Track/Ticker/Focus detail 分层展示 Race Live View 的核心目标。 | 截图检查进度、领先关系、关键动态、资源消耗和风险提醒。 |
| L150 | - 是否清楚区分 Jumbotron Runtime、Calibrator、track-runtime、mock data、真实 DCR 数据源之间的边界； | 边界区分 | field report 区分 Jumbotron Runtime、Calibrator、track-runtime、mock data、真实 DCR 数据源与 public-hidden 字段。 | 文档清楚说明 mock data 与真实 DCR data source 的边界。 | 提交说明有 data flow 与 PoC 边界。 |
| L151 | - 是否说明 GRS-002 为什么聚焦 Jumbotron 与 Calibrator，而不是完整 DCR 平台。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L152 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L153 | 高分作品特征： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L154 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L155 | > 不是简单做一块“大屏 UI”，而是能说明 Jumbotron 在 ARY / DCR 中承担什么赛事传播、现场组织和过程可视化价值，并能清楚划定本次 PoC 的工程边界。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L156 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L157 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L158 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L159 | ## 2. Jumbotron / Race Live View 运行体验｜20 分 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L160 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L161 | 评审重点：Jumbotron 是否真的能作为赛事现场大屏使用。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L162 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L163 | 评分要点： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L164 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L165 | - 是否有完整的 16:9 Race Live View； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L166 | - Header、KPI Strip、主赛道、TOP3、底部 ticker 等区域是否清楚； | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L167 | - 是否能展示多个 Racing Entry； | 排名/领先/完成度 | rank、gapLabel、score、overallProgress、roundProgress、motionState 都有。 | TOP3 + track marker + detail panel 组合表达。 | 视觉审阅确认一眼可读。 |
| L168 | - 是否能表达排名、领先、追赶、完成度、在线状态等赛事信息； | Message 气泡/播报 | bubble/ticker 都有；full 数据 13 条 messages。 | 消息降噪，不让 13 条同时抢主视觉。 | bubble 全局 <=3。 |
| L169 | - 是否能展示 Riding Message 气泡或现场播报； | 风险/阻碍/违规 | attentionItems 三类齐全。 | 风险项用不同颜色/标签表达，不只靠文本。 | 截图确认风险可见但不过载。 |
| L170 | - 是否能展示风险、阻碍、违规等注意事项； | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L171 | - 是否能体现 ARY / DCR 的赛马、竞技、现场感； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L172 | - 是否具备基本可读性，适合投放到教室、路演或 Hackathon 大屏； | 避免信息过载 | 8-entry smoke 专门用于低负载视觉审查。 | 视频主画面优先用 smoke-8；full 用于证明完整承载。 | cc-Jumbotron 截图复审。 |
| L173 | - 是否避免信息过载，不把 Session 日志、长评论、复杂 diff 塞到大屏； | drill-down 入口 | remoteCockpitUrl/targetUrl 存在但 public-hidden。 | UI 展示“Remote Cockpit”入口，不直接渲染真实 URL。 | assertNoLeaks 通过。 |
| L174 | - 是否有基本交互或 drill-down 入口，例如点击 Entry、TOP3、风险项进入项目或 Remote Racing Cockpit。 | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L175 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L176 | 高分作品特征： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L177 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L178 | > 现场观众一眼能看懂：当前比赛进行到哪里，谁领先，谁有风险，哪些项目正在发生关键动态；组织者也能据此判断是否需要介入。 | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L179 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L180 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L181 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L182 | ## 3. Calibrator 与赛道资产生产｜20 分 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L183 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L184 | 评审重点：团队是否证明了赛道资产可以被生产、校准、验证和复用。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L185 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L186 | 评分要点： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L187 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L188 | - 是否提供 Track Profile Calibrator 或等价校准工具； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L189 | - 是否能导入或使用赛道底图； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L190 | - 是否能创建、编辑或导入 centerline points； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L191 | - 是否能设置起点 / 终点、方向、闭合路径； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L192 | - 是否能配置 lane offsets； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L193 | - 是否能配置 checkpoints； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L194 | - 是否能通过 scrubber 或 preview 预览单马 0% → 100% 运行； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L195 | - 是否能预览多马运行，证明 lane offset 可用； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L196 | - 是否能 Validate 并展示校验结果； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L197 | - 是否能 Export `track.profile.json`； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L198 | - 是否能解释 `track.profile.json` 中的关键字段； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L199 | - 是否能说明 AI 生成底图与人工校准之间的关系； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L200 | - 是否能提交至少一套可用赛道资产。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L201 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L202 | 高分作品特征： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L203 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L204 | > Calibrator 不是摆设，而是真正让一张视觉底图变成可运行赛道资产；评委能看到从底图、路径校准、预览、验证到导出 profile 的完整流程。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L205 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L206 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L207 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L208 | ## 4. track-runtime、数据契约与位置动画正确性｜20 分 | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L209 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L210 | 评审重点：作品是否由可信数据和可信几何驱动，而不是靠手工写死效果。 | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L211 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L212 | 评分要点： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L213 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L214 | - 是否定义清楚 TrackProfile、RacingEntrySnapshot、RidingMessageSnapshot、AttentionItem 等数据结构； | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L215 | - 是否能从 RaceSnapshot 或 mock data 映射到 Jumbotron runtime 输入； | RaceSnapshot 映射 runtime | curated data 已接入 server adapter。 | 继续保持 data-only validator + PoC verify。 | 两条命令均 pass。 |
| L216 | - 是否使用 `roundProgress` 或明确的进度字段驱动赛马位置； | roundProgress 驱动位置 | 所有 entries 有 roundProgress，已转 0–100。 | runtime 内统一按当前契约消费，不混用原始 0–1。 | validator 检查 0–100。 |
| L217 | - 是否能将 progress 映射到 centerline path 上的采样点； | centerline 采样 | track centerlinePath 有 17 点。 | debug mode 展示 sampled points。 | 截图或 debug HTML 证明。 |
| L218 | - 是否计算或模拟 horse pose，包括 x、y、rotation、laneId、state； | horse pose 接轨 | data 提供 roundProgress、laneId、state；runtime 计算 x/y/rotation/horse pose。 | debug mode 展示 HorsePose 或等价 x/y/rotation/laneId/state，证明不是手写业务坐标。 | cc-Jumbotron 截图复审 horse pose/debug。 |
| L219 | - 是否通过 lane offset 支持多马同时展示； | lane offset 多马 | 12 lanes/laneOffsets 支持多马。 | full 展示 12 entry，smoke 展示可读性。 | 多马不严重重叠由视觉线确认。 |
| L220 | - 是否区分 overallProgress、roundProgress、phaseProgress； | 三种 progress | overallProgress、roundProgress、phaseProgress 都有。 | 说明 overall 用总进度，round 用位置，phase 用阶段。 | field report 中 covered。 |
| L221 | - 是否有 idle、running、sprinting、blocked、pit_stop、takeover、finished、stale 等状态表达； | 状态表达 | full/coverage-9 覆盖 blocked, finished, idle, pit_stop, running, slowed, sprinting, stale, takeover。 | coverage-9 用于视频中快速解释状态机。 | validator 无 motionState warning。 |
| L222 | - 是否处理 stale、缺失数据、非法 progress、lane 不存在、profile 加载失败等异常； | 异常处理样例 | data 有 stale、blocked、risk、violation 样例。 | 用这些样例展示 UI 异常态；非法 progress/lane 属于实现 validation。 | validator 与 UI 截图双验。 |
| L223 | - 是否支持 debug mode 或等价调试视图，展示 centerline、sampled points、lane offsets、checkpoints、horse s value； | debug mode 数据支撑 | track/entry 数据足以展示 centerline、lane offsets、checkpoints、stale entries。 | 让 debug 页面显示 coverage counters。 | debug 截图。 |
| L224 | - 是否保证 Calibrator Preview 与 Jumbotron 使用同一套或同一逻辑的 track-runtime； | Calibrator Preview / Jumbotron runtime contract 接轨 | TrackProfile 数据应同时被 Calibrator Preview 与 Jumbotron 使用同一套 track-runtime 逻辑。 | 文档中把它列为 runtime contract 接轨项，不归为纯 asset/tool。 | Calibrator/Jumbotron debug 对同一 profile 的采样结果一致。 |
| L225 | - 是否避免直接在 x/y 上粗暴补间导致马匹穿越弯道。 | s 轴补间正确性 | data 提供 progress 与 centerline；避免 x/y 粗暴补间是 runtime 利用 data 的正确方式。 | 实现说明中强调 s0→s1→sample pose，而不是直接 x/y 插值。 | 弯道不穿越内侧由视觉复审确认。 |
| L226 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L227 | 高分作品特征： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L228 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L229 | > 评委可以相信这套系统不是一次性动效，而是由 track profile、snapshot data 和 runtime logic 驱动；换一套数据或换一条赛道，仍然有机会继续工作。 | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L230 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L231 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L232 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L233 | ## 5. Demo 有效性与短视频表达｜10 分 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L234 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L235 | 评审重点：短视频和 Demo 是否真正帮助评委理解系统如何使用。 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L236 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L237 | 评分要点： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L238 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L239 | - 短视频是否清楚展示 Jumbotron 运行效果； | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L240 | - 是否展示多个 Racing Entry 的动态变化； | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L241 | - 是否展示 TOP3、KPI、message bubble、ticker、risk / violation； | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L242 | - 是否展示 Calibrator 的关键使用流程； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L243 | - 是否展示 Validate / Export； | Validate / Export 证据 | data validator 与 track profile validation 可支撑 Validate；Export 属于 Calibrator 实现线。 | 视频或 debug 中展示 validator pass 和 exported track.profile.json 被 Jumbotron 使用。 | validator pass + Calibrator Export 截图。 |
| L244 | - 是否展示导出的 track profile 被 Jumbotron 使用； | mock/PoC 说明 | review package 已说明 mock 与 PoC 边界。 | 视频口播与提交说明引用同一套话术。 | 不夸大为真实后端数据。 |
| L245 | - 是否说明哪些部分是 mock、哪些部分是可运行实现； | mock 与可运行实现边界 | data plan 必须说明哪些是 mock data、哪些已接入可运行实现、哪些仍是 PoC。 | 在视频和 README 中用 full/smoke/coverage 三套数据解释边界。 | 评委能从数据文件、页面和验证命令对应起来。 |
| L246 | - 是否能在有限时间内讲清楚系统目标、操作流程、技术关键点和 PoC 边界； | 可复现 | README 提供 validator 命令。 | 提交前跑 full 和 coverage-9。 | 命令输出 pass。 |
| L247 | - Demo 是否可复现，是否提供运行步骤、依赖说明和示例数据。 | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L248 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L249 | 高分作品特征： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L250 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L251 | > 看完短视频，不需要额外解释，就能理解这套 Jumbotron 怎么跑、Calibrator 怎么用、赛道资产怎么进入运行时。 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L252 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L253 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L254 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L255 | ## 6. Agent Riding Skill 与过程质量｜15 分 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L256 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L257 | 评审重点：学生是否体现了智能体工程师的工作方式。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L258 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L259 | 评分要点： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L260 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L261 | - 是否有明确的 Riding Plan； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L262 | - 是否能把复杂任务拆解为 Jumbotron、Calibrator、runtime、data contract、asset pipeline、video 等子任务； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L263 | - 是否能合理安排 Agent 生成代码、文档、样例数据、测试和设计说明； | Agent 生成样例数据/测试/设计说明 | 本轮 data 生成 curated JSON、review package、validator、可视化和计划文档。 | Riding Record 中说明 Agent 产出与人工复核边界。 | session-12 追加本轮过程。 |
| L264 | - 是否能识别 Agent 产出的错误、遗漏、幻觉和不合理工程方案； | 识别 Agent 错误/遗漏 | 已识别并纠正 progress 比例、timestamp stale、API 泄漏词、rubric 行号错位和分类错误。 | 把这些作为 Agent Riding Skill 的真实纠偏证据。 | Riding Record 摘要化记录。 |
| L265 | - 是否有中途干预、修正、重构和验收过程； | 中途干预与验收 | 用户与 cc-Jumbotron 多次纠偏，data validator 和 PoC verify 形成验收。 | 记录计划→观察→修正→复验过程。 | validator pass 无 warnings。 |
| L266 | - 是否能说明哪些部分由 Agent 完成，哪些部分由人判断； | Agent 与人判断边界 | Agent 生成数据和报告，人/cc-Jumbotron 判断视觉、边界和行号语义。 | 文档中不把视觉人工确认说成 data 已完成。 | out-of-scope 清单明确。 |
| L267 | - 是否能利用 DCR 或其他过程记录方式呈现协同过程； | 过程记录呈现 | session-12 和 mailbox ids 可作为 DCR/Riding 过程证据。 | 追加三文档扩展、行号纠偏、计划接轨实现记录。 | Riding Record 文件更新。 |
| L268 | - 是否能体现计划、观察、干预、验收、复盘的完整闭环； | 完整闭环 | data intake、转换、review package、审阅、纠偏、复验、接轨实现构成闭环。 | 最终说明中用该链路展示 Agent Riding Skill。 | 复盘中列出下一步交给 cc-ARY/cc-Jumbotron 的事项。 |
| L269 | - 是否能从过程记录中看出团队真实学习与成长。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L270 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L271 | 高分作品特征： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L272 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L273 | > 不是“让 AI 一次性生成大屏”，而是像智能体骑手一样，持续观察、判断、干预、调整，让 Agent 逐步完成一个复杂的可视化工程系统。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L274 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L275 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L276 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L277 | ## 7. 文档、表达与工程可交付性｜5 分 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L278 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L279 | 评审重点：是否能把复杂方案讲清楚，并让他人继续使用或接手。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L280 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L281 | 评分要点： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L282 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L283 | - 文档结构是否清晰； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L284 | - 是否说明如何运行 Demo； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L285 | - 是否说明系统结构、关键模块和数据流； | data 位置 | 所有数据路径在 review-package 中列出。 | 最终 README 加链接。 | 评委能找到。 |
| L286 | - 是否说明 track profile、mock data、assets 的位置； | 未实现部分 | out-of-scope 列出 visual assets、Calibrator UI、短视频等。 | 诚实区分 data 完备与整套作品未必完备。 | 文档不混淆责任线。 |
| L287 | - 是否说明 PoC 边界和未实现部分； | 技术债/限制 | public-hidden URL、lastMessage adapter mapping、asset out-of-scope 是主要边界。 | 列为后续风险控制，不再伪装成已完全解决。 | 报告中有对应字段。 |
| L288 | - 是否诚实说明技术债、限制与下一步计划； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L289 | - 图表是否帮助理解，而不是装饰； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L290 | - 代码和目录是否基本可读、可维护。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L291 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L292 | 高分作品特征： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L293 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L294 | > 评委或后续团队不需要猜，就能快速理解：你做了什么，怎么运行，数据怎么进来，赛道怎么校准，哪些地方还需要继续完善。 | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L295 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L296 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L297 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L298 | # 五、加分项 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L299 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L300 | 以下内容不作为硬性要求，但可以在同等条件下加分。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L301 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L302 | ### 1. Demo 表现有冲击力 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L303 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L304 | Jumbotron 有强烈赛事现场感，适合课堂、路演、Hackathon 大屏展示，能体现 “Ride Agents. Build the Future.” 的未来感与竞技感。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L305 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L306 | ### 2. Calibrator 体验完整 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L307 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L308 | Calibrator 不只是开发者临时工具，而是具备较好交互体验： | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L309 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L310 | - 拖拽路径点自然； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L311 | - 支持路径反转； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L312 | - 支持多马预览； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L313 | - 支持 validation 面板； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L314 | - 支持 JSON diff 或 debug preview； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L315 | - 支持 no bubble zone / message zone / risk zone 等增强能力。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L316 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L317 | ### 3. 多赛道资产能力 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L318 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L319 | 不仅完成一条赛道，还能展示至少两条不同赛道资产，并证明 Jumbotron 可以切换 profile 运行。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L320 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L321 | ### 4. Debug Mode 扎实 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L322 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L323 | 提供 centerline、sampled points、lane offsets、checkpoints、collision boxes、stale entries 等调试展示，让评委能看懂底层几何和运行时状态。 | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L324 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L325 | ### 5. 数据适配能力强 | data 相关 | 当前 review-package 应作为支撑证据。 | 用 field-mapping-report/rubric-data-coverage-report/validator 逐项支撑。 | 必要时补截图或 debug 视图。 |
| L326 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L327 | 能清楚设计 RaceSnapshot → RacingEntrySnapshot → HorsePose 的适配链路，或能接入真实 / 半真实 DCR 数据，而不是只依赖静态 mock。 | 数据适配能力 | RaceSnapshot → RacingEntrySnapshot → Runtime 输入链路已表达。 | Demo 讲清 adapter 如何保留 laneId、优先 motionState、派生 lastMessage。 | 代码和报告一致。 |
| L328 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L329 | ### 6. 降噪策略清楚 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L330 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L331 | 能说明 Riding Message、风险、违章、ticker、气泡如何排序、筛选、限流和 fallback，避免现场大屏被消息淹没。 | 降噪策略 | messages 有 type/severity/displayMode。 | bubble 优先级、筛选、限流和 ticker fallback 在 UI/文档中解释。 | bubble/ticker 截图与 messagePlan debug 证明。 |
| L332 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L333 | ### 7. 复盘质量高 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L334 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L335 | 不仅展示成功结果，也能诚实分析失败、偏差、重构过程与下一轮改进方向。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L336 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L337 | ### 8. 协作质量突出 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L338 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L339 | 团队分工清楚，1 coach + 多名 riders 的协作方式有效，过程记录完整。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L340 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L341 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L342 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L343 | # 六、一票否决项 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L344 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L345 | 出现以下情况，原则上不能获得高分，严重时可直接判定不合格： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L346 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L347 | 1. 没有任何可运行、可演示或可验证的 Jumbotron； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L348 | 2. 没有 Calibrator，也无法说明赛道资产如何被校准为可运行 profile； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L349 | 3. 没有提交短视频； | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L350 | 4. 没有提交 Riding Record 或过程记录； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L351 | 5. 赛马位置、排名、气泡和风险标记全部写死在图片或设计稿中； | 一票否决：非写死证明 | data 能证明位置、排名、气泡和风险标记有输入来源；runtime/visual 共同证明没有写死在图片中。 | 把 data 字段、adapter、debug pose 与页面联动作为证据链。 | 数据变更可影响展示，debug 显示 pose/lane/state。 |
| L352 | 6. 无法解释 `track.profile.json` 或等价赛道语义资产的作用； | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L353 | 7. Jumbotron 展示完整 Session 日志、敏感内容或大量私密信息，违背公开大屏边界； | 敏感信息否决项 | validator 检查私密路径/session/log/diff；assertNoLeaks 检查公开页。 | 公开页只显示摘要和入口，不显示真实 targetUrl。 | 两个检查都通过。 |
| L354 | 8. 使用 Agent 生成内容后没有任何人工判断、修正和验收； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L355 | 9. 明显抄袭、伪造过程记录或伪造 Demo 结果； | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L356 | 10. 无法说明本次 PoC 与“可信赛事大屏 / 可校准赛道资产”之间的关系。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L357 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L358 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L359 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L360 | # 七、评分等级建议 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L361 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L362 | ## S 级｜90–100 分 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L363 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L364 | 作品完整、清晰、有说服力。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L365 | Jumbotron 有稳定运行效果，Calibrator 能完成真实校准流程，track profile 与 runtime 关系清楚，数据驱动逻辑可信，短视频表达优秀，Agent Riding 过程扎实。作品不仅完成 GRS-002 命题，还能作为后续 DCR / ARY 赛事大屏子系统的雏形。 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L366 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L367 | ## A 级｜80–89 分 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L368 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L369 | 核心命题理解准确，Jumbotron 和 Calibrator 都有可演示成果，赛道几何与数据映射基本正确。过程记录较完整，短视频能讲清主要链路，但工程完整度、异常处理、debug mode 或资产流程仍有提升空间。 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L370 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L371 | ## B 级｜70–79 分 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L372 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L373 | 基本完成 Jumbotron 原型，有一定 Calibrator 或赛道配置流程，但系统边界、track-runtime 复用、数据契约、动画正确性或短视频表达存在明显不足。 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L374 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L375 | ## C 级｜60–69 分 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L376 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L377 | 完成了基本提交，但更多停留在 UI Demo 或概念展示。Jumbotron 可看但不够可信，Calibrator 证明力不足，赛道位置和数据驱动关系不清楚，过程记录较弱。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L378 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L379 | ## D 级｜60 分以下 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L380 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L381 | 未能回答 GRS-002 的核心问题，或没有有效 Jumbotron / Calibrator / 短视频 / Riding Record，或作品本质上只是静态设计稿与伪动画。 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L382 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L383 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L384 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L385 | # 八、建议奖项设置 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L386 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L387 | 除了总分排名，可以设置以下特色奖项： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L388 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L389 | 1. **Best Race Live Screen** | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L390 |    最佳赛事大屏奖：奖励 Jumbotron 现场展示效果最好、信息最清楚、最有赛事氛围的团队。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L391 | 2. **Best Track Calibrator** | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L392 |    最佳赛道校准工具奖：奖励 Calibrator 使用流程最完整、赛道资产生产最清楚的团队。 | 资产/工具项 | 不是狭义 data 缺口，但 TrackProfile 数据可支撑说明。 | 把 asset/Calibrator 交给视觉/实现线，data 只说明 profile 输入。 | 不要把 asset 缺口误记为 data 缺口。 |
| L393 | 3. **Best Runtime Architecture** | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L394 |    最佳运行时架构奖：奖励 track profile、track-runtime、data adapter、horse pose 设计最清楚、最可信的团队。 | 运行时架构奖数据支撑 | data adapter、TrackProfile、HorsePose 输入链路是 Best Runtime Architecture 的证据之一。 | 把 data adapter 与 runtime debug 放入实现说明。 | cc-ARY 实现 + cc-Jumbotron 视觉复审共同证明。 |
| L395 | 4. **Best Visual Motion** | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L396 |    最佳动态表现奖：奖励赛马位置、方向、补间、状态机、消息气泡表现最自然的团队。 | 动态表现奖数据支撑 | motionState、roundProgress、message displayMode 为 motion 提供数据输入。 | 用 coverage-9 展示状态机，用 smoke-8 展示自然视觉。 | 视觉运动自然性由截图/视频复审证明。 |
| L397 | 5. **Best Demo Video** | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L398 |    最佳短视频表达奖：奖励最能在 3–5 分钟内讲清 Jumbotron 与 Calibrator 使用方式的团队。 | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L399 | 6. **Best Agent Riding** | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L400 |    最佳智能体骑行奖：奖励 Agent 协作过程最清晰、干预最有效、复盘最扎实的团队。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L401 | 7. **Genesis Builder Award** | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L402 |    创世建造者奖：奖励在 ARY GRS-002 中表现出强烈探索精神、工程勇气和未来智能体工程师气质的学生或团队。 | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L403 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L404 | ------ | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L405 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L406 | # 九、评审核心句 | 结构行 | 章节标题或分隔线，不直接需要 data。 | 仅用于组织文档。 | 无。 |
| L407 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L408 | 评审最终要回答一个问题： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L409 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L410 | > 这个作品是否证明了： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L411 | > **Jumbotron 可以由 RaceSnapshot、Track Profile、Riding Message 和风险数据驱动，形成一块可信、可运行、可复用的赛事现场大屏？** | 最终核心句 | 当前 data 足以支撑“由 RaceSnapshot、Track Profile、Riding Message 和风险数据驱动”的证据链。 | 把 data 贯穿文档、debug、页面、视频、Riding Record。 | 评审时能从 JSON 到页面逐步追踪。 |
| L412 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L413 | 同时也要回答第二个问题： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L414 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L415 | > 这组学生是否证明了： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L416 | > **他们能够通过 Calibrator 把赛道视觉资产校准为可运行的语义赛道，并通过短视频清楚说明 Jumbotron 与 Calibrator 的使用方式？** | 提交/表达项 | data 只能提供说明素材，不能替代视频。 | 在视频中展示 full/smoke/coverage 三套数据用途。 | 视频脚本引用数据证据。 |
| L417 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L418 | 最后还要回答第三个问题： | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |
| L419 | （空行） | 空行 | 无 data 动作。 | 不更新有效阅读。 | 无。 |
| L420 | > 这组学生是否展现出了智能体工程师应有的 **Agent Riding Skill**？ | 间接相关 | 该行主要是评审叙述或工程表达，data 可作为背景证据但不是直接验收对象。 | 在总说明中保持边界清楚。 | 无单独 data 验收。 |

## 5. 执行清单

1. 页面展示：Race Live View 默认使用 full 或 smoke-8；视频主视觉建议 smoke-8，完整性证明使用 full。
2. Debug 证据：cc-data 已生成 `data-profile-evidence.json`，提供 data profile、entry/message/attention counts、motion/message coverage、public-hidden 字段和 validator status。
3. Adapter 证据：cc-data 已生成 `last-message-mapping-evidence.json`，证明 `latestMessageId + messages[] -> lastMessage` 可解析，缺失 id 可 fallback 到 `latestMessage` 摘要。
4. 降噪说明：bubble 与 ticker 分层，风险/里程碑优先，普通消息 fallback 到 ticker。
5. 公开边界：`remoteCockpitUrl`、`targetUrl` 可作为 drill-down 数据存在；cc-data evidence 只输出字段名、计数或布尔值，不输出 raw URL。
6. 验证：运行 full、smoke-8、coverage-9 三组 validator，并运行 `generate-data-side-evidence.js` 生成可复核证据。
7. Riding Record：把 data intake、转换、校验、三文档扩展、行号纠偏、data-side evidence 生成写成 Agent Riding Skill 证据。

## 6. 推荐验证命令

```bash
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-8.json /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-9-coverage.json /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/generate-data-side-evidence.js
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

## 7. 不要混淆的边界

- `background.webp / preview.png / source.prompt.md` 是视觉资产交付，不是狭义 mock-data 缺口。
- Calibrator 拖拽体验、Validate 面板、Export 操作是工具/实现线，不是 data 字段缺口。
- 弯道自然、bubble clearance、checkpoint 视觉语义是人工视觉确认，不是 JSON 字段是否存在的问题。
- 100 分需要整套作品利用 data，而不是 data 自己拿 100 分。
