# session 11：最终 PRD 一致性蜂群审阅

## Agent Riding Skill 证据摘要

- Plan：先不改 PRD 主稿，先让蜂群按评分标准、最终 PoC、Knowledge 口径和反方挑刺四个视角审阅。
- Observation：多个视角共同指出 §7 与最终 PoC 路径不一致，沙箱和排队能力写得像已实现，Riding Record 集中存储口径过强。
- Steering：用户决定先处理非 PoC 口径，PoC 路径放到最后统一看；Agent 按这个顺序降级强承诺并修正去中心化 Riding Record 表述。
- Validation：修改后检查 PRD 是否保留“完整历史在 Rider 本地，ARY 接收摘要/关键事件/授权片段”的口径，并避免把未验证能力写成已实现。
- Review：本轮体现了提交前的复盘能力：不让 Agent 直接改稿，而是先形成审阅报告，再按用户确认的优先级推进。

## 背景

用户要求基于作业评审标准、当前提交 README、ARY 知识库和蜂群反思，自主审阅当前 PRD。

约束很明确：

- 先不修改 PRD 主稿。
- 审阅结果要经过蜂群和知识库联合讨论。
- 审阅结果落成本地文档。
- 审阅充分后再与用户讨论。

审阅对象：

`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md`

## 输入材料

- 作业评审标准：`/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/README.original.md`
- 当前提交说明：`/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/README.md`
- PoC 表述更新清单：`/media/lemonhdl/Shared/Software_Engineering/ARY/Docs/prd-poc-final-version-update-checklist.md`
- PRD 与数据流图记录：`/media/lemonhdl/Shared/Software_Engineering/ARY/coding-agent-sessions/session-06-prd-data-flow-boundary-review.md`
- ARY Knowledge 关键材料：
  - `0603小组线下讨论内容分析.md`
  - `prd-内外边界与角色分析方法.md`
  - `poc-范围与演示策略.md`
  - `riding-record-去中心化设计.md`
  - `非功能需求.md`

## 蜂群分工

本轮没有让单个 Agent 给出结论，而是拆成四个审阅视角：

1. 评分标准对齐审阅
   - 检查 PRD 是否满足 README.original.md 的硬性门槛、评分项和一票否决项。

2. 最终 PoC 一致性审阅
   - 对比 README.md 的最终运行路径、演示路径、验证命令和 PRD 中的 PoC 表述。

3. Knowledge 口径审阅
   - 检查 PRD 是否违背知识库中关于数据主权、PoC 边界、Riding Record 去中心化和非 OJ 化的口径。

4. 反方挑刺审阅
   - 从严格评审视角找概念空泛、承诺过强、证明链不闭合和表达不稳。

## 主要发现

### 1. PRD 方向成立，但最终 PoC 事实没有同步

当前 PRD 的核心命题、角色、用户价值、权限矩阵和数据流图是成立的。

最大风险集中在 §7：

- PRD 写旧页面：`/`、`/records`、`/records/record-session-02`、`/replay/record-session-02`、`/evidence`。
- 当前提交 README 写最终路径：`/yard`、`/race/grs-001`、`/organizer`、`/team/submit`、`/team/records`、`/leaderboard`。
- PRD 验证输出也和 README 不一致。

这会直接影响评审对 PoC 可信度的判断。

### 2. 沙箱和排队能力写得过像已实现

PRD 多处写“沙箱验证 + 排队转发”“检查死循环、病毒、硬 bug”。

这可以作为正式系统目标，但当前 README 的可运行版本主要证明 Public Yard / Private Race Source 的最小链路。若不降级表述，会被认为把未实现能力包装成已实现能力。

### 3. Riding Record 需要去中心化口径

知识库强调完整 session 原文默认留在 Rider 本地。ARY 接收的是摘要、关键事件、授权片段或公开投影。

PRD 中“Riding Record 存储与回放”“自动抓取”“数据库、对象存储”等表述，需要避免被理解为 ARY 默认集中保存完整协作原文。

### 4. Agent Riding Skill 需要证据样例

PRD 已经强调 Agent Riding Skill，但证据链还偏抽象。根据评审标准，Riding Plan、任务拆解、人工判断、干预、修正、验收过程都是得分点。

建议后续在 PRD 中加一个短样例摘要，而不是放完整日志。

## 产出文档

审阅报告已落地：

`/media/lemonhdl/Shared/Software_Engineering/ARY/Docs/prd-readme-knowledge-swarm-review.md`

报告包含：

- 审阅依据
- 蜂群分工
- 总体判断
- P0 / P1 / P2 问题
- 已做得较好的部分
- 蜂群反思共同结论
- 下一轮修改顺序
- 需要与用户讨论的决策项

## 本轮 Steering

本轮关键 steering 是不急着直接改 PRD，而是先把审阅结果独立落文档。这样保留了用户要求的“仅审阅”边界，也方便后续按用户确认逐项修改。

## 下一步

建议与用户讨论以下决策：

1. §7 是否完全按当前 `ary-grs-001-sinbawang/README.md` 重写。
2. 沙箱、排队、代码安全检查是否放到“后续演进”。
3. Riding Record 是否明确采用“本地完整历史 + ARY 授权投影”。
4. PRD 是否加入一段 Riding Skill 样例摘要。
5. `数据安全保障承诺` 是否改成更稳的产品定义表达。

## 追加记录：先处理非 PoC 口径

用户决定先处理审阅报告中的 1、2、4、5，PoC 相关内容放到最后统一看。

本轮已修改 PRD 主稿，但没有重写 §7 的页面路径和最终演示脚本。

已处理内容：

1. Riding Record 去中心化口径
   - 将平台职责从默认“存储完整 Riding Record / 自动抓取完整日志”改为接收 Record 摘要、关键事件、授权片段和公开投影。
   - 明确完整协作原文、完整 session 默认留在 Rider 或队伍本地。
   - 在 §6.1 数据分类中拆出 `Rider 本地素材`。

2. 沙箱、排队、代码安全检查边界
   - 将“沙箱验证 + 排队转发”从本次已实现能力降级为正式系统目标。
   - 本次 PRD 只写提交方案触发 Organizer 侧评测；生产形态中可加入假数据沙箱、基础执行检查和队列。
   - 删除“病毒、硬 bug、必须经过沙箱”等强实现口径。

3. 过强表达
   - 将“代码已经平权”改为“代码生成门槛正在降低”。
   - 将“数据安全保障承诺”改为“围绕数据主权边界设计”。
   - 将“完整覆盖创建→披露→组织→展示”降级为“最小链路覆盖”。
   - 删除“1秒消失”等无法由当前 README 验证的强承诺。
   - 将“满分答案”改为“示例方案”。

4. 术语统一
   - 补充 Rider 对应评审标准中的 Participant。
   - 统一使用 Race 源数据、公开披露数据、授权摘要、公开投影、受控数据、Rider 本地素材等表达。

同步更新：

- `ARY/Docs/prd-poc-final-version-update-checklist.md` 已标注这些非 PoC 口径已先收紧。

仍未处理：

- §7 关键技术 PoC 的最终页面路径、运行命令、验证输出、演示脚本。
- §2.6、§6.4、§8、§9、§10 中仍与最终 PoC 事实相关的内容，等待最后统一处理。

## 追加记录：Agent Riding Skill 按 PRD 产品需求表达

用户提醒当前写的是 PRD，不是 session 记录文档。Agent Riding Skill 相关内容必须在理解 PRD 内涵的前提下，基于 README.original.md 的评分要求，表达为产品能力、用例和验收口径。

本轮修改 PRD：

- 将 UC-R3 的“协同全记录”改为“过程证据”，避免暗示完整原文默认上传。
- 在 UC-R3 展开中新增 Agent Riding Skill 的产品化证据结构：Plan、Observation、Steering、Validation、Reflection。
- 将 Rider 功能需求改为 ARY 要承接的产品能力：组织目标、约束、任务拆解、验收标准，管理 Rider 选择后的关键事件。
- 将验收标准从“覆盖 9 项 Agent Riding Skill / 检查原始输出”改为评估 Riding Record 是否能证明计划、观察、干预、验证和复盘。
- 将风险应对从“完整记录人-Agent 分工”改为“不要只展示最终提交物，要设计过程证据”。

本轮原则：

- PRD 不罗列具体 session。
- session 记录作为提交材料和证据来源存在，但 PRD 正文只说明产品如何承接、组织和展示 Agent Riding Skill。

## 追加记录：同步本地 PRD 到飞书文档

用户提供飞书文档链接和 Document ID，要求更新对应飞书文档。

同步目标：

- `https://jcnboj5dg0t7.feishu.cn/docx/YJO8duPcKow8N6xg8E3cNStTn9f`
- Document ID：`YJO8duPcKow8N6xg8E3cNStTn9f`

执行结果：

- 使用本地 `ARY/ary-grs-001-prd.md` 作为源稿。
- 通过 `lark-cli --profile feishu-alt docs +update --api-version v2 --command overwrite --doc-format markdown` 覆盖飞书正文。
- 本地相对图片引用不能直接被飞书读取，因此正文中保留图片说明，并通过 `docs +media-insert` 将 `ARY/Docs/images/ary-data-flow-boundary.png` 作为图片块插入文档末尾。
- 已用 `docs +fetch` 检查 Agent Riding Skill 证据结构和数据流图说明段落，确认飞书文档已更新到 revision 11。

注意：

- lark-cli 提示当前版本 1.0.45，可更新到 1.0.48。

