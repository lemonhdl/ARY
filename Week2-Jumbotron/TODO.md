# 第二周 Jumbotron 完整代办清单

本文基于两个核心文档整理：

- `docs/source/jumbotron-subsystem-definition.md`
- `docs/source/jumbotron-information-architecture.md`

目标是完整覆盖原文要求，不替换概念，不省略条目。必要处保留重复表达。

## 文档内容关键路径

这一部分只按两份源文档本身的内容逻辑排列，不先按人员分工排列。分工只能挂到这些内容节点之后，不能反过来决定关键路径。

### 原文给出的两条输入链路

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

### 内容关键路径总图

```mermaid
flowchart LR
  P0[产品定位与展示边界<br/>公开大屏容器<br/>展示摘要<br/>不展示完整 Session]:::scope
  P1[Display Scope<br/>Jumbotron<br/>race_live<br/>Race Live View]:::scope
  P2[核心信息对象<br/>Competition<br/>Racing Entry<br/>KPI<br/>Riding Message<br/>Attention Item<br/>Track Template<br/>Racing Position<br/>Motion State]:::contract

  D0[DCR RaceSnapshot<br/>competition metadata<br/>KPI summary<br/>racing entries<br/>recent messages<br/>risks / violations]:::data
  D1[Jumbotron Adapter<br/>选择进度字段<br/>默认 roundProgress<br/>映射 CA provider<br/>映射风险<br/>分配 lane<br/>处理缺失与 stale<br/>提取 Riding Message]:::data
  D2[Runtime 输入快照<br/>RacingEntrySnapshot[]<br/>RidingMessageSnapshot[]<br/>AttentionItem[]]:::data

  A0[AI / Design Track Background<br/>16:9 赛道视觉底图<br/>候选 centerline points]:::asset
  A1[Track Profile Calibrator<br/>导入底图<br/>编辑 centerline<br/>方向 起终点<br/>lane offsets<br/>checkpoints<br/>预览与 validation]:::asset
  A2[Track Profile 语义资产<br/>track.profile.json<br/>viewBox background<br/>centerline<br/>lanes checkpoints<br/>messageZones noBubbleZones]:::asset

  R0[track-runtime<br/>加载校验 Track Profile<br/>centerline 采样<br/>path length<br/>tangent normal<br/>lane offset<br/>horse pose<br/>animation state<br/>bubble candidates<br/>runtime validation]:::runtime
  R1[位置与动画规则<br/>roundProgress -> s<br/>sampled point<br/>tangent normal<br/>lane offset<br/>x/y/rotation<br/>s 轴补间<br/>stale 策略]:::runtime
  R2[HorsePose<br/>entryId x y rotation s<br/>laneId state zIndex]:::runtime

  U0[Jumbotron / Race Live View IA<br/>Header<br/>KPI Strip<br/>Main Track Area<br/>Side / Floating Ranking<br/>Bottom Ticker]:::ui
  U1[现场展示规则<br/>TOP3<br/>Riding Message bubble<br/>Bottom Ticker<br/>Risk / Obstacle / Violation<br/>Remote Racing Cockpit 入口]:::ui
  U2[Debug Mode<br/>centerline<br/>sampled points<br/>lane offsets<br/>checkpoints<br/>horse s<br/>collision boxes<br/>stale entries]:::validation

  V0[Track Profile Validation<br/>schemaVersion trackId viewBox<br/>centerline points<br/>direction startFinish<br/>checkpoints lanes<br/>path length NaN Infinity<br/>采样跳变 曲率 warning]:::validation
  V1[Runtime Validation<br/>progress 越界<br/>laneId 不存在<br/>updatedAt 缺失<br/>stale threshold<br/>profile mismatch<br/>background 加载失败]:::validation
  V2[Visual Validation<br/>马在赛道上<br/>弯道自然<br/>多马不严重重叠<br/>气泡不遮挡<br/>checkpoint 语义正确]:::validation
  V3[MVP 验收<br/>profile 描述赛道<br/>Calibrator 导出可用<br/>Preview 复用 runtime<br/>单马 0-100<br/>多马 lane offset<br/>2 条示例赛道<br/>RaceSnapshot 映射可用]:::validation

  P0 --> P1 --> P2
  P2 --> D0 --> D1 --> D2 --> R0
  P2 --> A0 --> A1 --> A2 --> R0
  A2 --> V0 --> A1
  R0 --> R1 --> R2 --> U0
  D2 --> U0
  U0 --> U1
  R0 --> U2
  U2 --> V1
  U1 --> V2
  V0 --> V3
  V1 --> V3
  V2 --> V3

  classDef scope fill:#e0f2fe,stroke:#0284c7,color:#0f172a,stroke-width:2px;
  classDef contract fill:#dbeafe,stroke:#2563eb,color:#0f172a,stroke-width:2px;
  classDef data fill:#dcfce7,stroke:#16a34a,color:#0f172a,stroke-width:2px;
  classDef asset fill:#f3e8ff,stroke:#7c3aed,color:#0f172a,stroke-width:2px;
  classDef runtime fill:#ffedd5,stroke:#f97316,color:#0f172a,stroke-width:2px;
  classDef ui fill:#fef9c3,stroke:#ca8a04,color:#0f172a,stroke-width:2px;
  classDef validation fill:#fee2e2,stroke:#dc2626,color:#0f172a,stroke-width:2px;
```

### 内容路径到分工的挂载原则

- [ ] 先确认 `产品定位与展示边界`，再进入对象和工程分工。
- [ ] 先确认 `Display Scope` 只包含 `race_live / Race Live View`，再讨论页面区域。
- [ ] 先确认 `核心信息对象`，再拆 `Adapter`、`track-runtime`、UI 和 mock data。
- [ ] 数据链路必须从 `DCR RaceSnapshot` 进入 `Jumbotron Adapter`，再输出 `RacingEntrySnapshot[]`、`RidingMessageSnapshot[]`、`AttentionItem[]`。
- [ ] 资产链路必须从 `AI / Design Track Background` 进入 `Track Profile Calibrator`，再导出 `track.profile.json`。
- [ ] 两条输入链路必须在 `track-runtime` 汇合。
- [ ] `track-runtime` 必须同时服务 `Jumbotron / Race Live View` 和 `Track Profile Calibrator Preview`。
- [ ] `Jumbotron / Race Live View` 的 IA、TOP3、Bubble、Ticker、Attention 必须在 runtime 和 Adapter 输入成立之后落地。
- [ ] `Debug Mode` 和三类 validation 是内容路径的一部分，不是最后可有可无的装饰。
- [ ] 5 人分工只能挂到上述内容节点，不能用人员工作包替代文档内容路径。

## 源文档覆盖索引

本索引用来检查两份源文档是否都被代办清单覆盖。表中的 `TODO 章节` 是主要承接位置；同一条要求也可能在关键路径、验收、验证、分工中重复出现。

### 覆盖原则

- [ ] 保留源文档中的原概念名，不把 `Jumbotron` 改写为普通榜单、普通看板或普通监控台。
- [ ] 保留 `Race Live View` 是 MVP 唯一 display scope 的约束。
- [ ] 保留 `Track Profile Calibrator` 是设计时资产生产工具的定位。
- [ ] 保留 `track-runtime` 由 Jumbotron 与 Calibrator Preview 共享的约束。
- [ ] 保留 `track.profile.json` 是运行时事实来源的约束。
- [ ] 保留 `background.webp` 只作为视觉底图，不作为语义事实来源。
- [ ] 保留 `roundProgress` 优先用于赛道位置映射的语义。
- [ ] 保留 `overallProgress` 用于整体项目完成度的语义。
- [ ] 保留 `phaseProgress` 用于阶段检查点和局部进度的语义。
- [ ] 保留 `Snapshot` 能独立渲染当前画面、`Event` 只触发临时动画和消息的约束。
- [ ] 保留 `Jumbotron` 展示摘要、不展示完整 Session、完整终端日志、复杂 diff 和私密内容的边界。
- [ ] 保留 AI 只参与设计时候选资产生产，不参与运行时可信计算的边界。
- [ ] 保留验证分层：`Track Profile Validation`、`Runtime Validation`、`Visual Validation`。
- [ ] 保留工程边界：DCR 主项目 owns 与 Jumbotron 子系统 owns 分开。

### 子系统定义文档章节覆盖表

| 源文档章节 | 必须覆盖的原文要点 | TODO 章节 | 关键路径节点 | 推荐主责 |
|---|---|---|---|---|
| 1. 子系统定位 | DCR `RaceSnapshot` 到 `Jumbotron / Race Live View`；AI / Design Track Background 到 `track.profile.json`；16:9 horse-racing live screen | 1、42、43、52 | A1、D1、E4、G2 | 成员 A、B、C |
| 2. 子系统组成 | Runtime Side、Design-time Side、Shared Assets / Contracts 的完整构成 | 4、5、6、51 | A2、B2、B3、B4、B5 | 全员 |
| 2.1 Jumbotron / Race Live View | 标题、LIVE、Round / Phase、计时、KPI、赛道、马匹位置、编号、标签、TOP3、气泡、ticker、debug mode | 7、9、10、11、33、34、37 | B1、B5、D3、D4、F1、F2 | 成员 D、E |
| 2.1 Jumbotron 不负责 | 不负责真实后端聚合、权限、房间、Workshop 上下文、排名语义最终定义、Remote Racing Cockpit 协作流程、复杂 3D 或真实物理模拟 | 8、49、52 | A1、G2、G3 | 成员 A、E |
| 2.2 Track Profile Calibrator | 导入底图、导入候选 Profile、编辑 centerline、方向、起终点、lanes、checkpoints、预览、validation、export | 38、39、40、45、46、48 | E1、E2、E3、E4、G1 | 成员 C、E |
| 2.3 track-runtime | 加载校验 Profile、采样路径、path length、tangent、normal、lane offset、horse pose、animation state、bubble 位置、runtime validation | 25、26、28、29、30、31、47 | C1、C2、C3、F3 | 成员 B、E |
| 2.4 Jumbotron Adapter | `RaceSnapshot` 输入，输出 `RacingEntrySnapshot[]`、`RidingMessageSnapshot[]`、`AttentionItem[]`；选择进度字段；默认 `roundProgress`；处理缺失、stale、lane、风险、消息 | 22、42、16、17、27、30 | D1、D2、D3 | 成员 B |
| 3. 运行时 Jumbotron IA | Header、KPI Strip、Main Track Area、Side / Floating Ranking、Bottom Ticker | 10、11、33、34 | B1、B5、D3、F1、F2 | 成员 D |
| 3.1 Debug Mode | show centerline、sampled points、lane offsets、checkpoints、horse s、collision boxes、stale entries | 37、46、47、48、52 | D4、G2 | 成员 E |
| 4. Calibrator IA | Top Toolbar、Main Canvas、Right Inspector、Bottom Preview Bar | 39 | E1、E2、E3 | 成员 C |
| 4.1 Calibrator MVP 功能 | 导入底图、加载 / 创建 Profile、编辑点、平滑、闭合、反转、起点、lane offsets、checkpoints、scrubber、单马、多马、Validate、Export JSON | 40、45、46、48 | E2、E3、E4、G1 | 成员 C、E |
| 4.2 Calibrator P1 功能 | 气泡区域、no bubble zone、风险区域、AI 候选点、尖角检测、自动 lanes、debug-preview.png、JSON diff preview | 41、31、43、46、48 | E1、E2、D4、G1 | 成员 C、E |
| 5. 共享数据契约 | `Track Profile`、`RacingEntrySnapshot`、`HorsePose`、Snapshot 与 Event | 21、22、23、24 | B2、C1、C2、D1 | 成员 B |
| 5.1 Track Profile | 画布尺寸、背景图、中心线、闭合、方向、起终点、马道偏移、checkpoints、气泡区域、风险区域、调试信息；`polyline + smoothing` | 21、44、46 | C1、E2、G1 | 成员 B、C |
| 5.2 RacingEntrySnapshot | entry、rider、project、cockpit、CA provider、rank、progress、cost、risk、status、lane、message、updatedAt | 22、14、16、17、42 | B2、D1、D2 | 成员 B |
| 5.3 HorsePose | entryId、x、y、rotation、s、laneId、state、zIndex | 23、25、26 | C2、F3 | 成员 B |
| 5.4 Snapshot 与 Event | Snapshot 用于当前画面状态；Event 触发临时动画和消息；Event 不作为唯一事实来源 | 24、28、29 | C2、F3、D3 | 成员 B、D |
| 6. 位置与动画规则 | 位置计算、进度语义、动画状态机、补间策略、stale 策略 | 26、27、28、29、30 | C2、C3、F3 | 成员 B、E |
| 6.1 位置计算 | `roundProgress → normalized s → sampled centerline point → tangent → normal → lane offset → horse x/y/rotation` | 26 | C2 | 成员 B |
| 6.2 进度语义 | `overallProgress`、`roundProgress`、`phaseProgress` 三种进度分工 | 27 | B2、D1、D2 | 成员 B |
| 6.3 动画状态机 | idle、running、sprinting、slowed、blocked、pit_stop、takeover、finished、stale；只接受 `RacingEntrySnapshot` 和 `RaceEvent` | 28、20 | F3 | 成员 B、D |
| 6.4 补间策略 | 在 `s` 轴补间，不直接在 `x/y` 补间 | 29 | C2、F3 | 成员 B |
| 6.5 stale 策略 | 超过阈值无更新进入 stale；停止前进、降低亮度、显示 stale/no recent update、不做 running 动画 | 30、47 | C3、F3 | 成员 B、E |
| 7. Riding Message 展示规则 | 同一条消息可作为 bubble、bottom ticker、risk alert item | 31、32、33 | F1、G2 | 成员 D |
| 7.1 Bubble 位置 | horse pose、message zone lookup、bubble offset、collision check、final bubble position；无位置 fallback 到 ticker | 31、32、36、41 | F1、D3 | 成员 D、C |
| 7.2 MVP 降噪策略 | 每 Entry 同时最多 1 条 bubble；全局最多 3 条；风险 / 里程碑优先；普通消息进入 ticker | 31、32、33、52 | F1、G2 | 成员 D、E |
| 8. 资产生产与冻结 | AI-assisted Asset Pipeline、资产目录规范、资产冻结规则 | 43、44、45 | B3、E4、G1 | 成员 C、E |
| 8.1 AI-assisted Asset Pipeline | prompt、AI 生成底图、候选 centerline points、导入 Calibrator、人工校准、多马预览、Validate、Export、提交资产 | 43、38、40、45 | B3、E1、E2、E3、E4 | 成员 C |
| 8.2 资产目录规范 | `assets/tracks/<track-id>/background.webp`、`track.profile.json`、`preview.png`、`notes.md`、`source.prompt.md` | 44、51 | B3、G1 | 成员 C |
| 8.3 资产冻结规则 | schema、geometry、0→100 单马、至少 8 匹马、多马不跑出赛道、checkpoint、16:9、profile 与 background 一起提交 | 45、48、52 | G1、G2 | 成员 E、C |
| 9. Validation | Track Profile Validation、Runtime Validation、Visual Validation | 46、47、48、57 | B4、C3、G1、G2 | 成员 E |
| 9.1 Track Profile Validation | schemaVersion、trackId、viewBox、background、centerline points、closed/open 点数、direction、startFinish、checkpoints、lanes、path length、NaN/Infinity、采样跳变、曲率 warning | 46 | B4、G1 | 成员 E、B |
| 9.2 Runtime Validation | progress 越界、laneId 不存在、updatedAt 缺失、stale threshold、profile 版本不匹配、background 加载失败 | 47 | C3、G2 | 成员 E、B |
| 9.3 Visual Validation | 马是否在赛道上、弯道自然、多马重叠、气泡遮挡标题/KPI/顶部区域、checkpoint 视觉语义 | 48 | G1、G2 | 成员 E、C、D |
| 10. 工程边界 | DCR 主项目 owns 与 Jumbotron 子系统 owns | 49、50 | A1、G3 | 成员 A、E |
| 10.1 DCR 主项目 owns | real data source、Jumbotron orchestration、permissions / room / workshop context、ranking semantics、business events | 49 | A1、G3 | 成员 A |
| 10.2 Jumbotron 子系统 owns | track profile、path sampling、horse pose、animation states、visual race rendering、calibrator tooling、asset validation、adapter contract | 50 | C1、C2、E1、G1 | 成员 B、C、D、E |
| 11. 推荐工程结构 | apps、packages、assets、docs 的目录建议 | 51、58 | A2、G3 | 成员 E、A |
| 12. MVP 验收口径 | profile 描述赛道、Calibrator 微调、profile 被 Preview 使用、共享 runtime、单马、多马、弯道自然、状态可表达、消息降噪、2 条赛道、Adapter 映射 | 52 | G2、G3、G4 | 全员 |

### 信息架构文档章节覆盖表

| 源文档章节 | 必须覆盖的原文要点 | TODO 章节 | 关键路径节点 | 推荐主责 |
|---|---|---|---|---|
| 1. 定位 | Jumbotron 是公开大屏容器，聚合多个项目、骑手、Racing Cockpit 和 Coding Agent 的运行状态 | 1、7、9、10 | A1、B1、D3 | 成员 A、D |
| 1.1 产品定义 | 面向现场观众、组织者、教师、助教快速理解赛事画面 | 1、9、35 | A1、B1、D3 | 成员 A、D |
| 1.2 核心目标 | 当前比赛到哪里、谁领先、关键动态、整体健康、风险阻碍违规 | 2、12、34、35 | B1、F2、G2 | 成员 A、D |
| 1.3 展示边界 | 应展示标题阶段时间 LIVE、Entry 排名位置进度成本风险消息摘要、KPI、TOP3、Riding Message、Risk/Obstacle/Violation、Remote Racing Cockpit 入口；不展示完整日志、Session、长文本评论、复杂 diff、后台、私密内容 | 8、9、12、33、34、35 | F1、F2、G2 | 成员 A、D、E |
| 2. Display Scope | MVP 范围只保留 `race_live` 与 `jumbotron / Race Live View` | 3、52 | A1、B1、G2 | 成员 A |
| 2.1 race_live | 赛事直播视图，强调赛道、位置、追赶关系、实时消息和现场氛围 | 3、11、36 | B1、D3、F1 | 成员 D |
| 2.2 范围约束 | MVP 不包含独立第二大屏模式，不要求表格主榜或多维排行 | 3、8、52 | A1、G2 | 成员 A、E |
| 3. 核心信息对象 | Competition、Racing Entry、Competition KPI、Riding Message、Attention Item、Track Template、Racing Position、Motion State | 13、14、15、16、17、18、19、20 | B2、D1、D2 | 成员 B |
| 3.1 Competition | competitionId、title、subtitle、theme、organizer、liveStatus、currentPhase、currentRound、nextPhase、elapsedTime、systemTime | 13、10 | B2、B5 | 成员 B、D |
| 3.2 Racing Entry | entryId、displayName、riderName、projectName、rank、rankDelta、score、progress、tokenCost、primaryCA、usage、riskLevel、motionState、latestMessage、remoteCockpitUrl | 14、22、42 | B2、D1、D2 | 成员 B |
| 3.3 Competition KPI | completionRate、totalTokens、activeRiders、onlineRiders、activeCockpits、Codex/Claude tokens/share、risk/obstacle/violation count | 15、10、11 | B2、B5、D3 | 成员 B、D |
| 3.4 Riding Message | messageId、entryId、source、type、severity、summary、createdAt、displayMode、targetUrl；消息类型完整列表 | 16、31、32、33、42 | D1、F1 | 成员 B、D |
| 3.5 Risk / Obstacle / Violation | Attention Item 字段、category、severity、summary、status、targetUrl | 17、33、35、42 | D1、F2 | 成员 B、D |
| 3.6 Track Template | trackId、backgroundAsset、viewBox、designSize、centerlinePath、startLine、finishLine、checkpoints、laneOffsets、safeZones | 18、21、44 | B3、C1 | 成员 B、C |
| 3.7 Racing Position | `Track Template + Progress + Lane Offset + Display Adjustment`；默认映射 `roundProgress → centerlinePath distance → point → rotation → laneOffset → displayAdjustment` | 19、26、27 | C2、D3 | 成员 B |
| 3.8 Racing Motion State | idle、running、sprinting、slowed、blocked、pit_stop、takeover、finished、stale 的语义和展示方式 | 20、28、30 | F3、D3 | 成员 B、D |
| 4. 容器级信息架构 | Header、Global KPI Strip、Main Content、Attention / Message Area、Footer | 10 | B1、B5、D3 | 成员 D |
| 5. Race Live View IA | 赛道主视觉、马匹位置、排名编号、项目气泡、TOP3、底部 ticker | 11、34、36 | B1、B5、D3、F1、F2 | 成员 D |
| 5.1 区域结构 | Header / Status Bar、Top Summary Row、Track Stage、Left Rail、Bottom Ticker、Footer | 11 | B1、B5、D3 | 成员 D |
| 5.2 信息优先级 | 赛事发生什么、谁领先、Entry 位置、消息、风险、总进度资源消耗 CA 使用情况 | 12 | B1、F1、F2、G2 | 成员 A、D |
| 5.3 主视觉规则 | Static Track Background + Semantic Track Geometry + Dynamic Racing Entry Layer + Message / Attention Overlay；不能把马匹编号气泡风险写死在底图；位置来自 `roundProgress`；safeZones；无新数据 stale | 36、18、19、30、31 | B3、C2、D3、F1 | 成员 B、C、D |
| 5.4 TOP3 规则 | rank、entryName、rider / project visual、time gap / lead status、motion hint、click target；不扩展为独立看板 | 34、35 | F2、G2 | 成员 D |
| 5.5 Riding Message 气泡规则 | 短句、里程碑、追赶反超守住名次、风险阻碍、Guidance/Takeover/Pit Stop；不展示长文本评论、完整日志、复杂分析、多段解释 | 32、31、8 | F1、G2 | 成员 D、E |
| 5.6 Bottom Ticker 规则 | category、severity、time、entryName、summary、status badge、targetUrl；点击风险项进入详细风险列表或 Remote Racing Cockpit | 33、35 | F1、F2 | 成员 D |
| 6. 核心交互 | 查看全局赛况、实时领先者、项目位置、实时消息、风险、进入单个项目 | 35 | F1、F2、D3 | 成员 D |
| 6.1 查看全局赛况 | 通过 Race Live View 的赛道主视觉理解比赛推进状态 | 35、11 | D3 | 成员 D |
| 6.2 查看实时领先者 | 通过 TOP3 快速识别领先和追赶关系 | 35、34 | F2 | 成员 D |
| 6.3 查看项目位置 | 通过赛道上的 Racing Entry 位置、排名编号和项目名理解相对进度 | 35、19 | D3 | 成员 D、B |
| 6.4 查看实时消息 | 通过 Riding Message 气泡或 ticker 看到重点动态 | 35、31、32、33 | F1 | 成员 D |
| 6.5 查看风险 | 通过底部 ticker 或赛道风险标记识别需要介入的项目 | 35、17、33 | F2 | 成员 D |
| 6.6 进入单个项目 | 从 Racing Entry 标记、TOP3 Item、Riding Message、Risk / Obstacle / Violation Item 进入 Remote Racing Cockpit | 35、9、33、34 | F2、G2 | 成员 D、E |
| 7. 高保真对象到 IA 对象映射 | 标题、Subtitle、LIVE、Round、Elapsed Time、Online Riders、TOP3、KPI、Track Stage、background、centerline、markers、bubble、mini map、legend、ticker、footer 字段映射 | 56、10、11 | B1、B5、D3 | 成员 A、D |
| 8. MVP 落地约束 | MVP 只包含 race_live；`roundProgress` 映射；底图只负责视觉；几何显式存在；位置由进度和几何派生；状态机驱动；不伪造连续推进；不做第二大屏、项目主表、多维排行；只展示摘要 | 52、3、8、18、19、28、29、30、36 | G2 | 成员 A、B、E |
| 9. 推荐 MVP 信息层级 | P0 必须可见、P1 应该可见、P2 可增强 | 53、54、55 | B1、D3、G2 | 成员 A、D、E |

### 源文档条目责任矩阵

这个矩阵用来回答“源文档里的某个具体对象、字段、区域或规则由谁实现”。`主责` 是默认回答；`协作` 是必须对齐的人；`验收` 是最终确认不漂移的人。

#### 核心对象与字段

| 源文档条目 | 字段或具体内容 | 主责 | 协作 | 验收 | 实现交付物 |
|---|---|---|---|---|---|
| `Competition` | `competitionId`、`title`、`subtitle`、`theme`、`organizer` | 成员 B | 成员 D | 成员 A | 数据契约、mock data、Header/Footer 数据输入 |
| `Competition` | `liveStatus`、`currentPhase`、`currentRound`、`nextPhase`、`elapsedTime`、`systemTime` | 成员 B | 成员 D | 成员 A | 数据契约、Header、Footer、状态栏 |
| `Competition KPI` | `completionRate`、`totalTokens`、`activeRiders`、`onlineRiders`、`activeCockpits` | 成员 B | 成员 D | 成员 E | KPI 数据契约、KPI Strip、mock data |
| `Competition KPI` | `codexTokens`、`claudeTokens`、`codexShare`、`claudeShare` | 成员 B | 成员 D | 成员 A | CA 使用数据映射、KPI Cards |
| `Competition KPI` | `riskCount`、`obstacleCount`、`violationCount` | 成员 B | 成员 D | 成员 E | Attention 聚合、KPI Cards、ticker 输入 |
| `Racing Entry` | `entryId`、`displayName`、`riderName`、`projectName` | 成员 B | 成员 D | 成员 A | Entry 数据契约、Entry marker、legend、TOP3 item |
| `Racing Entry` | `rank`、`rankDelta`、`score` | 成员 B | 成员 D | 成员 A | 排名数据输入、TOP3、ranking badge |
| `Racing Entry` | `overallProgress`、`roundProgress`、`phaseProgress` | 成员 B | 成员 D、E | 成员 E | progress contract、Adapter 映射、position runtime 输入 |
| `Racing Entry` | `tokenCost`、`primaryCA`、`codexUsage`、`claudeUsage` | 成员 B | 成员 D | 成员 A | Entry 卡片、KPI、mock data |
| `Racing Entry` | `riskLevel`、`motionState`、`latestMessage`、`remoteCockpitUrl` | 成员 B | 成员 D、E | 成员 E | Adapter 输出、Entry marker 状态、点击入口 |
| `RacingEntrySnapshot` | `entryId`、`riderName`、`projectName`、`cockpitId` | 成员 B | 成员 D | 成员 A | `RacingEntrySnapshot` contract、mock data |
| `RacingEntrySnapshot` | `caProvider` | 成员 B | 成员 D | 成员 A | Adapter provider 映射、KPI / visual label |
| `RacingEntrySnapshot` | `rank`、`overallProgress`、`roundProgress`、`phaseProgress`、`currentPhase` | 成员 B | 成员 D、E | 成员 E | Adapter progress 选择、runtime 输入、checkpoint 显示 |
| `RacingEntrySnapshot` | `costTokens`、`costUsd` | 成员 B | 成员 D | 成员 A | 成本数据映射、Entry 摘要或 KPI |
| `RacingEntrySnapshot` | `riskLevel`、`obstacleCount`、`violationCount` | 成员 B | 成员 D、E | 成员 E | AttentionItem 派生、风险视觉和 ticker |
| `RacingEntrySnapshot` | `status` | 成员 B | 成员 D、E | 成员 E | Motion State 输入、stale / blocked / pit_stop / takeover / finished 展示 |
| `RacingEntrySnapshot` | `laneId` | 成员 B | 成员 C、E | 成员 E | lane 分配、runtime validation、multi-horse preview |
| `RacingEntrySnapshot` | `lastMessage`、`updatedAt` | 成员 B | 成员 D、E | 成员 E | Riding Message 输入、stale threshold 防御 |
| `Riding Message` | `messageId`、`entryId`、`source`、`type`、`severity` | 成员 B | 成员 D | 成员 E | message contract、Adapter 输出、气泡/ticker 分类 |
| `Riding Message` | `summary`、`createdAt`、`displayMode`、`targetUrl` | 成员 B | 成员 D | 成员 A | bubble 文案、ticker item、点击入口 |
| `Riding Message` 类型 | `progress_update`、`milestone`、`strategy_change`、`quality_signal` | 成员 B | 成员 D | 成员 A | mock message、ticker、bubble 规则 |
| `Riding Message` 类型 | `risk_alert`、`obstacle`、`violation`、`takeover`、`pit_stop` | 成员 B | 成员 D、E | 成员 E | attention 派生、risk alert、motion state 联动 |
| `Attention Item` | `itemId`、`entryId`、`category`、`severity` | 成员 B | 成员 D、E | 成员 E | `AttentionItem` contract、风险分类、ticker 输入 |
| `Attention Item` | `summary`、`status`、`createdAt`、`targetUrl` | 成员 B | 成员 D | 成员 E | Bottom Ticker、风险入口、Remote Racing Cockpit 链接 |
| `Track Template` | `trackId` | 成员 B | 成员 C | 成员 E | TrackProfile schema、asset id、加载索引 |
| `Track Template` | `backgroundAsset` | 成员 C | 成员 B | 成员 E | `background.webp`、TrackProfile background 字段、资产加载校验 |
| `Track Template` | `viewBox` | 成员 B | 成员 C、D | 成员 E | TrackProfile schema、SVG/Canvas 坐标空间、visual validation |
| `Track Template` | `designSize` | 成员 C | 成员 D | 成员 E | 16:9 设计尺寸、preview 校验、notes.md |
| `Track Template` | `centerlinePath` | 成员 B | 成员 C | 成员 E | centerline schema、path sampling、Calibrator 编辑层 |
| `Track Template` | `startLine`、`finishLine` | 成员 C | 成员 B、D | 成员 E | Calibrator 起终点配置、checkpoint/finish 展示 |
| `Track Template` | `checkpoints` | 成员 C | 成员 B、D | 成员 E | Calibrator checkpoint 编辑、runtime checkpoint、Left Rail 显示 |
| `Track Template` | `laneOffsets` | 成员 B | 成员 C、D | 成员 E | lanes schema、lane offset 计算、多马预览 |
| `Track Template` | `safeZones` | 成员 C | 成员 D、E | 成员 E | message zone / safe zone 配置、bubble 避让、visual validation |
| `TrackProfile` | `schemaVersion`、`trackId`、`name` | 成员 B | 成员 C | 成员 E | profile schema、validation、asset metadata |
| `TrackProfile` | `viewBox`、`background` | 成员 B | 成员 C、D | 成员 E | runtime 坐标系、背景加载、visual validation |
| `TrackProfile` | `centerline.type`、`centerline.closed`、`centerline.points`、`centerline.smoothing` | 成员 B | 成员 C | 成员 E | polyline + smoothing schema、Calibrator point 编辑、sampling table |
| `TrackProfile` | `direction`、`startFinish` | 成员 C | 成员 B | 成员 E | Calibrator 方向/起点配置、runtime normalized s 起点 |
| `TrackProfile` | `lanes` | 成员 B | 成员 C、D | 成员 E | lane id、offset、multi-horse display |
| `TrackProfile` | `messageZones`、`noBubbleZones` | 成员 C | 成员 D、E | 成员 E | bubble 候选位置、no bubble zone、collision check |
| `HorsePose` | `entryId`、`x`、`y`、`rotation`、`s` | 成员 B | 成员 D | 成员 E | track-runtime 输出、horse marker 渲染、debug overlay |
| `HorsePose` | `laneId`、`state`、`zIndex` | 成员 B | 成员 D、E | 成员 E | lane 层级、motion state、遮挡层级 |
| `Snapshot` | 当前画面状态 | 成员 B | 成员 D | 成员 E | runtime render input、Preview state |
| `Event` | 临时动画和消息触发 | 成员 B | 成员 D | 成员 E | RaceEvent 输入、消息动画、状态变化，不作为唯一事实来源 |

#### 页面区域与 UI 责任

| 源文档条目 | 具体区域或对象 | 主责 | 协作 | 验收 | 实现交付物 |
|---|---|---|---|---|---|
| `Jumbotron Container` | Header | 成员 D | 成员 A、B | 成员 A | Brand、Subtitle、LIVE、Phase/Round、Elapsed Time、Online Riders |
| `Jumbotron Container` | Global KPI Strip | 成员 D | 成员 B | 成员 E | Completion Rate、Total Tokens、Codex/Claude Usage、Risk/Obstacle/Violation Count |
| `Jumbotron Container` | Main Content | 成员 D | 成员 B、C | 成员 E | Race Live View 容器、16:9 布局 |
| `Jumbotron Container` | Attention / Message Area | 成员 D | 成员 B、E | 成员 E | Riding Message、Risk / Obstacle / Violation 展示区 |
| `Jumbotron Container` | Footer | 成员 D | 成员 A、B | 成员 A | LIVE、Theme、Organizer、Current Phase、Next Phase、System Time |
| `Race Live View` | Header / Status Bar | 成员 D | 成员 A、B | 成员 A | DevCompass Racing、Workshop / Hackathon Live Screen、LIVE Badge、Round、Elapsed Time、Online Riders |
| `Race Live View` | Top Summary Row | 成员 D | 成员 B | 成员 E | Real-time TOP3、Competition KPI Cards |
| `Race Live View` | Track Stage | 成员 D | 成员 B、C | 成员 E | Track Background、Semantic Track Overlay、Racing Entry Markers、Horse / Rider Visuals |
| `Race Live View` | Ranking Number Badges | 成员 D | 成员 B | 成员 A | rank badge、rankDelta 可视状态 |
| `Race Live View` | Riding Message Bubbles | 成员 D | 成员 B、C、E | 成员 E | bubble on track、collision check、fallback ticker |
| `Race Live View` | LIVE Indicator | 成员 D | 成员 B | 成员 A | liveStatus 可见表达 |
| `Race Live View` | Left Rail | 成员 D | 成员 C、B | 成员 E | Track Mini Map、Checkpoints、Entry Legend |
| `Race Live View` | Bottom Ticker | 成员 D | 成员 B、E | 成员 E | Risk Items、Obstacle Items、Violation Items、Recent Message Items、View More |
| `Race Live View` | Footer | 成员 D | 成员 A、B | 成员 A | Theme、Organizer、Current Phase、Next Phase、System Time |
| `TOP3 Item` | `rank`、`entryName`、`rider / project visual` | 成员 D | 成员 B | 成员 A | TOP3 card |
| `TOP3 Item` | `time gap / lead status`、`current motion hint`、`click target` | 成员 D | 成员 B、E | 成员 E | TOP3 card 状态和 Remote Racing Cockpit 入口 |
| `Bottom Ticker Item` | `category`、`severity`、`time`、`entryName` | 成员 D | 成员 B | 成员 E | ticker row / marquee item |
| `Bottom Ticker Item` | `summary`、`status badge`、`targetUrl` | 成员 D | 成员 B、E | 成员 E | ticker 文案、状态标记、点击入口 |
| `Remote Racing Cockpit` 入口 | Racing Entry 标记、TOP3 Item、Riding Message、Risk / Obstacle / Violation Item | 成员 D | 成员 B、E | 成员 A | click target 与入口样式，不实现协作流程本身 |
| 高保真对象映射 | 标题、Subtitle、LIVE、Round、Elapsed Time、Online Riders | 成员 A | 成员 D、B | 成员 A | IA 映射表、Header/Footer 对齐 |
| 高保真对象映射 | 赛道底图、赛道路径、马匹编号、气泡消息、小地图、图例、底栏、查看更多 | 成员 A | 成员 D、C、B | 成员 E | IA 映射表、UI 实现核对 |

#### 运行规则、Calibrator 与验证责任

| 源文档条目 | 规则或功能 | 主责 | 协作 | 验收 | 实现交付物 |
|---|---|---|---|---|---|
| `Racing Position` | `Track Template + Progress + Lane Offset + Display Adjustment` | 成员 B | 成员 D、C | 成员 E | runtime position API、Preview 渲染接入 |
| 默认位置映射 | `roundProgress → centerlinePath distance → point → rotation → laneOffset → displayAdjustment` | 成员 B | 成员 D | 成员 E | track-runtime sampling、debug overlay |
| 进度语义 | `overallProgress` 用于整体项目完成度 | 成员 B | 成员 D、A | 成员 A | KPI / entry progress 展示 |
| 进度语义 | `roundProgress` 用于 Race Live View 赛马位置 | 成员 B | 成员 D、E | 成员 E | Adapter progress selection、runtime position |
| 进度语义 | `phaseProgress` 用于阶段检查点和局部进度 | 成员 B | 成员 D、C | 成员 A | checkpoint / phase display |
| Motion State | `idle`、`running`、`sprinting`、`slowed` | 成员 B | 成员 D | 成员 E | state mapping、horse animation class |
| Motion State | `blocked`、`pit_stop`、`takeover`、`finished`、`stale` | 成员 B | 成员 D、E | 成员 E | risk / stale / takeover / finish visual state |
| 补间策略 | 在 `s` 轴补间，不直接在 `x/y` 上补间 | 成员 B | 成员 D | 成员 E | interpolation API、弯道验证 |
| stale 策略 | 超过阈值无更新后停止前进、降低亮度、显示 stale/no recent update、不做 running 动画 | 成员 B | 成员 D、E | 成员 E | stale detection、visual state、runtime validation |
| Bubble 位置 | horse pose、message zone lookup、bubble offset、collision check、final bubble position | 成员 D | 成员 B、C、E | 成员 E | bubble layout、message zone 配置、collision check |
| Bubble fallback | 没有合适位置时进入 bottom ticker | 成员 D | 成员 E | 成员 E | fallback 逻辑、ticker 接入 |
| MVP 降噪 | 每个 Racing Entry 同时最多 1 条 bubble，全局最多 3 条 bubble | 成员 D | 成员 B、E | 成员 E | bubble filter、priority queue |
| MVP 降噪 | 风险 / 里程碑消息优先，普通消息进入 ticker | 成员 D | 成员 B、E | 成员 E | message priority、ticker routing |
| Track Profile Calibrator | Top Toolbar | 成员 C | 成员 E | 成员 A | Import Background、Import Candidate Profile、Validate、Preview、Export |
| Track Profile Calibrator | Main Canvas | 成员 C | 成员 B、D | 成员 E | Background、Centerline、Control Points、Lane Preview、Checkpoint、Horse Preview、Message Bubble Preview |
| Track Profile Calibrator | Right Inspector | 成员 C | 成员 B、E | 成员 E | Track Info、Geometry、Start/Finish、Direction、Lanes、Checkpoints、Message Bubble、Validation Results |
| Track Profile Calibrator | Bottom Preview Bar | 成员 C | 成员 B、D | 成员 E | Progress Scrubber、Horse Count、Speed、Play/Pause、Scenario Presets |
| Calibrator MVP | 导入底图、加载/创建 Track Profile、添加/删除/拖拽 centerline points | 成员 C | 成员 B | 成员 E | Calibrator editor |
| Calibrator MVP | 平滑路径预览、闭合路径、一键反转路径方向、设置起点 | 成员 C | 成员 B | 成员 E | path editing tools |
| Calibrator MVP | 配置 lane offsets、配置 checkpoints、scrubber 单马 0 到 100、多马预览、Validate、Export JSON | 成员 C | 成员 B、D、E | 成员 E | Preview + Export workflow |
| Calibrator P1 | 气泡区域、no bubble zone、风险区域编辑 | 成员 C | 成员 D、E | 成员 E | zone editor、visual validation |
| Calibrator P1 | AI 候选点导入、自动检测尖角、自动分配 lanes、debug-preview.png、JSON diff preview | 成员 C | 成员 B、E | 成员 E | P1 enhancement backlog |
| AI-assisted Asset Pipeline | prompt、AI 生成 16:9 底图、候选 centerline points | 成员 C | 成员 A | 成员 E | `source.prompt.md`、候选资产记录 |
| AI-assisted Asset Pipeline | 导入 Calibrator、人工校准、多马预览、Validate、Export、提交资产 | 成员 C | 成员 B、E | 成员 E | track asset package |
| 资产目录规范 | `background.webp`、`track.profile.json`、`preview.png`、`notes.md`、`source.prompt.md` | 成员 C | 成员 B、E | 成员 E | `assets/tracks/<track-id>/` |
| Track Profile Validation | `schemaVersion`、`trackId`、`viewBox`、`background`、centerline 点数、direction、startFinish、checkpoints、lanes | 成员 E | 成员 B、C | 成员 E | validation script、错误报告 |
| Track Profile Validation | path length、NaN / Infinity、采样跳变、曲率或转角 warning | 成员 E | 成员 B | 成员 E | geometry validation |
| Runtime Validation | progress 越界、laneId 不存在、缺 updatedAt、stale threshold、profile 版本不匹配、background 加载失败 | 成员 E | 成员 B、D | 成员 E | runtime validation、debug display |
| Visual Validation | 马是否跑在赛道上、弯道自然、多马重叠、气泡遮挡、checkpoint 视觉语义 | 成员 E | 成员 C、D | 成员 E | visual checklist、人工验收记录 |
| 工程边界 DCR owns | real data source、Jumbotron orchestration、permissions / room / workshop context、ranking semantics、business events | 成员 A | 成员 B、D、E | 成员 A | handoff 文档、边界说明 |
| 工程边界 Jumbotron owns | track profile、path sampling、horse pose、animation states、visual race rendering、calibrator tooling、asset validation、adapter contract | 成员 A | 成员 B、C、D、E | 成员 E | scope 文档、交付核对 |

### 关键路径图覆盖说明

- [ ] `A0 → A1 → A2` 覆盖文档保存、独立工作区、需求覆盖清单和工程骨架。
- [ ] `A2 → B1 / B2 / B3 / B4 / B5` 表示信息架构、数据契约、资产准备、验证脚手架、UI 视觉组件可以并行启动。
- [ ] `B2 → C1 → C2 → C3` 表示数据契约先于 `track-profile schema`，`track-profile schema` 先于 `track-runtime`，`track-runtime` 先于运行时防御。
- [ ] `B3 → E1 → E2 → E3 → E4` 表示资产准备、Calibrator IA、MVP 校准、预览、导出存在严格顺序。
- [ ] `C2 → E3` 表示 Calibrator Preview 必须复用 `track-runtime`。
- [ ] `C2 / B5 / B3 / D1 → D3` 表示 Jumbotron Preview 必须同时依赖 runtime、UI、资产和 Adapter。
- [ ] `D3 → D4 / F1 / F2` 表示主链路跑通后，Debug Mode、Riding Message、TOP3 与 Attention 可以并行增强。
- [ ] `C2 → F3 → D3` 表示 Motion State 由 runtime 计算与状态输入驱动，再被大屏展示。
- [ ] `E4 → G1` 表示资产冻结必须发生在 Export JSON 之后。
- [ ] `D3 / D4 / F1 / F2 / G1 → G2` 表示端到端验收必须合并预览、调试、消息、注意事项和资产冻结结果。
- [ ] `G2 → G3 → G4` 表示先验收，再收口文档，再提交推送。

## 关键路径总览

下面这张图先表达逻辑顺序，再表达可并行工作。颜色是推荐的 5 人分工，不代表只能由该成员完成。

```mermaid
flowchart TD
  A0[开工确认<br/>保存两份核心文档<br/>确认在 ARY 仓库开 Week2-Jumbotron]:::p1
  A1[需求覆盖清单<br/>子系统定义<br/>信息架构<br/>MVP 验收口径]:::p1
  A2[工程骨架<br/>apps packages assets docs<br/>README 过程记录 验证入口]:::p5

  B1[信息架构与页面骨架<br/>Jumbotron Container<br/>Race Live View IA<br/>P0 P1 P2 信息层级]:::p1
  B2[数据契约<br/>Competition<br/>Racing Entry<br/>RacingEntrySnapshot<br/>RidingMessage<br/>AttentionItem<br/>TrackProfile]:::p2
  B3[资产准备<br/>background.webp<br/>track.profile.json<br/>preview.png<br/>notes.md<br/>source.prompt.md<br/>至少 2 条示例赛道]:::p3
  B4[验证脚手架<br/>schema validation<br/>runtime validation<br/>visual validation<br/>verify script]:::p5
  B5[UI 视觉组件<br/>Header KPI TOP3<br/>Track Stage Left Rail<br/>Bottom Ticker Footer]:::p4

  C1[track-profile schema<br/>polyline smoothing<br/>viewBox lanes checkpoints<br/>messageZones noBubbleZones]:::p2
  C2[track-runtime<br/>加载 profile<br/>采样 centerline<br/>计算 path length<br/>tangent normal lane offset<br/>horse pose]:::p2
  C3[Runtime Validation<br/>progress 越界<br/>laneId 不存在<br/>updatedAt 缺失<br/>stale profile mismatch<br/>background 加载失败]:::p5

  D1[Jumbotron Adapter<br/>RaceSnapshot -> RacingEntrySnapshot[]<br/>RidingMessageSnapshot[]<br/>AttentionItem[]]:::p2
  D2[Mock Racing Data<br/>Competition KPI<br/>entries messages risks violations<br/>roundProgress overallProgress phaseProgress]:::p2
  D3[Jumbotron Preview 集成<br/>Race Live View 使用 Adapter<br/>使用 track-runtime<br/>使用 track assets]:::p4
  D4[Debug Mode<br/>centerline sampled points<br/>lane offsets checkpoints<br/>horse s collision boxes stale entries]:::p5

  E1[Track Profile Calibrator<br/>Toolbar Canvas Inspector Preview Bar]:::p3
  E2[Calibrator MVP<br/>导入底图<br/>加载创建 profile<br/>添加删除拖拽 points<br/>闭合 反转 起点 lanes checkpoints]:::p3
  E3[Calibrator Preview<br/>scrubber 单马 0 到 100<br/>多马预览<br/>消息气泡预览<br/>复用 track-runtime]:::p3
  E4[Export JSON<br/>导出冻结 track.profile.json<br/>profile 可被 Jumbotron Preview 直接使用]:::p3

  F1[Riding Message 展示<br/>bubble on track<br/>bottom ticker<br/>risk alert item<br/>降噪规则]:::p4
  F2[TOP3 与 Attention<br/>实时 TOP3<br/>Risk Obstacle Violation<br/>Remote Racing Cockpit 入口]:::p4
  F3[Motion State<br/>idle running sprinting slowed<br/>blocked pit_stop takeover finished stale]:::p4

  G1[资产冻结检查<br/>schema geometry<br/>单马预览<br/>至少 8 匹马多马预览<br/>checkpoint 正确<br/>16:9 稳定]:::p5
  G2[端到端验收<br/>2 条示例赛道<br/>Adapter 映射<br/>Jumbotron Preview<br/>Calibrator Export<br/>Debug Mode<br/>不展示完整 Session]:::p5
  G3[文档交付<br/>README<br/>track-profile-spec<br/>calibrator-design<br/>dcr-handoff<br/>asset-pipeline<br/>过程记录]:::p1
  G4[提交推送<br/>检查 git scope<br/>排除 node_modules dist 临时文件<br/>commit<br/>push<br/>确认远端 hash]:::p5

  A0 --> A1 --> A2
  A2 --> B1
  A2 --> B2
  A2 --> B3
  A2 --> B4
  A2 --> B5

  B2 --> C1 --> C2 --> C3
  B3 --> E1
  C2 --> E3
  E1 --> E2 --> E3 --> E4
  C1 --> E2
  C2 --> D3
  B5 --> D3
  B2 --> D1
  D2 --> D1 --> D3
  B3 --> D3

  D3 --> D4
  D3 --> F1
  D3 --> F2
  C2 --> F3
  F3 --> D3

  E4 --> G1
  D3 --> G2
  D4 --> G2
  F1 --> G2
  F2 --> G2
  G1 --> G2
  A1 --> G3
  G2 --> G3 --> G4

  classDef p1 fill:#dbeafe,stroke:#2563eb,color:#0f172a,stroke-width:2px;
  classDef p2 fill:#dcfce7,stroke:#16a34a,color:#0f172a,stroke-width:2px;
  classDef p3 fill:#f3e8ff,stroke:#7c3aed,color:#0f172a,stroke-width:2px;
  classDef p4 fill:#ffedd5,stroke:#f97316,color:#0f172a,stroke-width:2px;
  classDef p5 fill:#fee2e2,stroke:#dc2626,color:#0f172a,stroke-width:2px;
```

## 5 人推荐分工

| 颜色 | 成员 | 推荐主责 | 必须对齐的人 |
|---|---|---|---|
| 蓝色 | 成员 A | 产品定义、信息架构、README、交付文档、过程记录 | B、D、E |
| 绿色 | 成员 B | 数据契约、TrackProfile schema、Jumbotron Adapter、track-runtime 核心计算 | C、D、E |
| 紫色 | 成员 C | 赛道资产、AI-assisted Asset Pipeline、Track Profile Calibrator、Export JSON | B、E |
| 橙色 | 成员 D | Jumbotron / Race Live View、UI primitives、TOP3、KPI、ticker、Riding Message 展示 | A、B、E |
| 红色 | 成员 E | 验证脚本、debug mode、runtime validation、visual validation、提交范围和推送确认 | 全员 |

### 5 人工作包矩阵

| 成员 | 颜色 | 工作包 | 直接交付物 | 前置依赖 | 需要交叉验收 |
|---|---|---|---|---|---|
| 成员 A | 蓝色 | A0 开工确认 | 两份源文档落在 `docs/source/`，`README.md` 指向正确，`TODO.md` 使用源文档原概念 | 无 | E 检查路径和提交范围 |
| 成员 A | 蓝色 | A1 需求覆盖清单 | 源文档覆盖索引、MVP 验收口径、展示边界、工程边界 | A0 | B、C、D、E 分别确认无遗漏 |
| 成员 A | 蓝色 | B1 信息架构与页面骨架 | `Jumbotron Container`、`Race Live View IA`、P0/P1/P2 信息层级 | A1、A2 | D 确认可落地为 UI，E 确认不越界 |
| 成员 A | 蓝色 | G3 文档交付 | README、过程记录、handoff、设计说明、资产说明 | G2 | 全员确认事实正确 |
| 成员 B | 绿色 | B2 数据契约 | `Competition`、`Racing Entry`、`RacingEntrySnapshot`、`RidingMessageSnapshot`、`AttentionItem`、`TrackProfile` | A1、A2 | A 确认概念不漂移，D 确认 UI 可消费 |
| 成员 B | 绿色 | C1 Track Profile schema | `viewBox`、`background`、`centerline`、`lanes`、`checkpoints`、`messageZones`、`noBubbleZones` | B2 | C 确认 Calibrator 可编辑，E 确认可验证 |
| 成员 B | 绿色 | C2 track-runtime | centerline sampling、path length、tangent、normal、lane offset、horse pose、s-axis interpolation | C1 | C 确认 Preview 复用，D 确认马匹展示正确 |
| 成员 B | 绿色 | D1 Jumbotron Adapter | `RaceSnapshot` 到 runtime 输入的映射，含进度字段、lane、风险、stale、消息 | B2、D2 | D 确认页面数据完整，E 确认缺失数据可防御 |
| 成员 C | 紫色 | B3 资产准备 | 至少 2 条示例赛道，含 `background.webp`、`track.profile.json`、`preview.png`、`notes.md`、`source.prompt.md` | A2、C1 初稿 | B 确认 profile 合约，E 确认冻结检查 |
| 成员 C | 紫色 | E1 Calibrator IA | Top Toolbar、Main Canvas、Right Inspector、Bottom Preview Bar | B3、C1 | A 确认不偏离工具定位 |
| 成员 C | 紫色 | E2 Calibrator MVP | 导入、创建、编辑点、闭合、反转、起点、lanes、checkpoints、Validate、Export | E1、C1 | B 确认输出格式，E 确认 validation |
| 成员 C | 紫色 | E3 Calibrator Preview | scrubber 单马 0 到 100、多马预览、消息气泡预览、复用 `track-runtime` | C2、E2 | B 确认 runtime 复用，D 确认视觉预览 |
| 成员 C | 紫色 | E4 Export JSON | 冻结 `track.profile.json`，可被 Jumbotron Preview 直接使用 | E3 | E 确认资产冻结规则 |
| 成员 D | 橙色 | B5 UI 视觉组件 | Header、KPI、TOP3、Track Stage、Left Rail、Bottom Ticker、Footer | B1、B2 | A 确认 IA，E 确认展示边界 |
| 成员 D | 橙色 | D3 Jumbotron Preview 集成 | Race Live View 使用 Adapter、track-runtime、track assets 和 UI skeleton | B3、B5、C2、D1 | 全员端到端走查 |
| 成员 D | 橙色 | F1 Riding Message 展示 | bubble on track、bottom ticker、risk alert item、降噪规则 | D3、31、32、33 | A 确认展示边界，E 确认不遮挡 |
| 成员 D | 橙色 | F2 TOP3 与 Attention | TOP3、Risk / Obstacle / Violation、Remote Racing Cockpit 入口 | D3、F1 | A 确认不扩成独立看板，E 验证点击目标 |
| 成员 D | 橙色 | F3 Motion State 展示 | idle、running、sprinting、slowed、blocked、pit_stop、takeover、finished、stale 的可见表达 | C2、D3 | B 确认状态来源，E 验证 stale |
| 成员 E | 红色 | A2 工程骨架 | apps、packages、assets、docs、验证入口、README 工作入口 | A0 | A 确认目录语义 |
| 成员 E | 红色 | B4 验证脚手架 | schema validation、runtime validation、visual validation、verify script | A2、B2、C1 | B、C、D 提供验证样例 |
| 成员 E | 红色 | C3 Runtime Validation | progress 越界、laneId 不存在、updatedAt 缺失、stale、profile mismatch、background 加载失败 | C2 | B 确认 runtime 行为，D 确认页面呈现 |
| 成员 E | 红色 | D4 Debug Mode | centerline、sampled points、lane offsets、checkpoints、horse s、collision boxes、stale entries | D3、C2 | B、C、D 共同走查 |
| 成员 E | 红色 | G1 资产冻结检查 | schema、geometry、单马、多马、checkpoint、16:9、profile/background 一起提交 | E4 | C 修正资产，D 复核视觉 |
| 成员 E | 红色 | G2 端到端验收 | 2 条赛道、Adapter 映射、Jumbotron Preview、Calibrator Export、Debug Mode、不展示完整 Session | D3、D4、F1、F2、G1 | 全员确认 |
| 成员 E | 红色 | G4 提交推送 | 检查 git scope、排除临时文件、commit、push、确认远端 hash | G3 | A 确认文档完成，用户明确要求后再推送 |

### 前置依赖与并行关系表

| 工作包 | 可否并行 | 前置依赖 | 不可跳过的后置检查 |
|---|---|---|---|
| A0 开工确认 | 否 | 无 | 两份源文档在 `Week2-Jumbotron/docs/source/` |
| A1 需求覆盖清单 | 否 | A0 | 两份源文档每个章节都有 TODO 映射 |
| A2 工程骨架 | 否 | A0 | 目录不进入 `PoC-GRS-001/`，入口索引正确 |
| B1 信息架构与页面骨架 | 是 | A1、A2 | P0/P1/P2 信息层级存在 |
| B2 数据契约 | 是 | A1、A2 | progress、risk、message、attention、profile 字段齐全 |
| B3 资产准备 | 是 | A2、C1 初稿 | 至少 2 条示例赛道资产齐全 |
| B4 验证脚手架 | 是 | A2、B2、C1 | 能覆盖 schema、runtime、visual 三类验证 |
| B5 UI 视觉组件 | 是 | B1、B2 | Header、KPI、TOP3、Track Stage、ticker、Footer 可见 |
| C1 Track Profile schema | 否 | B2 | 与 Calibrator、runtime、资产目录一致 |
| C2 track-runtime | 否 | C1 | 输出 `HorsePose`，使用 `s` 轴补间，不直接写死 `x/y` |
| C3 Runtime Validation | 是 | C2 | 越界、缺 lane、缺 updatedAt、stale、版本不匹配、底图失败都有处理 |
| D1 Jumbotron Adapter | 是 | B2、D2 | 默认使用 `roundProgress`，仅 `overallProgress` 时标记临时映射 |
| D2 Mock Racing Data | 是 | B2 | 覆盖 entries、messages、risks、violations、progress 三语义 |
| D3 Jumbotron Preview 集成 | 否 | B3、B5、C2、D1 | Race Live View 从真实 runtime 输入渲染，不从图片推断位置 |
| D4 Debug Mode | 是 | D3、C2 | 所有 debug overlay 项目都能打开检查 |
| E1 Calibrator IA | 是 | B3、C1 | Toolbar、Canvas、Inspector、Preview Bar 齐全 |
| E2 Calibrator MVP | 否 | E1、C1 | 可编辑、Validate、Export JSON |
| E3 Calibrator Preview | 否 | C2、E2 | 复用 `track-runtime`，支持单马和多马预览 |
| E4 Export JSON | 否 | E3 | 导出 profile 可被 Jumbotron Preview 直接使用 |
| F1 Riding Message 展示 | 是 | D3 | bubble、ticker、risk alert item 与降噪规则生效 |
| F2 TOP3 与 Attention | 是 | D3 | 不扩展成独立看板，入口指向 Remote Racing Cockpit |
| F3 Motion State | 是 | C2、D3 | 状态机来源明确，stale 不伪造推进 |
| G1 资产冻结检查 | 否 | E4 | 通过 schema、geometry、单马、多马、16:9 检查 |
| G2 端到端验收 | 否 | D3、D4、F1、F2、G1 | 覆盖 MVP 验收口径 11 条 |
| G3 文档交付 | 否 | G2 | README、设计说明、handoff、过程记录与实际结果一致 |
| G4 提交推送 | 否 | G3 | 仅在用户明确要求推送时执行，确认远端 hash |

## 并行与顺序说明

- [ ] 必须先完成开工确认，保存文档，建立第二周独立目录。
- [ ] 必须先完成核心概念对齐，不能把 `Jumbotron` 改写成普通榜单或普通监控台。
- [ ] `信息架构`、`数据契约`、`资产准备`、`UI 视觉骨架`、`验证脚手架` 可以并行启动。
- [ ] `track-runtime` 依赖 `TrackProfile schema`，不能先写死 UI 坐标再补 runtime。
- [ ] `Jumbotron Preview` 依赖 `track-runtime`、`Adapter`、`track assets`、`UI skeleton`。
- [ ] `Calibrator Preview` 必须复用 `track-runtime`，不能另写一套预览逻辑。
- [ ] `Calibrator Export JSON` 必须能被 `Jumbotron Preview` 直接使用。
- [ ] `Riding Message bubble`、`Bottom Ticker`、`TOP3` 可以在 Jumbotron Preview 主链路跑通后并行增强。
- [ ] `Debug Mode` 可以与 Jumbotron Preview 集成并行，但最终必须覆盖 centerline、sampled points、lane offsets、checkpoints、horse s、collision boxes、stale entries。
- [ ] `Runtime Validation` 可以与 `track-runtime` 并行推进，但必须在端到端验收前接入。
- [ ] `Visual Validation` 必须等至少一条示例赛道可跑后进行。
- [ ] `资产冻结检查` 必须等 Calibrator 导出和 Jumbotron Preview 都可用后进行。
- [ ] `README` 和过程记录可以从第一天开始写，但最终版必须等端到端验收结果确定后收口。
- [ ] `提交推送` 必须在验证通过、范围确认、临时文件排除后进行。

## 关键路径拆解

### 关键路径 1：事实来源到马匹位置

- [ ] 定义 `TrackProfile`。
- [ ] 定义 `centerline.points`。
- [ ] 定义 `lanes`。
- [ ] 定义 `checkpoints`。
- [ ] 实现 schema validation。
- [ ] 实现 centerline sampling。
- [ ] 实现 path length。
- [ ] 实现 tangent。
- [ ] 实现 normal。
- [ ] 实现 lane offset。
- [ ] 输入 `roundProgress`。
- [ ] 输出 `HorsePose.x`。
- [ ] 输出 `HorsePose.y`。
- [ ] 输出 `HorsePose.rotation`。
- [ ] 输出 `HorsePose.s`。
- [ ] 在 Jumbotron Preview 中显示马匹。
- [ ] 在 debug mode 中显示采样依据。

### 关键路径 2：RaceSnapshot 到大屏展示

- [ ] 定义 `RaceSnapshot`。
- [ ] 定义 competition metadata。
- [ ] 定义 KPI summary。
- [ ] 定义 racing entries。
- [ ] 定义 recent messages。
- [ ] 定义 risks。
- [ ] 定义 violations。
- [ ] 实现 Jumbotron Adapter。
- [ ] 输出 `RacingEntrySnapshot[]`。
- [ ] 输出 `RidingMessageSnapshot[]`。
- [ ] 输出 `AttentionItem[]`。
- [ ] 默认使用 `roundProgress`。
- [ ] 只有 `overallProgress` 时标记临时映射。
- [ ] 映射 CA provider。
- [ ] 映射风险状态。
- [ ] 分配 lane。
- [ ] 处理缺失数据。
- [ ] 处理 stale。
- [ ] 提取 Riding Message。
- [ ] 驱动 Race Live View。

### 关键路径 3：Calibrator 到可复用资产

- [ ] 导入底图。
- [ ] 加载 Track Profile。
- [ ] 创建 Track Profile。
- [ ] 添加 centerline points。
- [ ] 删除 centerline points。
- [ ] 拖拽 centerline points。
- [ ] 平滑路径预览。
- [ ] 闭合路径。
- [ ] 一键反转方向。
- [ ] 设置起点。
- [ ] 配置 lane offsets。
- [ ] 配置 checkpoints。
- [ ] 通过 scrubber 预览单马。
- [ ] 预览多马。
- [ ] 运行 validation。
- [ ] Export JSON。
- [ ] 导出的 `track.profile.json` 交给 Jumbotron Preview 使用。

### 关键路径 4：现场大屏可读性

- [ ] Header 可读。
- [ ] LIVE 状态可读。
- [ ] Round 可读。
- [ ] Phase 可读。
- [ ] Elapsed Time 可读。
- [ ] Online Riders 可读。
- [ ] KPI Strip 可读。
- [ ] TOP3 可读。
- [ ] Track Stage 可读。
- [ ] 马匹编号可读。
- [ ] 项目标签可读。
- [ ] 骑手标签可读。
- [ ] Riding Message bubble 可读。
- [ ] Risk / Obstacle / Violation ticker 可读。
- [ ] Footer 可读。
- [ ] 16:9 大屏稳定。
- [ ] 不展示完整 Session。
- [ ] 不展示完整日志。
- [ ] 不展示复杂代码 diff。
- [ ] 不展示长文本评论流。

### 关键路径 5：验证与提交

- [ ] 自动验证 schema。
- [ ] 自动验证 geometry。
- [ ] 自动验证 runtime sampling。
- [ ] 自动验证 adapter mapping。
- [ ] 自动验证 motion states。
- [ ] 自动验证 stale。
- [ ] 自动验证 debug mode。
- [ ] 自动验证 2 条示例赛道。
- [ ] 人工验证视觉稳定。
- [ ] 人工验证多马不明显跑出赛道。
- [ ] 人工验证气泡不遮挡标题。
- [ ] 人工验证气泡不遮挡 KPI。
- [ ] 人工验证 checkpoint 语义正确。
- [ ] 检查 README。
- [ ] 检查过程记录。
- [ ] 检查提交范围。
- [ ] 排除 `node_modules/`。
- [ ] 排除 `dist/`。
- [ ] 排除临时文件。
- [ ] commit。
- [ ] push。
- [ ] 确认远端 hash。

## 0. 开工准备

- [ ] 在 `ARY` 仓库内建立第二周独立目录，不把第二周内容继续堆进 `PoC-GRS-001/`。
- [ ] 固定第二周工作目录，例如 `Week2-Jumbotron/`。
- [ ] 保存两个核心文档原文。
- [ ] 建立第二周 README。
- [ ] 建立第二周过程记录目录。
- [ ] 建立第二周验证记录文件。
- [ ] 明确第一周 `ARY-GRS001` 已在 `ary-grs-001-sinbawang` 中存档。
- [ ] 明确第二周主题是 `DevCompass Racing Jumbotron`。
- [ ] 明确第二周不是继续写第一周 `Public Yard / Private Race Source`。
- [ ] 明确第二周可以复用第一周 PoC 的工程经验。
- [ ] 明确第二周不能混淆 `ARY GRS001` 与 `DCR Jumbotron` 的产品目标。
- [ ] 明确最终提交前必须推送远端。

## 1. 子系统定位

- [ ] 定义 `Jumbotron` 是 `DevCompass Racing` 的赛事主视觉子系统。
- [ ] 定义 `Jumbotron` 是公开大屏容器。
- [ ] 定义 `Jumbotron` 面向 `Workshop / Hackathon / 团队协作` 场景。
- [ ] 定义 `Jumbotron` 负责展示赛事化摘要。
- [ ] 定义 `Jumbotron` 负责展示实时态势。
- [ ] 定义 `Jumbotron` 负责展示赛道位置。
- [ ] 定义 `Jumbotron` 负责展示风险。
- [ ] 定义 `Jumbotron` 负责展示协作入口。
- [ ] 定义 `Jumbotron` 不展示完整 `Coding Agent Session` 细节。
- [ ] 定义 `Jumbotron` 把多个项目状态聚合为赛事画面。
- [ ] 定义 `Jumbotron` 把多个 Rider 状态聚合为赛事画面。
- [ ] 定义 `Jumbotron` 把多个 `Racing Cockpit` 状态聚合为赛事画面。
- [ ] 定义 `Jumbotron` 把多个 `Coding Agent` 运行状态聚合为赛事画面。
- [ ] 定义 `Jumbotron` 面向现场观众。
- [ ] 定义 `Jumbotron` 面向组织者。
- [ ] 定义 `Jumbotron` 面向教师。
- [ ] 定义 `Jumbotron` 面向助教。
- [ ] 定义 `Jumbotron` 要让现场人员快速理解比赛。
- [ ] 定义 `Jumbotron` 要让现场人员快速理解项目推进。
- [ ] 定义 `Jumbotron` 要让现场人员快速理解风险状态。

## 2. Jumbotron 要回答的五个问题

- [ ] 展示当前比赛进行到哪里。
- [ ] 展示谁领先。
- [ ] 展示谁在追赶。
- [ ] 展示哪些项目正在发生关键动态。
- [ ] 展示整体进度是否健康。
- [ ] 展示资源消耗是否健康。
- [ ] 展示参与情况是否健康。
- [ ] 展示哪些风险需要现场关注。
- [ ] 展示哪些阻碍需要现场关注。
- [ ] 展示哪些违规需要现场关注。

## 3. Display Scope

- [ ] 明确 `Jumbotron` 是大屏容器。
- [ ] MVP 范围只保留 `race_live`。
- [ ] `race_live` 只包含 `Jumbotron / Race Live View`。
- [ ] 不做独立第二大屏模式。
- [ ] 不要求表格主榜。
- [ ] 不要求多维排行。
- [ ] `Race Live View` 面向现场观众。
- [ ] `Race Live View` 面向组织者。
- [ ] `Race Live View` 强调赛道。
- [ ] `Race Live View` 强调位置。
- [ ] `Race Live View` 强调追赶关系。
- [ ] `Race Live View` 强调实时消息。
- [ ] `Race Live View` 强调现场氛围。

## 4. Runtime Side 组成

- [ ] 实现或定义 `Jumbotron / Race Live View`。
- [ ] 实现或定义 `Jumbotron Adapter`。
- [ ] 实现或定义 `track-runtime`。
- [ ] 实现或定义 `ui-primitives`。
- [ ] 实现或定义 `mock-racing-data`。
- [ ] 明确运行时从 `DCR RaceSnapshot` 开始。
- [ ] 明确运行时经过 `Jumbotron Adapter`。
- [ ] 明确运行时输出 `RacingEntrySnapshot[]`。
- [ ] 明确运行时进入 `track-runtime`。
- [ ] 明确运行时最终渲染到 `Jumbotron / Race Live View`。

## 5. Design-time Side 组成

- [ ] 实现或定义 `Track Profile Calibrator`。
- [ ] 实现或定义 `Track Profile Validator`。
- [ ] 实现或定义 `AI-assisted Asset Pipeline`。
- [ ] 明确设计时从 `AI / Design Track Background` 开始。
- [ ] 明确设计时进入 `Track Profile Calibrator`。
- [ ] 明确设计时导出 `track.profile.json`。
- [ ] 明确 `track.profile.json` 进入 `track-runtime`。
- [ ] 明确 `track-runtime` 驱动 `Jumbotron / Race Live View`。
- [ ] 明确 Calibrator 是设计资产生产工具。
- [ ] 明确 Calibrator 不是运行时 UI。

## 6. Shared Assets / Contracts

- [ ] 定义 `track-profile schema`。
- [ ] 提供 `track.profile.json`。
- [ ] 提供 `background.webp`。
- [ ] 提供 `preview.png`。
- [ ] 定义 `RacingEntrySnapshot contract`。
- [ ] 明确 `track.profile.json` 是赛道语义资产。
- [ ] 明确 `track.profile.json` 是运行时事实来源。
- [ ] 明确背景图是视觉资产。
- [ ] 明确赛道几何才是定位依据。

## 7. Jumbotron / Race Live View 职责

- [ ] 展示赛事标题。
- [ ] 展示 `LIVE`。
- [ ] 展示 `Round`。
- [ ] 展示 `Phase`。
- [ ] 展示计时。
- [ ] 展示总进度。
- [ ] 展示活跃骑手。
- [ ] 展示 `Tokens`。
- [ ] 展示 `Codex / Claude` 使用。
- [ ] 展示赛事 KPI。
- [ ] 展示赛道主视觉。
- [ ] 根据 `RacingEntrySnapshot.roundProgress` 渲染马匹位置。
- [ ] 展示马匹编号。
- [ ] 展示项目标签。
- [ ] 展示骑手标签。
- [ ] 展示 TOP3。
- [ ] 展示高亮 Entry。
- [ ] 展示 Riding Message 气泡。
- [ ] 展示底部 ticker 中的 Riding Message。
- [ ] 展示底部 ticker 中的风险提醒。
- [ ] 展示底部 ticker 中的违规提醒。
- [ ] 支持 debug mode。
- [ ] 通过 debug mode 验证几何。
- [ ] 通过 debug mode 验证路径。
- [ ] 通过 debug mode 验证车道。
- [ ] 通过 debug mode 验证 stale 状态。

## 8. Jumbotron 不负责

- [ ] 不做真实后端聚合。
- [ ] 不做权限。
- [ ] 不做房间。
- [ ] 不做 Workshop 上下文。
- [ ] 不定义排名语义最终版本。
- [ ] 不做 `Remote Racing Cockpit` 协作流程。
- [ ] 不做复杂 3D。
- [ ] 不做真实物理模拟。
- [ ] 不展示完整终端日志。
- [ ] 不展示完整 `Coding Agent Session`。
- [ ] 不展示长文本评论流。
- [ ] 不展示复杂代码 diff。
- [ ] 不做细粒度项目管理后台。
- [ ] 不展示需要个人授权才能展示的私密内容。

## 9. Jumbotron 应展示内容

- [ ] 展示赛事标题。
- [ ] 展示赛事阶段。
- [ ] 展示赛事时间。
- [ ] 展示 `LIVE` 状态。
- [ ] 展示 `Racing Entry` 排名。
- [ ] 展示 `Racing Entry` 位置。
- [ ] 展示 `Racing Entry` 进度。
- [ ] 展示 `Racing Entry` 成本。
- [ ] 展示 `Racing Entry` 风险。
- [ ] 展示 `Racing Entry` 消息摘要。
- [ ] 展示赛事级 KPI。
- [ ] 展示实时 TOP3。
- [ ] 展示 Riding Message。
- [ ] 展示 Risk。
- [ ] 展示 Obstacle。
- [ ] 展示 Violation。
- [ ] 展示进入 Remote Racing Cockpit 的入口。

## 10. 容器级信息架构

- [ ] 实现 `Jumbotron Container`。
- [ ] 实现 `Header`。
- [ ] `Header` 展示 Brand。
- [ ] `Header` 展示 Subtitle。
- [ ] `Header` 展示 LIVE Status。
- [ ] `Header` 展示 Current Phase。
- [ ] `Header` 展示 Current Round。
- [ ] `Header` 展示 Elapsed Time。
- [ ] `Header` 展示 Online Riders。
- [ ] `Header` 展示 Active Riders。
- [ ] 实现 `Global KPI Strip`。
- [ ] `Global KPI Strip` 展示 Completion Rate。
- [ ] `Global KPI Strip` 展示 Total Tokens。
- [ ] `Global KPI Strip` 展示 Codex Usage。
- [ ] `Global KPI Strip` 展示 Claude Usage。
- [ ] `Global KPI Strip` 展示 Risk Count。
- [ ] `Global KPI Strip` 展示 Obstacle Count。
- [ ] `Global KPI Strip` 展示 Violation Count。
- [ ] 实现 `Main Content`。
- [ ] `Main Content` 承载 Race Live View。
- [ ] 实现 `Attention / Message Area`。
- [ ] `Attention / Message Area` 展示 Riding Message。
- [ ] `Attention / Message Area` 展示 Risk。
- [ ] `Attention / Message Area` 展示 Obstacle。
- [ ] `Attention / Message Area` 展示 Violation。
- [ ] 实现 `Footer`。
- [ ] `Footer` 展示 LIVE Status。
- [ ] `Footer` 展示 Theme。
- [ ] `Footer` 展示 Organizer。
- [ ] `Footer` 展示 Current Phase。
- [ ] `Footer` 展示 Next Phase。
- [ ] `Footer` 展示 System Time。

## 11. Race Live View 信息架构

- [ ] 实现 `Race Live View`。
- [ ] 以赛道主视觉为中心。
- [ ] 用马匹位置表达赛事进行态。
- [ ] 用排名编号表达赛事进行态。
- [ ] 用项目气泡表达赛事进行态。
- [ ] 用 TOP3 表达赛事进行态。
- [ ] 用底部 ticker 表达赛事进行态。
- [ ] 实现 `Header / Status Bar`。
- [ ] `Header / Status Bar` 展示 DevCompass Racing。
- [ ] `Header / Status Bar` 展示 Workshop / Hackathon Live Screen。
- [ ] `Header / Status Bar` 展示 LIVE Badge。
- [ ] `Header / Status Bar` 展示 Current Round。
- [ ] `Header / Status Bar` 展示 Elapsed Time。
- [ ] `Header / Status Bar` 展示 Online Riders。
- [ ] 实现 `Top Summary Row`。
- [ ] `Top Summary Row` 展示 Real-time TOP3。
- [ ] `Top Summary Row` 展示 Competition KPI Cards。
- [ ] `Real-time TOP3` 展示 Rank 1 Entry。
- [ ] `Real-time TOP3` 展示 Rank 2 Entry。
- [ ] `Real-time TOP3` 展示 Rank 3 Entry。
- [ ] `Competition KPI Cards` 展示 Completion Rate。
- [ ] `Competition KPI Cards` 展示 Total Tokens。
- [ ] `Competition KPI Cards` 展示 Codex Usage。
- [ ] `Competition KPI Cards` 展示 Claude Usage。
- [ ] 实现 `Track Stage`。
- [ ] `Track Stage` 展示 Track Background。
- [ ] `Track Stage` 展示 Semantic Track Overlay。
- [ ] `Track Stage` 展示 Racing Entry Markers。
- [ ] `Track Stage` 展示 Ranking Number Badges。
- [ ] `Track Stage` 展示 Horse / Rider Visuals。
- [ ] `Track Stage` 展示 Riding Message Bubbles。
- [ ] `Track Stage` 展示 LIVE Indicator。
- [ ] 实现 `Left Rail`。
- [ ] `Left Rail` 展示 Track Mini Map。
- [ ] `Left Rail` 展示 Checkpoints。
- [ ] `Left Rail` 展示 Entry Legend。
- [ ] 实现 `Bottom Ticker`。
- [ ] `Bottom Ticker` 展示 Risk Items。
- [ ] `Bottom Ticker` 展示 Obstacle Items。
- [ ] `Bottom Ticker` 展示 Violation Items。
- [ ] `Bottom Ticker` 展示 Recent Message Items。
- [ ] `Bottom Ticker` 展示 View More。
- [ ] 实现 Race Live View Footer。
- [ ] Footer 展示 Theme。
- [ ] Footer 展示 Organizer。
- [ ] Footer 展示 Current Phase。
- [ ] Footer 展示 Next Phase。
- [ ] Footer 展示 System Time。

## 12. Race Live View 信息优先级

- [ ] 优先展示当前赛事正在发生什么。
- [ ] 优先展示谁领先。
- [ ] 优先展示谁在追赶。
- [ ] 展示每个重点 Racing Entry 位于哪里。
- [ ] 展示哪些 Riding Message 值得现场看到。
- [ ] 展示哪些风险需要关注。
- [ ] 展示哪些阻碍需要关注。
- [ ] 展示哪些违规需要关注。
- [ ] 展示总进度。
- [ ] 展示资源消耗。
- [ ] 展示 CA 使用情况。

## 13. 核心信息对象 Competition

- [ ] 定义 `Competition`。
- [ ] `Competition` 包含 `competitionId`。
- [ ] `Competition` 包含 `title`。
- [ ] `Competition` 包含 `subtitle`。
- [ ] `Competition` 包含 `theme`。
- [ ] `Competition` 包含 `organizer`。
- [ ] `Competition` 包含 `liveStatus`。
- [ ] `Competition` 包含 `currentPhase`。
- [ ] `Competition` 包含 `currentRound`。
- [ ] `Competition` 包含 `nextPhase`。
- [ ] `Competition` 包含 `elapsedTime`。
- [ ] `Competition` 包含 `systemTime`。

## 14. 核心信息对象 Racing Entry

- [ ] 定义 `Racing Entry` 是 Jumbotron 中被展示和比较的基本单元。
- [ ] 允许 `Racing Entry` 对应一个项目。
- [ ] 允许 `Racing Entry` 对应一名 Rider。
- [ ] 允许 `Racing Entry` 对应一个团队。
- [ ] 允许 `Racing Entry` 对应一个项目下的主要 Racing Cockpit。
- [ ] `Racing Entry` 包含 `entryId`。
- [ ] `Racing Entry` 包含 `displayName`。
- [ ] `Racing Entry` 包含 `riderName`。
- [ ] `Racing Entry` 包含 `projectName`。
- [ ] `Racing Entry` 包含 `rank`。
- [ ] `Racing Entry` 包含 `rankDelta`。
- [ ] `Racing Entry` 包含 `score`。
- [ ] `Racing Entry` 包含 `overallProgress`。
- [ ] `Racing Entry` 包含 `roundProgress`。
- [ ] `Racing Entry` 包含 `phaseProgress`。
- [ ] `Racing Entry` 包含 `tokenCost`。
- [ ] `Racing Entry` 包含 `primaryCA`。
- [ ] `Racing Entry` 包含 `codexUsage`。
- [ ] `Racing Entry` 包含 `claudeUsage`。
- [ ] `Racing Entry` 包含 `riskLevel`。
- [ ] `Racing Entry` 包含 `motionState`。
- [ ] `Racing Entry` 包含 `latestMessage`。
- [ ] `Racing Entry` 包含 `remoteCockpitUrl`。

## 15. 核心信息对象 Competition KPI

- [ ] 定义 `Competition KPI`。
- [ ] `Competition KPI` 包含 `completionRate`。
- [ ] `Competition KPI` 包含 `totalTokens`。
- [ ] `Competition KPI` 包含 `activeRiders`。
- [ ] `Competition KPI` 包含 `onlineRiders`。
- [ ] `Competition KPI` 包含 `activeCockpits`。
- [ ] `Competition KPI` 包含 `codexTokens`。
- [ ] `Competition KPI` 包含 `claudeTokens`。
- [ ] `Competition KPI` 包含 `codexShare`。
- [ ] `Competition KPI` 包含 `claudeShare`。
- [ ] `Competition KPI` 包含 `riskCount`。
- [ ] `Competition KPI` 包含 `obstacleCount`。
- [ ] `Competition KPI` 包含 `violationCount`。

## 16. 核心信息对象 Riding Message

- [ ] 定义 `Riding Message` 来自项目。
- [ ] 定义 `Riding Message` 来自骑手。
- [ ] 定义 `Riding Message` 来自 Racing Cockpit。
- [ ] 定义 `Riding Message` 是过程消息。
- [ ] `Riding Message` 包含 `messageId`。
- [ ] `Riding Message` 包含 `entryId`。
- [ ] `Riding Message` 包含 `source`。
- [ ] `Riding Message` 包含 `type`。
- [ ] `Riding Message` 包含 `severity`。
- [ ] `Riding Message` 包含 `summary`。
- [ ] `Riding Message` 包含 `createdAt`。
- [ ] `Riding Message` 包含 `displayMode`。
- [ ] `Riding Message` 包含 `targetUrl`。
- [ ] 支持 `progress_update` 类型。
- [ ] 支持 `milestone` 类型。
- [ ] 支持 `strategy_change` 类型。
- [ ] 支持 `quality_signal` 类型。
- [ ] 支持 `risk_alert` 类型。
- [ ] 支持 `obstacle` 类型。
- [ ] 支持 `violation` 类型。
- [ ] 支持 `takeover` 类型。
- [ ] 支持 `pit_stop` 类型。

## 17. 核心信息对象 Risk / Obstacle / Violation

- [ ] 统一展示 Risk。
- [ ] 统一展示 Obstacle。
- [ ] 统一展示 Violation。
- [ ] 定义 `Attention Item`。
- [ ] `Attention Item` 包含 `itemId`。
- [ ] `Attention Item` 包含 `entryId`。
- [ ] `Attention Item` 包含 `category`。
- [ ] `category` 支持 `risk`。
- [ ] `category` 支持 `obstacle`。
- [ ] `category` 支持 `violation`。
- [ ] `Attention Item` 包含 `severity`。
- [ ] `severity` 支持 `low`。
- [ ] `severity` 支持 `medium`。
- [ ] `severity` 支持 `high`。
- [ ] `severity` 支持 `critical`。
- [ ] `Attention Item` 包含 `summary`。
- [ ] `Attention Item` 包含 `status`。
- [ ] `Attention Item` 包含 `createdAt`。
- [ ] `Attention Item` 包含 `targetUrl`。

## 18. 核心信息对象 Track Template

- [ ] 定义 `Track Template`。
- [ ] 明确 `Track Template` 是 Race Live View 的空间展示基础。
- [ ] 明确赛道模板由视觉底图构成。
- [ ] 明确赛道模板由语义赛道构成。
- [ ] `Track Template` 包含 `trackId`。
- [ ] `Track Template` 包含 `backgroundAsset`。
- [ ] `Track Template` 包含 `viewBox`。
- [ ] `Track Template` 包含 `designSize`。
- [ ] `Track Template` 包含 `centerlinePath`。
- [ ] `Track Template` 包含 `startLine`。
- [ ] `Track Template` 包含 `finishLine`。
- [ ] `Track Template` 包含 `checkpoints`。
- [ ] `Track Template` 包含 `laneOffsets`。
- [ ] `Track Template` 包含 `safeZones`。
- [ ] 明确 `backgroundAsset` 是视觉皮肤。
- [ ] 明确 `centerlinePath` 是用于定位的赛道中心线。

## 19. Racing Position

- [ ] 定义 `Racing Position`。
- [ ] 明确 Race Live View 中的赛马位置不是固定 `x / y` 坐标。
- [ ] 明确赛马位置由进度和赛道几何派生。
- [ ] 使用 `Track Template`。
- [ ] 使用 `Progress`。
- [ ] 使用 `Lane Offset`。
- [ ] 使用 `Display Adjustment`。
- [ ] 默认用 `roundProgress` 映射位置。
- [ ] 默认用 `centerlinePath distance` 计算路径距离。
- [ ] 默认由路径距离得到 point。
- [ ] 默认由路径得到 rotation。
- [ ] 默认应用 `laneOffset`。
- [ ] 默认应用 `displayAdjustment`。

## 20. Racing Motion State

- [ ] 定义 `Racing Motion State`。
- [ ] 支持 `idle`。
- [ ] `idle` 表示暂无明显推进。
- [ ] `idle` 展示原地轻微待机。
- [ ] 支持 `running`。
- [ ] `running` 表示正常推进。
- [ ] `running` 展示常规奔跑动效。
- [ ] 支持 `sprinting`。
- [ ] `sprinting` 表示近期推进明显。
- [ ] `sprinting` 展示更快奔跑或高亮。
- [ ] 支持 `slowed`。
- [ ] `slowed` 表示推进变慢。
- [ ] `slowed` 展示慢速移动或弱化。
- [ ] 支持 `blocked`。
- [ ] `blocked` 表示被阻碍或存在高风险。
- [ ] `blocked` 展示停顿或警示标记。
- [ ] 支持 `pit_stop`。
- [ ] `pit_stop` 表示进入 Pit Stop。
- [ ] `pit_stop` 展示停靠或维修提示。
- [ ] 支持 `takeover`。
- [ ] `takeover` 表示远程接管中。
- [ ] `takeover` 展示接管徽标。
- [ ] 支持 `finished`。
- [ ] `finished` 表示当前 Round 或阶段完成。
- [ ] `finished` 展示冲线或完成标记。
- [ ] 支持 `stale`。
- [ ] `stale` 表示长时间无新数据。
- [ ] `stale` 展示降低透明度或离线提示。

## 21. Track Profile

- [ ] 定义 `Track Profile`。
- [ ] 明确 `Track Profile` 是赛道语义资产。
- [ ] 明确 `Track Profile` 是运行时事实来源。
- [ ] `Track Profile` 描述画布尺寸。
- [ ] `Track Profile` 描述背景图。
- [ ] `Track Profile` 描述中心线。
- [ ] `Track Profile` 描述路径是否闭合。
- [ ] `Track Profile` 描述方向。
- [ ] `Track Profile` 描述起点。
- [ ] `Track Profile` 描述终点。
- [ ] `Track Profile` 描述马道偏移。
- [ ] `Track Profile` 描述 checkpoints。
- [ ] `Track Profile` 描述气泡区域。
- [ ] `Track Profile` 描述风险区域。
- [ ] `Track Profile` 描述调试信息。
- [ ] `TrackProfile` 包含 `schemaVersion`。
- [ ] `TrackProfile` 包含 `trackId`。
- [ ] `TrackProfile` 包含 `name`。
- [ ] `TrackProfile` 包含 `viewBox`。
- [ ] `TrackProfile` 包含 `background`。
- [ ] `TrackProfile` 包含 `centerline`。
- [ ] `centerline` 包含 `type`。
- [ ] `centerline` 包含 `closed`。
- [ ] `centerline` 包含 `points`。
- [ ] `centerline` 包含 `smoothing`。
- [ ] `TrackProfile` 包含 `direction`。
- [ ] `TrackProfile` 包含 `startFinish`。
- [ ] `TrackProfile` 包含 `lanes`。
- [ ] `TrackProfile` 包含 `checkpoints`。
- [ ] `TrackProfile` 包含 `messageZones`。
- [ ] `TrackProfile` 包含 `noBubbleZones`。
- [ ] MVP 使用 `polyline + smoothing`。
- [ ] MVP 不把 SVG Path 作为唯一事实。
- [ ] 保证中心线容易人工拖拽调整。
- [ ] 保证中心线容易 Git diff。
- [ ] 保证中心线容易校验异常点。
- [ ] 保证中心线容易支持一键反转。
- [ ] 保证中心线容易做路径采样表。
- [ ] 保证 Track Profile 适合 Calibrator。

## 22. RacingEntrySnapshot contract

- [ ] 定义 `RacingEntrySnapshot`。
- [ ] `RacingEntrySnapshot` 包含 `entryId`。
- [ ] `RacingEntrySnapshot` 包含 `riderName`。
- [ ] `RacingEntrySnapshot` 包含 `projectName`。
- [ ] `RacingEntrySnapshot` 可包含 `cockpitId`。
- [ ] `RacingEntrySnapshot` 包含 `caProvider`。
- [ ] `caProvider` 支持 `codex`。
- [ ] `caProvider` 支持 `claude`。
- [ ] `caProvider` 支持 `other`。
- [ ] `RacingEntrySnapshot` 可包含 `rank`。
- [ ] `RacingEntrySnapshot` 包含 `overallProgress`。
- [ ] `RacingEntrySnapshot` 包含 `roundProgress`。
- [ ] `RacingEntrySnapshot` 可包含 `phaseProgress`。
- [ ] `RacingEntrySnapshot` 可包含 `currentPhase`。
- [ ] `currentPhase` 支持 `PRD`。
- [ ] `currentPhase` 支持 `DEV`。
- [ ] `currentPhase` 支持 `REL`。
- [ ] `currentPhase` 支持 `OPS`。
- [ ] `currentPhase` 支持 `PM`。
- [ ] `RacingEntrySnapshot` 可包含 `costTokens`。
- [ ] `RacingEntrySnapshot` 可包含 `costUsd`。
- [ ] `RacingEntrySnapshot` 包含 `riskLevel`。
- [ ] `riskLevel` 支持 `none`。
- [ ] `riskLevel` 支持 `low`。
- [ ] `riskLevel` 支持 `medium`。
- [ ] `riskLevel` 支持 `high`。
- [ ] `RacingEntrySnapshot` 包含 `obstacleCount`。
- [ ] `RacingEntrySnapshot` 包含 `violationCount`。
- [ ] `RacingEntrySnapshot` 包含 `status`。
- [ ] `status` 支持 `idle`。
- [ ] `status` 支持 `running`。
- [ ] `status` 支持 `blocked`。
- [ ] `status` 支持 `pit_stop`。
- [ ] `status` 支持 `takeover`。
- [ ] `status` 支持 `finished`。
- [ ] `status` 支持 `stale`。
- [ ] `RacingEntrySnapshot` 可包含 `laneId`。
- [ ] `RacingEntrySnapshot` 可包含 `lastMessage`。
- [ ] `RacingEntrySnapshot` 包含 `updatedAt`。

## 23. HorsePose

- [ ] 定义 `HorsePose`。
- [ ] `HorsePose` 由 `track-runtime` 输出给 Jumbotron。
- [ ] `HorsePose` 包含 `entryId`。
- [ ] `HorsePose` 包含 `x`。
- [ ] `HorsePose` 包含 `y`。
- [ ] `HorsePose` 包含 `rotation`。
- [ ] `HorsePose` 包含 `s`。
- [ ] `HorsePose` 包含 `laneId`。
- [ ] `HorsePose` 包含 `state`。
- [ ] `state` 使用 `HorseMotionState`。
- [ ] `HorsePose` 包含 `zIndex`。

## 24. Snapshot 与 Event

- [ ] 明确 Snapshot 用于当前画面状态。
- [ ] 明确 Event 用于触发临时动画。
- [ ] 明确 Event 用于触发消息。
- [ ] Runtime 应能只靠 Snapshot 渲染当前画面。
- [ ] Event 不应成为唯一事实来源。

## 25. track-runtime

- [ ] 实现 `track-runtime`。
- [ ] `track-runtime` 由 Jumbotron 使用。
- [ ] `track-runtime` 由 Calibrator 使用。
- [ ] `track-runtime` 加载 Track Profile。
- [ ] `track-runtime` 校验 Track Profile。
- [ ] `track-runtime` 将 centerline 转换为可采样路径。
- [ ] `track-runtime` 计算路径长度。
- [ ] `track-runtime` 根据 `s` 采样中心点。
- [ ] `track-runtime` 计算切线方向。
- [ ] `track-runtime` 计算法线方向。
- [ ] `track-runtime` 应用 lane offset。
- [ ] `track-runtime` 计算 horse pose。
- [ ] `track-runtime` 管理 horse animation state。
- [ ] `track-runtime` 提供 message bubble 的候选位置。
- [ ] `track-runtime` 提供 runtime validation。
- [ ] Calibrator 预览必须复用 `track-runtime`。
- [ ] Calibrator 不能另写一套预览逻辑。
- [ ] Jumbotron 不能另写一套位置采样逻辑。

## 26. 位置计算规则

- [ ] 赛马位置不能手写 `x/y`。
- [ ] 赛马位置不能运行时从图片识别。
- [ ] 从 `RacingEntrySnapshot.roundProgress` 开始计算。
- [ ] 把 `roundProgress` 转成 normalized `s`。
- [ ] 用 `s` 采样 centerline point。
- [ ] 计算 tangent vector。
- [ ] 计算 normal vector。
- [ ] 应用 lane offset。
- [ ] 输出 horse `x`。
- [ ] 输出 horse `y`。
- [ ] 输出 horse `rotation`。

## 27. 进度语义

- [ ] 定义 `overallProgress`。
- [ ] `overallProgress` 用于整体项目完成度。
- [ ] 定义 `roundProgress`。
- [ ] `roundProgress` 用于 Race Live View 赛马位置。
- [ ] 定义 `phaseProgress`。
- [ ] `phaseProgress` 用于阶段检查点。
- [ ] `phaseProgress` 用于局部进度。
- [ ] Jumbotron 子系统优先使用 `roundProgress` 作为赛道位置来源。
- [ ] 如果只有 `overallProgress`，必须显式标记为临时映射。

## 28. 动画状态机

- [ ] 动画状态机支持 `idle`。
- [ ] 动画状态机支持 `running`。
- [ ] 动画状态机支持 `sprinting`。
- [ ] 动画状态机支持 `slowed`。
- [ ] 动画状态机支持 `blocked`。
- [ ] 动画状态机支持 `pit_stop`。
- [ ] 动画状态机支持 `takeover`。
- [ ] 动画状态机支持 `finished`。
- [ ] 动画状态机支持 `stale`。
- [ ] 动画只接受 `RacingEntrySnapshot` 输入。
- [ ] 动画只接受 `RaceEvent` 输入。
- [ ] 动画不直接接受 UI 指令修改位置。

## 29. 补间策略

- [ ] 位置补间在 `s` 轴上进行。
- [ ] 位置补间不直接在 `x/y` 上进行。
- [ ] 从 `s0` 到 `s1`。
- [ ] 在 `s(t)` 处 sample pose。
- [ ] 避免弯道处马匹穿越赛道内侧。
- [ ] 数据更新慢时使用短时间补间。
- [ ] 数据更新慢时可以使用原地动效。
- [ ] 数据更新慢时可以使用气泡。
- [ ] 数据更新慢时可以使用高亮。
- [ ] 数据更新慢时不伪造连续推进。

## 30. stale 策略

- [ ] 检查每个 Racing Entry 的更新时间。
- [ ] 如果超过 stale threshold 没有更新，进入 `stale`。
- [ ] stale entry 停止前进。
- [ ] stale entry 降低亮度。
- [ ] stale entry 显示 stale。
- [ ] stale entry 显示 no recent update。
- [ ] stale entry 不再做 running 动画。
- [ ] Debug mode 显示 stale entries。

## 31. Riding Message 展示规则

- [ ] 同一条 Riding Message 可以展示为 track bubble。
- [ ] 同一条 Riding Message 可以展示在 bottom ticker。
- [ ] 同一条 Riding Message 可以展示为 risk alert item。
- [ ] Bubble 默认从 horse pose 开始计算。
- [ ] Bubble 使用 message zone lookup。
- [ ] Bubble 使用 bubble offset。
- [ ] Bubble 做 collision check。
- [ ] Bubble 输出 final bubble position。
- [ ] 如果没有合适位置，fallback 到底部 ticker。
- [ ] 每个 Racing Entry 同时最多 1 条 bubble。
- [ ] 全局同时最多 3 条 bubble。
- [ ] 风险消息优先展示。
- [ ] 里程碑消息优先展示。
- [ ] 普通消息进入 ticker。

## 32. Riding Message 气泡内容规则

- [ ] 气泡用于表达现场播报感。
- [ ] 气泡适合展示短句。
- [ ] 气泡适合展示里程碑。
- [ ] 气泡适合展示追赶。
- [ ] 气泡适合展示反超。
- [ ] 气泡适合展示守住名次。
- [ ] 气泡适合展示风险提示。
- [ ] 气泡适合展示阻碍提示。
- [ ] 气泡适合展示 Guidance。
- [ ] 气泡适合展示 Takeover。
- [ ] 气泡适合展示 Pit Stop 状态。
- [ ] 气泡不展示长文本评论。
- [ ] 气泡不展示完整日志。
- [ ] 气泡不展示复杂分析。
- [ ] 气泡不展示多段解释。

## 33. Bottom Ticker

- [ ] 底部 ticker 横向滚动最新注意事项。
- [ ] Ticker Item 包含 `category`。
- [ ] Ticker Item 包含 `severity`。
- [ ] Ticker Item 包含 `time`。
- [ ] Ticker Item 包含 `entryName`。
- [ ] Ticker Item 包含 `summary`。
- [ ] Ticker Item 包含 `status badge`。
- [ ] Ticker Item 包含 `targetUrl`。
- [ ] 点击风险项可进入详细风险列表。
- [ ] 点击风险项可进入对应 Remote Racing Cockpit。
- [ ] Ticker 展示 Risk Items。
- [ ] Ticker 展示 Obstacle Items。
- [ ] Ticker 展示 Violation Items。
- [ ] Ticker 展示 Recent Message Items。
- [ ] Ticker 提供 View More。

## 34. TOP3 规则

- [ ] TOP3 展示当前最强竞争焦点。
- [ ] TOP3 表达当前 Race Live View 的实时领先关系。
- [ ] TOP3 不扩展为独立看板。
- [ ] 每个 TOP3 Item 包含 rank。
- [ ] 每个 TOP3 Item 包含 entryName。
- [ ] 每个 TOP3 Item 包含 rider visual。
- [ ] 每个 TOP3 Item 包含 project visual。
- [ ] 每个 TOP3 Item 包含 time gap。
- [ ] 每个 TOP3 Item 包含 lead status。
- [ ] 每个 TOP3 Item 包含 current motion hint。
- [ ] 每个 TOP3 Item 包含 click target。

## 35. 核心交互

- [ ] 支持查看全局赛况。
- [ ] 观众通过 Race Live View 的赛道主视觉理解比赛推进状态。
- [ ] 支持查看实时领先者。
- [ ] 观众通过 TOP3 区快速识别当前领先关系。
- [ ] 观众通过 TOP3 区快速识别当前追赶关系。
- [ ] 支持查看项目位置。
- [ ] 观众通过 Racing Entry 位置理解相对进度。
- [ ] 观众通过排名编号理解相对进度。
- [ ] 观众通过项目名理解相对进度。
- [ ] 支持查看实时消息。
- [ ] 观众通过 Riding Message 气泡看到重点动态。
- [ ] 观众通过 ticker 看到重点动态。
- [ ] 支持查看风险。
- [ ] 组织者通过底部 ticker 识别需要介入的项目。
- [ ] 组织者通过赛道上的风险标记识别需要介入的项目。
- [ ] 支持进入单个项目。
- [ ] 组织者可从 Racing Entry 标记进入 Remote Racing Cockpit。
- [ ] 组织者可从 TOP3 Item 进入 Remote Racing Cockpit。
- [ ] 组织者可从 Riding Message 进入 Remote Racing Cockpit。
- [ ] 组织者可从 Risk Item 进入 Remote Racing Cockpit。
- [ ] 组织者可从 Obstacle Item 进入 Remote Racing Cockpit。
- [ ] 组织者可从 Violation Item 进入 Remote Racing Cockpit。

## 36. 主视觉规则

- [ ] 赛道主视觉承载视觉氛围。
- [ ] 赛道主视觉承载数据定位。
- [ ] 视觉氛围和数据定位必须解耦。
- [ ] 使用 Static Track Background。
- [ ] 使用 Semantic Track Geometry。
- [ ] 使用 Dynamic Racing Entry Layer。
- [ ] 使用 Message Overlay。
- [ ] 使用 Attention Overlay。
- [ ] 马匹不能写死在底图里。
- [ ] 编号不能写死在底图里。
- [ ] 气泡不能写死在底图里。
- [ ] 风险标记不能写死在底图里。
- [ ] 排名不能从图片中推断。
- [ ] 进度不能从图片中推断。
- [ ] 赛道位置由 `roundProgress` 映射到 `centerlinePath`。
- [ ] 气泡需要落在 safeZones 内。
- [ ] 标签需要落在 safeZones 内。
- [ ] 马匹需要落在 safeZones 内。
- [ ] 气泡需要经过避让计算。
- [ ] 标签需要经过避让计算。
- [ ] 马匹需要经过避让计算。
- [ ] 无新数据时只保留原地动效。
- [ ] 无新数据时进入 stale。
- [ ] 无新数据时不持续制造虚假推进。

## 37. Debug Mode

- [ ] Jumbotron Prototype 必须支持 debug mode。
- [ ] debug mode 用于验证资产。
- [ ] debug mode 用于验证运行时逻辑。
- [ ] debug mode 显示 centerline。
- [ ] debug mode 显示 sampled points。
- [ ] debug mode 显示 lane offsets。
- [ ] debug mode 显示 checkpoints。
- [ ] debug mode 显示 horse s value。
- [ ] debug mode 显示 collision boxes。
- [ ] debug mode 显示 stale entries。

## 38. Track Profile Calibrator 职责

- [ ] 实现 Track Profile Calibrator。
- [ ] Calibrator 导入赛道底图。
- [ ] Calibrator 创建候选 Track Profile。
- [ ] Calibrator 导入候选 Track Profile。
- [ ] Calibrator 编辑 centerline points。
- [ ] Calibrator 设置赛道方向。
- [ ] Calibrator 设置起点。
- [ ] Calibrator 设置终点。
- [ ] Calibrator 配置 lane offsets。
- [ ] Calibrator 配置 checkpoints。
- [ ] Calibrator 预览单马运行。
- [ ] Calibrator 预览多马运行。
- [ ] Calibrator 预览消息气泡。
- [ ] Calibrator 运行 validation。
- [ ] Calibrator 导出冻结后的 `track.profile.json`。

## 39. Track Profile Calibrator IA

- [ ] 实现 Top Toolbar。
- [ ] Top Toolbar 包含 Import Background。
- [ ] Top Toolbar 包含 Import Candidate Profile。
- [ ] Top Toolbar 包含 Validate。
- [ ] Top Toolbar 包含 Preview。
- [ ] Top Toolbar 包含 Export。
- [ ] 实现 Main Canvas。
- [ ] Main Canvas 包含 Background Layer。
- [ ] Main Canvas 包含 Centerline Layer。
- [ ] Main Canvas 包含 Control Points Layer。
- [ ] Main Canvas 包含 Lane Preview Layer。
- [ ] Main Canvas 包含 Checkpoint Layer。
- [ ] Main Canvas 包含 Horse Preview Layer。
- [ ] Main Canvas 包含 Message Bubble Preview Layer。
- [ ] 实现 Right Inspector。
- [ ] Right Inspector 包含 Track Info。
- [ ] Right Inspector 包含 Geometry。
- [ ] Right Inspector 包含 Start / Finish。
- [ ] Right Inspector 包含 Direction。
- [ ] Right Inspector 包含 Lanes。
- [ ] Right Inspector 包含 Checkpoints。
- [ ] Right Inspector 包含 Message Bubble。
- [ ] Right Inspector 包含 Validation Results。
- [ ] 实现 Bottom Preview Bar。
- [ ] Bottom Preview Bar 包含 Progress Scrubber。
- [ ] Bottom Preview Bar 包含 Horse Count。
- [ ] Bottom Preview Bar 包含 Speed。
- [ ] Bottom Preview Bar 包含 Play / Pause。
- [ ] Bottom Preview Bar 包含 Scenario Presets。

## 40. Calibrator MVP 功能

- [ ] 支持导入底图。
- [ ] 支持加载 Track Profile。
- [ ] 支持创建 Track Profile。
- [ ] 支持添加 centerline points。
- [ ] 支持删除 centerline points。
- [ ] 支持拖拽 centerline points。
- [ ] 支持平滑路径预览。
- [ ] 支持闭合路径。
- [ ] 支持一键反转路径方向。
- [ ] 支持设置起点。
- [ ] 支持配置 lane offsets。
- [ ] 支持配置 checkpoints。
- [ ] 支持通过 scrubber 预览一匹马从 0% 到 100%。
- [ ] 支持预览多匹马。
- [ ] 支持 Validate。
- [ ] 支持 Export JSON。

## 41. Calibrator P1 功能

- [ ] 支持气泡区域编辑。
- [ ] 支持 no bubble zone 编辑。
- [ ] 支持风险区域编辑。
- [ ] 支持 AI 候选点导入。
- [ ] 支持自动检测尖角。
- [ ] 支持自动分配 lanes。
- [ ] 支持导出 debug-preview.png。
- [ ] 支持 JSON diff preview。

## 42. Jumbotron Adapter

- [ ] 实现 Jumbotron Adapter。
- [ ] Adapter 输入 `RaceSnapshot`。
- [ ] `RaceSnapshot` 包含 competition metadata。
- [ ] `RaceSnapshot` 包含 KPI summary。
- [ ] `RaceSnapshot` 包含 racing entries。
- [ ] `RaceSnapshot` 包含 recent messages。
- [ ] `RaceSnapshot` 包含 risks。
- [ ] `RaceSnapshot` 包含 violations。
- [ ] Adapter 输出 `RacingEntrySnapshot[]`。
- [ ] Adapter 输出 `RidingMessageSnapshot[]`。
- [ ] Adapter 输出 `AttentionItem[]`。
- [ ] Adapter 选择用于赛道位置的进度字段。
- [ ] Adapter 默认使用 `roundProgress`。
- [ ] Adapter 在只有 `overallProgress` 时显式标记临时映射。
- [ ] Adapter 映射 CA provider。
- [ ] Adapter 映射风险状态。
- [ ] Adapter 分配 lane。
- [ ] Adapter 处理缺失数据。
- [ ] Adapter 处理 stale。
- [ ] Adapter 提取 Riding Message。

## 43. AI-assisted Asset Pipeline

- [ ] 明确 AI 不参与运行时可信计算。
- [ ] 明确 AI 只参与设计时候选资产生产。
- [ ] 编写赛道视觉 prompt。
- [ ] AI 生成 16:9 赛道底图。
- [ ] AI 输出候选 centerline points。
- [ ] 导入 Calibrator。
- [ ] 人工校准路径。
- [ ] 预览多马运行。
- [ ] Validate。
- [ ] Export。
- [ ] 提交资产。

## 44. 资产目录规范

- [ ] 建立 `assets/tracks/<track-id>/`。
- [ ] 每条赛道资产包含 `background.webp`。
- [ ] 每条赛道资产包含 `track.profile.json`。
- [ ] 每条赛道资产包含 `preview.png`。
- [ ] 每条赛道资产包含 `notes.md`。
- [ ] 每条赛道资产包含 `source.prompt.md`。
- [ ] `background.webp` 保存最终视觉底图。
- [ ] `track.profile.json` 保存运行时事实来源。
- [ ] `preview.png` 保存带 overlay 的预览图。
- [ ] `notes.md` 保存人工校准说明。
- [ ] `source.prompt.md` 保存 AI 生成提示词。
- [ ] `source.prompt.md` 保存生成过程记录。

## 45. 资产冻结规则

- [ ] track asset 进入 DCR 前必须通过 schema validation。
- [ ] track asset 进入 DCR 前必须通过 geometry validation。
- [ ] track asset 进入 DCR 前必须通过 0% 到 100% 单马预览。
- [ ] track asset 进入 DCR 前必须通过至少 8 匹马多马预览。
- [ ] track asset 进入 DCR 前必须没有明显跑出赛道。
- [ ] track asset 进入 DCR 前必须 checkpoint 显示正确。
- [ ] track asset 进入 DCR 前必须在 16:9 大屏下视觉稳定。
- [ ] track asset 进入 DCR 前必须 profile 与 background 一起提交。

## 46. Track Profile Validation

- [ ] 校验 `schemaVersion` 存在。
- [ ] 校验 `trackId` 存在。
- [ ] 校验 `viewBox` 合法。
- [ ] 校验 `background` 存在。
- [ ] 校验 centerline points 数量足够。
- [ ] 校验 closed track 至少 4 个点。
- [ ] 校验 open track 至少 2 个点。
- [ ] 校验 `direction` 合法。
- [ ] 校验 `startFinish.s` 在 0 到 1 范围内。
- [ ] 校验 `checkpoints.s` 均在 0 到 1 范围内。
- [ ] 校验 lanes 至少 1 条。
- [ ] 校验 lane offsets 不重复。
- [ ] 校验 path length 大于最小阈值。
- [ ] 校验 sampled path 无 NaN。
- [ ] 校验 sampled path 无 Infinity。
- [ ] 校验相邻采样点距离无异常跳变。
- [ ] 曲率超过阈值时给 warning。
- [ ] 转角超过阈值时给 warning。

## 47. Runtime Validation

- [ ] 防御 progress 小于 0。
- [ ] 防御 progress 大于 1。
- [ ] 防御 laneId 不存在。
- [ ] 防御 entry 没有 updatedAt。
- [ ] 防御 stale threshold 触发。
- [ ] 防御 profile 版本不匹配。
- [ ] 防御 background 加载失败。

## 48. Visual Validation

- [ ] 人工确认马是否跑在赛道上。
- [ ] 人工确认弯道处是否自然。
- [ ] 人工确认多马是否严重重叠。
- [ ] 人工确认气泡是否遮挡标题。
- [ ] 人工确认气泡是否遮挡 KPI。
- [ ] 人工确认气泡是否遮挡顶部区域。
- [ ] 人工确认 checkpoint 是否符合视觉语义。

## 49. 工程边界 DCR 主项目 owns

- [ ] DCR 主项目负责 real data source。
- [ ] DCR 主项目负责 Jumbotron orchestration。
- [ ] DCR 主项目负责 permissions。
- [ ] DCR 主项目负责 room。
- [ ] DCR 主项目负责 workshop context。
- [ ] DCR 主项目负责 ranking semantics。
- [ ] DCR 主项目负责 business events。

## 50. 工程边界 Jumbotron 子系统 owns

- [ ] Jumbotron 子系统负责 track profile。
- [ ] Jumbotron 子系统负责 path sampling。
- [ ] Jumbotron 子系统负责 horse pose。
- [ ] Jumbotron 子系统负责 animation states。
- [ ] Jumbotron 子系统负责 visual race rendering。
- [ ] Jumbotron 子系统负责 calibrator tooling。
- [ ] Jumbotron 子系统负责 asset validation。
- [ ] Jumbotron 子系统负责 Jumbotron adapter contract。

## 51. 推荐工程结构

- [ ] 建立 `apps/track-calibrator/`。
- [ ] 建立 `apps/race-preview/`。
- [ ] 建立 `packages/track-profile/`。
- [ ] 建立 `packages/track-runtime/`。
- [ ] 建立 `packages/mock-racing-data/`。
- [ ] 建立 `packages/ui-primitives/`。
- [ ] 建立 `assets/tracks/`。
- [ ] 在 `assets/tracks/<track-id>/` 放 `background.webp`。
- [ ] 在 `assets/tracks/<track-id>/` 放 `track.profile.json`。
- [ ] 在 `assets/tracks/<track-id>/` 放 `preview.png`。
- [ ] 在 `assets/tracks/<track-id>/` 放 `notes.md`。
- [ ] 建立 `docs/track-profile-spec.md`。
- [ ] 建立 `docs/calibrator-design.md`。
- [ ] 建立 `docs/dcr-handoff.md`。
- [ ] 建立 `docs/asset-pipeline.md`。

## 52. MVP 验收口径

- [ ] `track.profile.json` 能描述一条完整赛道。
- [ ] Calibrator 能从候选路径微调出可用赛道。
- [ ] Calibrator 导出的 profile 能被 Jumbotron Preview 直接使用。
- [ ] Calibrator 和 Jumbotron Preview 使用同一套 `track-runtime`。
- [ ] 一匹马可按 0% 到 100% 沿赛道移动。
- [ ] 多匹马可通过 lane offset 同时展示。
- [ ] 马匹在弯道处方向自然。
- [ ] stale 状态可表达。
- [ ] blocked 状态可表达。
- [ ] pit_stop 状态可表达。
- [ ] takeover 状态可表达。
- [ ] finished 状态可表达。
- [ ] Riding Message 可在气泡中降噪展示。
- [ ] Riding Message 可在 ticker 中降噪展示。
- [ ] 至少有 2 条可用示例赛道资产。
- [ ] DCR `RaceSnapshot` 能通过 Adapter 映射到 runtime 输入。

## 53. MVP 信息层级 P0

- [ ] LIVE 状态必须可见。
- [ ] 当前 Round 必须可见。
- [ ] 当前阶段必须可见。
- [ ] 已用时必须可见。
- [ ] Race Live 主赛道必须可见。
- [ ] Racing Entry 位置必须可见。
- [ ] Racing Entry 排名必须可见。
- [ ] TOP3 必须可见。
- [ ] 风险提醒必须可见。
- [ ] 阻碍提醒必须可见。
- [ ] 违规提醒必须可见。

## 54. MVP 信息层级 P1

- [ ] 完成度应该可见。
- [ ] 总 Tokens 应该可见。
- [ ] Codex 使用应该可见。
- [ ] Claude 使用应该可见。
- [ ] 在线骑手应该可见。
- [ ] 活跃骑手应该可见。
- [ ] Riding Message 应该可见。
- [ ] Footer 状态应该可见。

## 55. MVP 信息层级 P2

- [ ] 可以增强更复杂的赛马动效。
- [ ] 可以增强气泡避让优化。
- [ ] 可以增强详细风险 Drill Down。

## 56. 高保真对象到 IA 对象映射

- [ ] `DevCompass Racing` 标题映射到 Brand。
- [ ] `DevCompass Racing` 标题映射到 Competition Title。
- [ ] `Workshop / Hackathon Live Screen` 映射到 Competition Subtitle。
- [ ] `赛事直播中` 映射到 LIVE Status。
- [ ] `ROUND 3` 映射到 Current Round。
- [ ] `已用时` 映射到 Elapsed Time。
- [ ] `在线选手 24/36` 映射到 Online Riders。
- [ ] `实时 TOP3` 映射到 Real-time TOP3。
- [ ] TOP3 马匹卡片映射到 Ranking Item。
- [ ] TOP3 马匹卡片映射到 Racing Entry。
- [ ] `完成度 68%` 映射到 Completion Rate KPI。
- [ ] `总 Tokens` 映射到 Total Tokens KPI。
- [ ] `Codex / Claude 参与` 映射到 CA Usage KPI。
- [ ] 赛道地图映射到 Track Stage。
- [ ] 赛道底图映射到 Track Template.backgroundAsset。
- [ ] 赛道路径映射到 Track Template.centerlinePath。
- [ ] 马匹与编号映射到 Racing Entry Marker。
- [ ] 气泡消息映射到 Riding Message Bubble。
- [ ] 左侧小地图映射到 Track Mini Map。
- [ ] 项目颜色图例映射到 Entry Legend。
- [ ] 风险与违章底栏映射到 Attention Ticker。
- [ ] 查看更多映射到 View More。
- [ ] 查看更多映射到 Drill Down。
- [ ] 底部赛事主题映射到 Theme。
- [ ] 主办方映射到 Organizer。
- [ ] 下一阶段映射到 Next Phase。
- [ ] 系统时间映射到 System Time。

## 57. 运行与验证准备

- [ ] 准备本地启动命令。
- [ ] 准备 Jumbotron Preview 启动命令。
- [ ] 准备 Track Calibrator 启动命令。
- [ ] 准备自动验证脚本。
- [ ] 验证 `track.profile.json` schema。
- [ ] 验证 path sampling。
- [ ] 验证 lane offset。
- [ ] 验证 horse pose。
- [ ] 验证 adapter mapping。
- [ ] 验证 debug mode。
- [ ] 验证 stale 状态。
- [ ] 验证 blocked 状态。
- [ ] 验证 pit_stop 状态。
- [ ] 验证 takeover 状态。
- [ ] 验证 finished 状态。
- [ ] 验证 bubble 降噪。
- [ ] 验证 ticker 展示。
- [ ] 验证至少 2 条示例赛道资产。
- [ ] 验证不展示完整 Session。
- [ ] 验证不展示完整日志。
- [ ] 验证不从图片推断排名。
- [ ] 验证不从图片推断进度。
- [ ] 验证不手写马匹 `x/y` 作为业务事实。

## 58. 文档交付

- [ ] 编写第二周 README。
- [ ] README 索引两份核心源文档。
- [ ] README 索引完整代办清单。
- [ ] README 索引关键路径可视化页面。
- [ ] 根 `提交说明.md` 索引第二周入口、代办清单、可视化页面和两份源文档。
- [ ] README 说明如何启动 Jumbotron Preview。
- [ ] README 说明如何启动 Track Calibrator。
- [ ] README 说明如何运行验证。
- [ ] README 说明核心证明点。
- [ ] README 说明工程边界。
- [ ] 编写 `track-profile-spec.md`。
- [ ] 编写 `calibrator-design.md`。
- [ ] 编写 `dcr-handoff.md`。
- [ ] 编写 `asset-pipeline.md`。
- [ ] 编写过程记录。
- [ ] 过程记录包含 Prompt。
- [ ] 过程记录包含 Agent output。
- [ ] 过程记录包含 Steering。
- [ ] 过程记录包含 problem solving。
- [ ] 过程记录包含 validation。

## 59. 提交与推送

- [ ] 提交前运行验证。
- [ ] 提交前检查 `git status --short`。
- [ ] 提交前检查不包含 `node_modules/`。
- [ ] 提交前检查不包含 `dist/`。
- [ ] 提交前检查不包含临时文件。
- [ ] 提交前确认第一周提交包没有被破坏。
- [ ] 提交前确认 `Docs/` 保留。
- [ ] 提交前确认 `Knowledge/` 保留。
- [ ] 提交前确认第二周内容在独立目录中。
- [ ] 创建提交。
- [ ] 推送远端。
- [ ] 推送后确认远端分支最新提交。
- [ ] 推送后向用户报告 commit hash。
- [ ] 推送后向用户报告验证结果。
