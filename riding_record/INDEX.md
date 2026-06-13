# coding agent sessions

这个目录记录 ARY 项目与 Claude Code 协作过程，用于呈现 Agent Riding Skill 和后续回放。

命名规则：`session-编号-中心事件.md`。编号按 Riding 逻辑顺序排列，不完全按自然时间排列。文件名描述本轮 Riding 的主要事件，不使用队员姓名或分支来源作为命名依据。

## Session 列表

- [session 01](session-01-harness-recording-protocol.md)：Harness 搭建、飞书资料读取、记录规范和执行优先级设定
- [session 02](session-02-project-scope-knowledge-base.md)：项目范围识别、资料落盘、PRD 边界和知识库建立
- [session 03](session-03-nonfunctional-data-boundary-review.md)：非功能需求拆解、数据主权边界、展示约束和知识库沉淀
- [session 04](session-04-organizer-use-cases-data-types.md)：Organizer 视角用例、功能需求、数据类型和编号对齐
- [session 05](session-05-prd-merge-scoring-alignment.md)：分工 PRD 合并、评审标准对齐、数据安全主线和记录粒度纠偏
- [session 06](session-06-prd-data-flow-boundary-review.md)：提交版 PRD 审阅、概念口径修订、权限矩阵和数据流图插入
- [session 07](session-07-data-boundary-poc-validation.md)：数据边界 PoC 构建、独立复核、公开存储纠偏和自动验收
- [session 08](session-08-role-login-team-isolation.md)：登录分流、组织方视图、队伍隔离和越权访问验证
- [session 09](session-09-rider-history-devcompass-replay.md)：Rider 历史、DevCompass 回放记录、本地素材边界和开源模式调研
- [session 10](session-10-public-yard-private-source-restructure.md)：按 GRS001 评分标准重构 Public Yard / Private Race Source 主证明链
- [session 11](session-11-final-prd-swarm-consistency-review.md)：最终 PRD、README、Knowledge 和蜂群反思的一致性审阅
- [session 11-week2](session-11-week2-jumbotron-framework.md)：Week2 Jumbotron 框架、Race Live View、Calibrator、资产接入、轨道重校准和左右朝向收敛
- [session 12](session-12-week2-jumbotron-mock-data.md)：Week2 Jumbotron mock-data 迁入、timeline replay、主视觉比例、几何隐藏和底栏工具栏收敛

## 辅助素材

- [UI visual prompts](artifact-ui-visual-prompts.md)：视觉素材 Steering 记录。它不属于独立 Riding session，但体现了 Rider 对图像 Agent 的约束输入：不生成文字、路径、代码、账号、真实人物或隐私信息，只增强 PoC 的观众引导能力，不改变证明链。

## 为什么这样排序

这组记录的目标是展示 Agent Riding Skill，因此优先按能力展开顺序排列：先建立 Harness 和记录规则，再理解项目命题，然后完成分工文档与 PRD 合并，接着用 PoC 验证数据安全主线，最后做提交前一致性审阅。

## Agent Riding Skill 对应

| 能力 | 代表 session | 证据 |
| --- | --- | --- |
| Harness 与记录规范 | session 01 | 建立记录路径、Prompt / Agent Answer / Steering 结构；发现未自动更新记录后立即补录。 |
| 任务理解和边界设定 | session 02、05、06 | 将 GRS001 从普通赛事平台收敛为数据安全 Race；PRD 修改前先审阅、列风险、由用户确认改动范围。 |
| 需求拆解和分工协作 | session 03、04、05 | 非功能需求从数据主权开始拆；Organizer 用例按 UC / FR / 数据类型对齐；分工 PRD 合并前先对标评分标准。 |
| Agent 输出观察 | session 04、06、07、09、11 | 识别误写 PRD、绝对化表述、公开存储泄漏题解、回放记录过于抽象、PRD 与最终 PoC 不一致。 |
| Steering 与纠偏 | session 01、04、05、06、07、10 | 设置飞书只读边界、控制用例扩张、阻止跳过 Plan、修正 PRD 口径、将 PoC 从 OJ 表达拉回数据边界证明。 |
| 验证与验收 | session 07、08、09、10、11 | 自动验收公开存储、队伍隔离、提交解锁、Replay、异常状态；提交前用蜂群复核 PRD 与 README / Knowledge 一致性。 |
| 复盘与提交整理 | session 05、06、10、11 | 修正 Riding Record 粒度；保留待确认问题；把最终 PoC 与 PRD 风险整理成审阅报告。 |
