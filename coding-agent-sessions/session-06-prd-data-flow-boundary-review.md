# session 06：PRD 数据流与边界审阅

## Agent Riding Skill 证据摘要

- Plan：先读提交版 PRD 基础稿并列风险清单，等用户确认哪些问题可直接改，再进入文档修改。
- Observation：绝对化表达会造成自相矛盾，例如“所有数据经 ARY”会削弱“真实数据不离开 Organizer”的核心证明。
- Steering：用户指定只改部分问题、去掉“披露”问题、逐句修正 PRD 文案，并要求图片术语降承诺后再加入 PRD。
- Validation：修改后重新列出剩余问题，数据流图经第一版审阅和第二版确认后才落地，并同步更新章节编号。
- Review：本轮没有把 PRD 宣称为完成态，而是保留 PoC 页面路径和五页面证明点等待确认项，体现了不伪装完成的验收意识。

## 背景

本轮工作的对象是 ARY 后续提交用的 PRD 基础稿：

`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md`

用户从微信临时文件提供 `ary-grs-001-prd.md`，要求放到 ARY 目录，并明确后续提交版 PRD 以此为基础。随后进入逐句审阅和修订。

## Rider 目标

本轮 Riding 的目标不是重新写一份 PRD，而是在已有基础稿上做提交前收敛：

- 保留已有主线：ARY GRS 001 要证明 Organizer 数据留在本地，ARY 仍能完成赛事创建、披露、组织与展示。
- 修正容易引起误解的绝对化表达。
- 强化 Agent Riding 与普通 OJ / 普通代码比赛的区别。
- 补充数据安全图示和权限矩阵。
- 让文档更适合作为后续提交版 PRD。

## 关键 Steering

### 1. 确认基础稿

用户提供本地文件：

`/home/lemonhdl/Documents/xwechat_files/wxid_ldfhq2k6ayeq22_844a/temp/RWTemp/2026-06/fb268d294e5bb129b9d2ff547c5b2e5a/ary-grs-001-prd.md`

我将其复制到：

`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md`

并保存项目记忆：后续提交版 PRD 以这个文件为基础，而不是默认从飞书旧稿或 Knowledge 拆分材料开始。

### 2. 首轮 PRD 审阅

我通读基础稿后，指出主要问题：

- “三方彼此不直接交流 / 所有信息、代码、数据、评分都经过 ARY 路由”过于绝对，容易和“真实数据不离开 Organizer”冲突。
- “ARY 不碰不缓存”太绝对，因为 ARY 仍会持有公开披露数据、受控数据和权限保护下的提交内容。
- `Harness` 对评审不够直观，建议统一为 `Agent Riding Skill`。
- 缺少权限矩阵。
- 若干表达过强，例如“政务部门”“物理切断”“事后伪造一定被发现”“ARY 无数据所有权和控制权”。
- 存在笔误：`Organizer 不超过 ARY 直连 Rider`。
- `GR评审` 缺空格，且后续用户指出不应把 “GR 评审”作为核心宾语。

用户指定直接修改第 2、3、6、11、12、13、14 项；第 1 项“披露”从问题列表去掉。

### 3. 概念口径修订

已完成的核心修订：

- 将 “ARY 不碰不缓存” 改成：`ARY 不持有完整受限数据，不缓存真实评测数据`。
- 将架构总则改成：`Rider、Audience 不直接访问 Organizer 的受限数据。ARY 是赛事协作、提交转发与授权展示的中枢。`
- 将 “所有信息、代码、数据、评分都经过 ARY 路由” 改成公开信息、提交物、评分摘要和授权展示内容经由 ARY。
- 将 `Harness` 统一改成 `Agent Riding Skill`。
- 将 “Rider 不是来写代码的，而是来骑 Agent 的” 改成更稳的：`Rider 不只是提交代码，更重要的是展示如何骑行 Agent 完成任务。`
- 将 “政务部门” 改为 “数据拥有方”。
- 将 “物理切断” 改为 “权限隔离”。
- 将 “事后伪造 Record 会被发现” 改为提高伪造成本并提供审计证据。
- 将 “ARY 无数据所有权和控制权” 限定为：ARY 不拥有也不控制 Organizer 的受限数据。
- 修正 `Organizer 不超过 ARY 直连 Rider` 为 `Organizer 不绕过 ARY 直连 Rider`。
- 将 `这两个问题收敛成一个命题——也是本次 GR 评审的核心句` 改成用户确认的：`这两个问题收敛成 ARY GRS 001 要回答的核心命题：`。
- 将文档中的 `骑 Agent` 统一改成 `骑行 Agent`。
- 将 `### 2.1 一句话定义` 改成 `### 2.1 定义`。

### 4. 补充用户价值和 Audience 口径

在 §2 中新增 `2.4 用户价值` 表，覆盖：

- Organizer：想借助外部智慧办比赛，但不能把完整受限数据交给平台或参赛者。
- Rider：代码生成能力被 Agent 拉平，难以只靠最终代码证明自身能力。
- Audience：难以判断一次 Agent 协作到底是人有效驾驭，还是只看到了最终结果。

在 Audience 定义处补充：

`本文将评审方、观看者和被授权观察者统一归为 Audience。`

### 5. 补充权限矩阵

在 §6 数据安全机制中新增权限矩阵，明确不同数据对 Organizer、本组 Rider、其他组 Rider、Audience 的可见性。

矩阵覆盖：

- Race 公开信息
- 公开评分与排名
- 本组提交
- 本组 Riding Record 摘要
- 其他组提交与 Record
- Organizer 真实数据集
- Organizer 内部评测依据

这个矩阵补上了“组间隔离”和“授权展示”的可检查表达。

### 6. 生成并插入数据流图

用户使用 GPT 图片工具生成“ARY 数据流与数据主权边界”图。我先审阅第一版，指出需要改：

- “算法/模型方案”太窄，应改为“方案、文档、代码或原型”。
- “组内协作记录”容易暗示 ARY 默认保存完整协作原文，应改成“组内协作摘要”。
- “合规模块”过度承诺，应改为“安全筛查”。
- ARY 模块名建议贴合 PRD 口径。

用户发来第二版后，图已满足 PRD 插入要求。我将图片复制到：

`/media/lemonhdl/Shared/Software_Engineering/ARY/Docs/images/ary-data-flow-boundary.png`

并在 PRD 中插入：

`### 6.2 数据流与数据主权边界图`

插入位置：

- `6.1 数据主权三级分类` 后
- `6.3 权限矩阵` 前

并顺延 §6 编号：

- `6.3 权限矩阵`
- `6.4 六项安全机制`
- `6.5 安全机制的"反证法"`

## 本轮 Agent Output 的价值

本轮 Agent 的主要价值不是生成新内容，而是做三类工作：

1. 结构化审阅：把 PRD 中潜在误解点、绝对化承诺、口径冲突和缺表格问题列出。
2. 精准修订：根据用户选择，只改指定问题，不擅自重写整篇。
3. 视觉材料落地：审阅数据流图，给出修改建议，并将最终图插入到合适章节。

## 当前剩余问题

截至本记录，仍未处理或待确认的问题主要有：

1. §7 PoC 页面路径是否与最终演示版本一致。
   - 当前文档写的是 `/`、`/records`、`/records/record-session-02`、`/replay/record-session-02`、`/evidence`。
   - 如果最终演示使用 PoC_v2，需要改成实际路由。

2. “5 个页面 / 五页面对应五证明点”是否保留。
   - 当前数据边界证明主要集中在提交与评测状态页。
   - Records / Replay 更偏 Agent Riding 过程证明。
   - 后续应根据最终演示脚本统一。

3. 文档仍在逐句审阅阶段。
   - 用户会继续发送觉得有问题的原文句子。
   - 后续应先判断问题、给出改写；如果用户确认，再直接修改 PRD。

## 当前产物

- PRD 主稿：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md`
- 数据流图：`/media/lemonhdl/Shared/Software_Engineering/ARY/Docs/images/ary-data-flow-boundary.png`
- 本记录：`/media/lemonhdl/Shared/Software_Engineering/ARY/coding-agent-sessions/session-06-prd-data-flow-boundary-review.md`
