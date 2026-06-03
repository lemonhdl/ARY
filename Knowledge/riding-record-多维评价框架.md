# Riding Record 多维评价框架

## 参考来源

ARY 的 Riding Record 多维评价可以参考几次软件工程作业中的 codex-review 和 Agentic Development 过程文档。

本地已找到：

- `/media/lemonhdl/Shared/Software_Engineering/oo-sinbawang/codex-review.md`
- `/media/lemonhdl/Shared/Software_Engineering/con-oo-sinbawang/codex-review.md`
- `/media/lemonhdl/Shared/Software_Engineering/ad-sinbawang/AGENTIC.md`
- `/media/lemonhdl/Shared/Software_Engineering/ad-sinbawang/AGENTS.md`

其中 `ad-sinbawang` 当前没有发现 `codex-review.md`，但它的 `AGENTIC.md` 和 `AGENTS.md` 对 Agentic Development 的评价维度很有参考价值。

这些材料的共同特点是：评价不是只看最终结果，而是同时看对象边界、业务规则、接入质量、验证证据、过程控制和文档收口。这与 ARY 的 Riding Record 评价目标一致。

## 评价目标

ARY 的多维评价不应只是给 Riding Record 一个总分。

更合适的做法是评价一次 Agent Riding 是否体现了：

- 目标是否清楚
- 人和 Agent 的分工是否合理
- Agent 是否真的被用于推进任务
- Rider 是否有效 Steering
- 结果是否经过验证
- 过程是否可复盘
- 数据边界是否清楚
- 交付物是否可运行、可点击、可解释

也就是说，评价对象不是单个提交结果，而是一次人机协作过程。

## 可迁移的评价维度

### 1. 目标与边界

参考 `ad-sinbawang/AGENTIC.md` 和 `AGENTS.md`。

评价问题：

- Rider 是否先固定任务目标
- 是否明确哪些事情不做
- 是否限制 Agent 不要扩大范围
- 是否说明验收方式
- 是否保护已有设计边界

对应到 ARY：

一次好的 Riding Record 应该能看出 Rider 如何设定目标、约束范围，并把 Agent 拉回任务主线。

### 2. 领域建模与职责边界

参考 `oo-sinbawang/codex-review.md` 和 `con-oo-sinbawang/codex-review.md`。

codex-review 不是只看代码能不能运行，而是看：

- 核心规则是否沉淀在正确对象中
- 是否出现并行真相源
- UI 是否越权承担业务规则
- 适配层是否清楚
- 序列化契约是否稳定

对应到 ARY：

Riding Record 可以评价 Agent 产出是否尊重系统边界。比如它有没有把规则写到错误层级，有没有绕过已有架构，有没有制造难维护的隐性状态。

### 3. Agent 使用质量

参考 `ad-sinbawang/AGENTIC.md`。

评价问题：

- Agent 是否用于适合它的工作
- Rider 是否把结构清楚、可验证的任务交给 Agent
- Agent 是否承担了调研、实现、测试、文档、复核等工作
- 人类是否保留方向、边界和最终判断

对应到 ARY：

不是调用 Agent 越多越好。好的 Agent Riding 应体现人类把 Agent 用在合适位置，并持续检查它的输出。

### 4. Steering 质量

参考几次作业中的纠偏过程。

评价问题：

- Rider 是否发现 Agent 跑偏
- 是否给出清楚的纠偏指令
- 是否说明为什么要收窄或调整方向
- 纠偏后 Agent 是否真正改变方案
- 是否把纠偏结果固化为测试、文档或规则

对应到 ARY：

Steering 是 Riding Record 的核心。评价时应重点看人类如何介入，而不是只看 Agent 最终写了多少内容。

### 5. 验证与证据

参考 `con-oo-sinbawang/codex-review.md` 的补充说明和 `ad-sinbawang/AGENTIC.md` 的验收部分。

评价问题：

- 是否有测试、构建、smoke test 或人工点击验证
- 验证是否覆盖关键流程
- 是否区分静态阅读和实际运行
- 是否把发现的问题进入后续验收
- 是否避免只凭口头说明证明结果

对应到 ARY：

Riding Record 的评价应记录验证动作和验证结果。没有证据的成功结论，不能和有测试、有页面检查、有复核的问题解决过程同等评价。

### 6. 可回放性

参考 `ad-sinbawang/AGENTIC.md` 中 Prompt、Agent output、Steering、Result 的过程结构。

评价问题：

- 过程是否能按阶段回放
- 每一轮是否有输入、输出、纠偏和结果
- 评审是否能看懂任务如何推进
- 是否只留下最终答案而缺少中间决策

对应到 ARY：

可回放性是 Riding Record 区别于普通提交记录的关键。平台不一定展示完整原文，但要能展示关键事件和决策链。

### 7. 交付质量

参考几次作业 review 对可运行、接入真实 UI、文档贴合作业的关注。

评价问题：

- 产物是否真实接入主流程
- 是否只是测试里可用，还是页面里也可用
- 文档是否直接回答任务
- 是否保留临时文件、无关改动或调试信息
- 是否能被他人复现

对应到 ARY：

Agent Riding 的结果必须落到可交付产物。只有过程漂亮但最终不可运行，也不应得到高评价。

### 8. 数据边界与可公开性

结合 ARY 当前 PoC 的数据安全主线。

评价问题：

- Riding Record 是否区分完整记录和公开投影
- 是否避免泄露未公开材料
- 是否说明哪些字段可公开
- 是否支持本地评价或授权后投影
- 是否避免把平台设计成默认集中留存完整记录

对应到 ARY：

这部分是 ARY 相比普通代码 review 的新增维度。Riding Record 既要可评价，也要尊重用户和组织方的数据控制权。

## 建议评价结构

可以先采用八个维度：

| 维度 | 关注点 |
| --- | --- |
| 目标与边界 | 任务目标、范围控制、约束清晰度 |
| 领域与架构 | 职责划分、系统边界、契约稳定性 |
| Agent 使用 | 任务分配是否适合 Agent，是否有效利用 Agent |
| Steering | 人类纠偏、收窄、判断和约束能力 |
| 验证证据 | 测试、构建、smoke test、人工验证和复核 |
| 可回放性 | 是否能还原关键阶段、事件和决策链 |
| 交付质量 | 产物是否可运行、可点击、可复现、文档是否收口 |
| 数据边界 | 完整记录、本地服务、授权投影、公开字段控制 |

每个维度可以给出等级，例如：

- excellent
- good
- fair
- poor

也可以给出结构化评语：

- 优点
- 问题
- 严重程度
- 证据位置
- 改进建议

这种形式与 codex-review 的风格一致，也适合 ARY 后续做多维评价展示。

## 与去中心化 Riding Record 的关系

多维评价不要求平台持有完整 Riding Record。

更合适的流程是：

1. 用户本地保存完整 Riding Record
2. 本地服务按 ARY 数据结构读取记录
3. 本地服务生成评价所需摘要和证据投影
4. 平台或评审端基于授权投影生成多维评价
5. 平台展示评分、评语和可回放过程

这样既能保留评价深度，也不要求用户把完整过程长期交给平台。

## 后续可设计的对象

后续系统建模时，可以考虑这些对象：

- `RidingRecord`
- `RidingEvent`
- `RidingProjection`
- `EvaluationDimension`
- `EvaluationEvidence`
- `EvaluationResult`
- `ReplayTimeline`
- `DisclosurePolicy`
- `LocalRecordService`

这些对象不应现在就写死，但可以作为后续系统建模的起点。
