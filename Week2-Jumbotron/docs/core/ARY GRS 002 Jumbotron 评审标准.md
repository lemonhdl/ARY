# ARY GRS 002 Jumbotron 评审标准

## 一、评审目标

**ARY GRS 002：Jumbotron** 的评审重点，不是看谁做了一张更炫的大屏设计图，而是看参赛团队是否能够围绕 ARY / DCR 的赛事现场展示命题，提出并实现一个可运行、可解释、可校准、可复用的 **Jumbotron 子系统 PoC**，并通过短视频清楚说明：

> Jumbotron 如何把 RaceSnapshot、Racing Entry、Riding Message、风险与违章信息，映射为现场观众、组织者、教师和助教可以理解的赛事大屏；
> Calibrator 如何把 AI 生成或人工绘制的赛道底图，校准为可被运行时稳定使用的 `track.profile.json`。

本次 Race 评审的是学生作为 **智能体工程师 / Agentic Engineer** 的综合能力，包括实时可视化理解、交互与信息架构、前端工程实现、几何与动画建模、资产生产工具设计、演示表达，以及与 Agent 协同完成真实创造的 **Agent Riding Skill**。

GRS-002 的核心不是“做一个好看的 Jumbotron”，而是证明：

> 一块赛事大屏可以由可信数据、可信赛道几何和可维护资产流程驱动，而不是靠手写位置、静态贴图或一次性动画伪装出来。

------

## 二、硬性入围门槛

作品必须满足以下 5 个基本条件，才进入正式评分。

### 1. 必须有可运行或清楚可演示的 Jumbotron / Race Live View

作品必须提供一个可以运行或稳定演示的 Jumbotron 原型，用来展示赛事直播态势。

Jumbotron 至少应包含：

- 赛事标题、LIVE 状态、Round / Phase、计时；
- 赛事级 KPI，例如完成度、活跃骑手、Tokens、Codex / Claude 使用；
- Race Live 主赛道；
- 多个 Racing Entry 的位置、排名、项目 / 骑手标签；
- TOP3 或领先者展示；
- Riding Message 气泡或底部 ticker；
- 风险 / 阻碍 / 违规提醒。

如果作品只是静态设计稿、PPT 截图或不可操作的视频动画，不能进入高分区。

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

### 3. 不能把赛马位置写死在图片或设计稿里

作品必须明确体现：

- 赛道底图只负责视觉；
- 赛道几何由 `track.profile.json` 或等价结构描述；
- 马匹位置由进度、路径采样和 lane offset 派生；
- 排名、进度、风险和消息由数据驱动；
- 不能把马匹、排名编号、气泡和风险标记直接画死在底图中。

如果方案本质上只是“背景图 + 写死坐标 + 固定动画”，不符合 GRS-002 核心命题。

### 4. 必须提交短视频

作品必须提交一段短视频，用于说明 Jumbotron 和 Calibrator 的使用。

短视频建议 3–5 分钟，至少应包含：

1. Jumbotron 运行效果；
2. 多个 Racing Entry 在赛道上随进度变化；
3. TOP3、KPI、Riding Message、风险或违章提醒；
4. Calibrator 导入或使用赛道底图；
5. Calibrator 编辑 / 校准路径、预览马匹运行、Validate、Export；
6. 导出的 `track.profile.json` 如何被 Jumbotron 使用；
7. 哪些数据是真实接入，哪些数据是 mock，哪些部分仍是 PoC。

没有短视频的作品，不能完整体现本次赛题要求。

### 5. 必须提交 Riding Record

作品必须保留与 Agent 协同完成任务的过程记录，体现学生如何规划、提问、判断、干预、修正与验收。

Riding Record 至少应说明：

- 如何拆分 Jumbotron、Calibrator、track-runtime、mock data、UI 等任务；
- Agent 产出了哪些内容；
- 人如何审查、纠偏和重构；
- 遇到了哪些错误、幻觉或实现偏差；
- 最终如何验收 Jumbotron 和 Calibrator。

没有过程记录的作品，不能完整体现 Agent Riding Skill。

------

## 三、建议提交物

正式提交建议包括：

1. **作品说明文档**
   - 赛题理解；
   - 系统组成；
   - Jumbotron 信息架构；
   - Calibrator 使用流程；
   - 数据与资产说明；
   - PoC 边界与未实现部分。
2. **可运行 Demo 或演示入口**
   - 本地运行说明；
   - 在线 Demo 地址，若有；
   - mock data 说明；
   - debug mode 说明，若有。
3. **短视频**
   - 展示 Jumbotron；
   - 展示 Calibrator；
   - 展示 profile 导出与运行时加载；
   - 说明关键技术路线。
4. **赛道资产**
   - `background.webp` 或等价底图；
   - `track.profile.json`；
   - `preview.png`，若有；
   - `notes.md` 或校准说明；
   - `source.prompt.md`，若使用 AI 生成底图。
5. **数据样例**
   - RaceSnapshot 或 mock-racing-data；
   - RacingEntrySnapshot；
   - RidingMessageSnapshot；
   - AttentionItem / Risk / Violation 数据。
6. **Riding Record**
   - 过程记录；
   - Prompt / Agent 操作记录；
   - 人工干预与纠错记录；
   - 复盘总结。

------

## 四、100 分制评分标准

## 1. 问题理解与系统边界｜10 分

评审重点：是否真正理解 GRS-002 的核心命题。

评分要点：

- 是否准确理解 Jumbotron 是赛事现场公开大屏，而不是后台管理系统；
- 是否准确理解 Jumbotron 展示摘要，不展示完整 Coding Agent Session；
- 是否清楚说明 Jumbotron 面向观众、组织者、教师、助教分别解决什么问题；
- 是否理解 Race Live View 的核心目标：进度、领先关系、关键动态、资源消耗、风险提醒；
- 是否清楚区分 Jumbotron Runtime、Calibrator、track-runtime、mock data、真实 DCR 数据源之间的边界；
- 是否说明 GRS-002 为什么聚焦 Jumbotron 与 Calibrator，而不是完整 DCR 平台。

高分作品特征：

> 不是简单做一块“大屏 UI”，而是能说明 Jumbotron 在 ARY / DCR 中承担什么赛事传播、现场组织和过程可视化价值，并能清楚划定本次 PoC 的工程边界。

------

## 2. Jumbotron / Race Live View 运行体验｜20 分

评审重点：Jumbotron 是否真的能作为赛事现场大屏使用。

评分要点：

- 是否有完整的 16:9 Race Live View；
- Header、KPI Strip、主赛道、TOP3、底部 ticker 等区域是否清楚；
- 是否能展示多个 Racing Entry；
- 是否能表达排名、领先、追赶、完成度、在线状态等赛事信息；
- 是否能展示 Riding Message 气泡或现场播报；
- 是否能展示风险、阻碍、违规等注意事项；
- 是否能体现 ARY / DCR 的赛马、竞技、现场感；
- 是否具备基本可读性，适合投放到教室、路演或 Hackathon 大屏；
- 是否避免信息过载，不把 Session 日志、长评论、复杂 diff 塞到大屏；
- 是否有基本交互或 drill-down 入口，例如点击 Entry、TOP3、风险项进入项目或 Remote Racing Cockpit。

高分作品特征：

> 现场观众一眼能看懂：当前比赛进行到哪里，谁领先，谁有风险，哪些项目正在发生关键动态；组织者也能据此判断是否需要介入。

------

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

------

## 4. track-runtime、数据契约与位置动画正确性｜20 分

评审重点：作品是否由可信数据和可信几何驱动，而不是靠手工写死效果。

评分要点：

- 是否定义清楚 TrackProfile、RacingEntrySnapshot、RidingMessageSnapshot、AttentionItem 等数据结构；
- 是否能从 RaceSnapshot 或 mock data 映射到 Jumbotron runtime 输入；
- 是否使用 `roundProgress` 或明确的进度字段驱动赛马位置；
- 是否能将 progress 映射到 centerline path 上的采样点；
- 是否计算或模拟 horse pose，包括 x、y、rotation、laneId、state；
- 是否通过 lane offset 支持多马同时展示；
- 是否区分 overallProgress、roundProgress、phaseProgress；
- 是否有 idle、running、sprinting、blocked、pit_stop、takeover、finished、stale 等状态表达；
- 是否处理 stale、缺失数据、非法 progress、lane 不存在、profile 加载失败等异常；
- 是否支持 debug mode 或等价调试视图，展示 centerline、sampled points、lane offsets、checkpoints、horse s value；
- 是否保证 Calibrator Preview 与 Jumbotron 使用同一套或同一逻辑的 track-runtime；
- 是否避免直接在 x/y 上粗暴补间导致马匹穿越弯道。

高分作品特征：

> 评委可以相信这套系统不是一次性动效，而是由 track profile、snapshot data 和 runtime logic 驱动；换一套数据或换一条赛道，仍然有机会继续工作。

------

## 5. Demo 有效性与短视频表达｜10 分

评审重点：短视频和 Demo 是否真正帮助评委理解系统如何使用。

评分要点：

- 短视频是否清楚展示 Jumbotron 运行效果；
- 是否展示多个 Racing Entry 的动态变化；
- 是否展示 TOP3、KPI、message bubble、ticker、risk / violation；
- 是否展示 Calibrator 的关键使用流程；
- 是否展示 Validate / Export；
- 是否展示导出的 track profile 被 Jumbotron 使用；
- 是否说明哪些部分是 mock、哪些部分是可运行实现；
- 是否能在有限时间内讲清楚系统目标、操作流程、技术关键点和 PoC 边界；
- Demo 是否可复现，是否提供运行步骤、依赖说明和示例数据。

高分作品特征：

> 看完短视频，不需要额外解释，就能理解这套 Jumbotron 怎么跑、Calibrator 怎么用、赛道资产怎么进入运行时。

------

## 6. Agent Riding Skill 与过程质量｜15 分

评审重点：学生是否体现了智能体工程师的工作方式。

评分要点：

- 是否有明确的 Riding Plan；
- 是否能把复杂任务拆解为 Jumbotron、Calibrator、runtime、data contract、asset pipeline、video 等子任务；
- 是否能合理安排 Agent 生成代码、文档、样例数据、测试和设计说明；
- 是否能识别 Agent 产出的错误、遗漏、幻觉和不合理工程方案；
- 是否有中途干预、修正、重构和验收过程；
- 是否能说明哪些部分由 Agent 完成，哪些部分由人判断；
- 是否能利用 DCR 或其他过程记录方式呈现协同过程；
- 是否能体现计划、观察、干预、验收、复盘的完整闭环；
- 是否能从过程记录中看出团队真实学习与成长。

高分作品特征：

> 不是“让 AI 一次性生成大屏”，而是像智能体骑手一样，持续观察、判断、干预、调整，让 Agent 逐步完成一个复杂的可视化工程系统。

------

## 7. 文档、表达与工程可交付性｜5 分

评审重点：是否能把复杂方案讲清楚，并让他人继续使用或接手。

评分要点：

- 文档结构是否清晰；
- 是否说明如何运行 Demo；
- 是否说明系统结构、关键模块和数据流；
- 是否说明 track profile、mock data、assets 的位置；
- 是否说明 PoC 边界和未实现部分；
- 是否诚实说明技术债、限制与下一步计划；
- 图表是否帮助理解，而不是装饰；
- 代码和目录是否基本可读、可维护。

高分作品特征：

> 评委或后续团队不需要猜，就能快速理解：你做了什么，怎么运行，数据怎么进来，赛道怎么校准，哪些地方还需要继续完善。

------

# 五、加分项

以下内容不作为硬性要求，但可以在同等条件下加分。

### 1. Demo 表现有冲击力

Jumbotron 有强烈赛事现场感，适合课堂、路演、Hackathon 大屏展示，能体现 “Ride Agents. Build the Future.” 的未来感与竞技感。

### 2. Calibrator 体验完整

Calibrator 不只是开发者临时工具，而是具备较好交互体验：

- 拖拽路径点自然；
- 支持路径反转；
- 支持多马预览；
- 支持 validation 面板；
- 支持 JSON diff 或 debug preview；
- 支持 no bubble zone / message zone / risk zone 等增强能力。

### 3. 多赛道资产能力

不仅完成一条赛道，还能展示至少两条不同赛道资产，并证明 Jumbotron 可以切换 profile 运行。

### 4. Debug Mode 扎实

提供 centerline、sampled points、lane offsets、checkpoints、collision boxes、stale entries 等调试展示，让评委能看懂底层几何和运行时状态。

### 5. 数据适配能力强

能清楚设计 RaceSnapshot → RacingEntrySnapshot → HorsePose 的适配链路，或能接入真实 / 半真实 DCR 数据，而不是只依赖静态 mock。

### 6. 降噪策略清楚

能说明 Riding Message、风险、违章、ticker、气泡如何排序、筛选、限流和 fallback，避免现场大屏被消息淹没。

### 7. 复盘质量高

不仅展示成功结果，也能诚实分析失败、偏差、重构过程与下一轮改进方向。

### 8. 协作质量突出

团队分工清楚，1 coach + 多名 riders 的协作方式有效，过程记录完整。

------

# 六、一票否决项

出现以下情况，原则上不能获得高分，严重时可直接判定不合格：

1. 没有任何可运行、可演示或可验证的 Jumbotron；
2. 没有 Calibrator，也无法说明赛道资产如何被校准为可运行 profile；
3. 没有提交短视频；
4. 没有提交 Riding Record 或过程记录；
5. 赛马位置、排名、气泡和风险标记全部写死在图片或设计稿中；
6. 无法解释 `track.profile.json` 或等价赛道语义资产的作用；
7. Jumbotron 展示完整 Session 日志、敏感内容或大量私密信息，违背公开大屏边界；
8. 使用 Agent 生成内容后没有任何人工判断、修正和验收；
9. 明显抄袭、伪造过程记录或伪造 Demo 结果；
10. 无法说明本次 PoC 与“可信赛事大屏 / 可校准赛道资产”之间的关系。

------

# 七、评分等级建议

## S 级｜90–100 分

作品完整、清晰、有说服力。
Jumbotron 有稳定运行效果，Calibrator 能完成真实校准流程，track profile 与 runtime 关系清楚，数据驱动逻辑可信，短视频表达优秀，Agent Riding 过程扎实。作品不仅完成 GRS-002 命题，还能作为后续 DCR / ARY 赛事大屏子系统的雏形。

## A 级｜80–89 分

核心命题理解准确，Jumbotron 和 Calibrator 都有可演示成果，赛道几何与数据映射基本正确。过程记录较完整，短视频能讲清主要链路，但工程完整度、异常处理、debug mode 或资产流程仍有提升空间。

## B 级｜70–79 分

基本完成 Jumbotron 原型，有一定 Calibrator 或赛道配置流程，但系统边界、track-runtime 复用、数据契约、动画正确性或短视频表达存在明显不足。

## C 级｜60–69 分

完成了基本提交，但更多停留在 UI Demo 或概念展示。Jumbotron 可看但不够可信，Calibrator 证明力不足，赛道位置和数据驱动关系不清楚，过程记录较弱。

## D 级｜60 分以下

未能回答 GRS-002 的核心问题，或没有有效 Jumbotron / Calibrator / 短视频 / Riding Record，或作品本质上只是静态设计稿与伪动画。

------

# 八、建议奖项设置

除了总分排名，可以设置以下特色奖项：

1. **Best Race Live Screen**
   最佳赛事大屏奖：奖励 Jumbotron 现场展示效果最好、信息最清楚、最有赛事氛围的团队。
2. **Best Track Calibrator**
   最佳赛道校准工具奖：奖励 Calibrator 使用流程最完整、赛道资产生产最清楚的团队。
3. **Best Runtime Architecture**
   最佳运行时架构奖：奖励 track profile、track-runtime、data adapter、horse pose 设计最清楚、最可信的团队。
4. **Best Visual Motion**
   最佳动态表现奖：奖励赛马位置、方向、补间、状态机、消息气泡表现最自然的团队。
5. **Best Demo Video**
   最佳短视频表达奖：奖励最能在 3–5 分钟内讲清 Jumbotron 与 Calibrator 使用方式的团队。
6. **Best Agent Riding**
   最佳智能体骑行奖：奖励 Agent 协作过程最清晰、干预最有效、复盘最扎实的团队。
7. **Genesis Builder Award**
   创世建造者奖：奖励在 ARY GRS-002 中表现出强烈探索精神、工程勇气和未来智能体工程师气质的学生或团队。

------

# 九、评审核心句

评审最终要回答一个问题：

> 这个作品是否证明了：
> **Jumbotron 可以由 RaceSnapshot、Track Profile、Riding Message 和风险数据驱动，形成一块可信、可运行、可复用的赛事现场大屏？**

同时也要回答第二个问题：

> 这组学生是否证明了：
> **他们能够通过 Calibrator 把赛道视觉资产校准为可运行的语义赛道，并通过短视频清楚说明 Jumbotron 与 Calibrator 的使用方式？**

最后还要回答第三个问题：

> 这组学生是否展现出了智能体工程师应有的 **Agent Riding Skill**？