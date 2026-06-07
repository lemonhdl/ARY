# session 04：Organizer 用例与数据类型对齐

## Agent Riding Skill 证据摘要

- Plan：先读团队知识库和课程材料，再完成 Organizer 视角任务，不在概念未确认时直接写交付稿。
- Observation：Agent 曾把“prd”误判为要直接起草 PRD，也发现任务原始例子与团队最新“Riding Record 展示与回放”口径冲突。
- Steering：Rider 及时打断误写 PRD、要求上报方向冲突、控制用例扩张范围，并要求功能需求与用户重排后的 UC 编号对齐。
- Validation：通过飞书权限实证诊断、导出 markdown、检查标题层级和表格，绕开平台分享限制后保证交付文件可流转。
- Review：本轮最能体现 Agent Riding 的地方是人定框架和口径，Agent 做读取、对齐、增量修改与导出验证。

## 原始记录

coding agent session organizer PRD

本次骑行目标 完成 PRD 分工第 4 项 Organizer 角度的角色 用例 功能需求与数据类型 产出飞书知识库文档并与团队口径对齐

001

Prompt
根据目录下的课件资料总结这节课讲了什么 我要做什么 并解释 PPT 里 ARY PoC 之类的术语

Agent output
读取 PPT 转录与课堂录音转录 产出课程总结 确认这是 ARY GRS 001 启动课 主线是从软件工程师到智能体工程师 本场 Race 交付 PRD 加 PoC 核心是数据安全 并整理 ARY GRS PoC PRD self-dogfood 自举 Harness 等术语表

Steering
先建立课程与任务的全景理解 再进入具体分工 不在不理解背景的情况下直接动手

002

Prompt
prd

Agent output
误判为要直接写一份 PRD 开始起草交付文档

Steering
立刻打断 说明只是要解释 PRD 概念 骑手需要及时打断跑偏的 agent 避免在错误方向上消耗

003

Prompt
解释 prd

Agent output
解释 PRD 为 Product Requirement Document 产品需求文档 并区分 PRD 负责说清楚 PoC 负责跑起来证明 两者在本次 Race 中是并列交付物

Steering
概念确认后才进入实操 避免在错误理解上开工

004

Prompt
给出小组五项分工 我的任务是第 4 项 Organizer 角度的角色与用例 对应功能需求和数据类型 要求读取飞书 happy_coding 项目知识库 创建个人知识库 写文档 1 总结知识库 写文档 2 完成任务 并给出数据不泄露 提交回传算分 一日一题等场景

Agent output
把口头任务拆解成四个可执行任务并建立追踪 读知识库 建个人知识库 写文档 1 写文档 2 随后加载飞书工具链准备执行

Steering
把组内分工转成清单化交付 明确每一步的产出物

005

Prompt
继续执行

Agent output
平台 shell 工具临时故障 无法运行飞书命令行 改为先利用已有课程材料在本地起草文档 2 的完整草稿 等工具恢复后再接入飞书校准

Steering
阻塞时不空等 让 agent 转移到当前条件下可推进的工作 保住进度

006

Prompt
继续 已切换手动批准模式

Agent output
shell 恢复后试运行 报缺少云空间读取 scope 发起设备码授权流程 生成授权链接与二维码

Steering
人机分工处理认证 agent 发起授权 人负责扫码确认

007

Prompt
扫码后页面提示无使用权限 当前账号不在该 CLI 应用可用范围内

Agent output
诊断为应用可用范围问题 不是 OAuth scope 问题 查出本机存在两个飞书应用配置 当前激活的应用对该账号关闭

Steering
区分应用可用范围与接口授权两类权限问题 避免在错误的层面反复重试

008

Prompt
改用个人版飞书应用 个人账号已被拉进 happy_coding 群聊

Agent output
切换到个人应用配置后直接试读目标文件夹 成功列出四个文档 跨组织文档因分享给个人账号而可读

Steering
用最小代价试错代替过度设计 先验证可行性再继续推进

009

Prompt
读取知识库全部文档

Agent output
读完 ARY PRD 提交文档 PRD 内部设计 PoC 状态文档 PoC 设计文档 发现团队主线已从普通评测平台收敛为 Agent Riding Record 展示与回放 提交评测只作为数据边界验证 排行榜与刷题被明确排除

Steering
发现任务描述与团队最新口径存在方向性出入 这是必须暴露给骑手决策的冲突 不能由 agent 擅自取舍

010

Prompt
选择融合方案

Agent output
以团队知识库口径为基准重写 Organizer 视角 把提交回传 Organizer 远端算分 一日一题时间门控作为数据边界的补充场景纳入 并显式标注为待与组员对齐的补充建议

Steering
既对齐团队主线又保留个人思考 把分歧点标注出来交给团队讨论 而不是隐藏

011

Prompt
文档中不要出现人名

Agent output
去除文档署名 后续所有产出保持无人名 以分工角色代替

Steering
交付物合规约束由骑手设定 agent 全程遵守

012

Prompt
创建个人知识库并写入两份文档

Agent output
先用最小内容探测文档创建权限 再创建知识空间 建立两个文档节点 以 markdown 写入全文 并抽查标题层级与表格渲染确认正确

Steering
写操作前先小成本探测权限 避免长内容反复失败 完成后验证渲染而不是默认成功

013

Prompt
像 UC-O5 UC-O6 这样的用例可以再多想一些 核心是用例 功能需求和数据类型都围绕用例来做

Agent output
准备按 Organizer 全生命周期重构出二十多个用例分六组

Steering
打断 范围过大 只需在原有基础上增加四到五个 骑手控制范围 防止 agent 过度工程

014

Prompt
再加四到五个同风格用例即可

Agent output
增量新增 UC-O8 至 UC-O12 提交合法性校验 披露撤销更正 Record 组织索引 成果榜单披露 赛后回收与审计 同步把对应功能需求和数据项挂接 并以块级替换更新飞书文档 不影响其余内容

Steering
增量演进而非推倒重来 保持既有编号与结构稳定

015

Prompt
我自己改了用例 引入一级二级受限数据分级与泄露挽救等概念并重排为 UC-O1 至 UC-O11 请把功能需求向用例编号对齐

Agent output
读取修改版发现功能需求表对应列整体错位 重写功能需求表实现 FR 与 UC 编号一一对应 为保留一级受限数据补充 FR-O3 合并提交评测相关两条为 FR-O4 按数据分级改写 FR-O6 仅以块级替换功能需求表 不触碰骑手修改的其他内容

Steering
人直接修改文档 agent 负责结构一致性 人定框架 agent 做对齐

016

Prompt
为什么个人账号分享的文档链接别人打不开 连自己的组织账号也不行

Agent output
调用权限接口实证诊断 链接分享为关闭 外部访问为关闭 且文档位于个人版独立租户 对任何其他账号都属跨租户外部访问 个人版对外分享受平台策略限制

Steering
用接口实证代替猜测 确认平台限制后果断转向导出文件的替代方案

017

Prompt
把文档 2 导出成 markdown

Agent output
从飞书拉取当前最新内容导出为本地 markdown 文件 校验格式干净可直接流转 同时清理过程中的全部临时文件

Steering
最终交付物落地为可流转的文件 绕开平台分享限制 收尾时清理中间产物

本次骑行小结
一次完整的文档型骑行 覆盖任务理解 权限排障 跨组织读取 方向冲突上报 融合决策 增量迭代 编号对齐与导出交付 Steering 的关键动作是三次打断纠偏 一次方向冲突上报和一次范围收缩
