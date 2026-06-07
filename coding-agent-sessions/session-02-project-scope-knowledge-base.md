# session 02：项目范围识别与知识库建立

## Agent Riding Skill 证据摘要

- Plan：先解释关键术语、整理课堂资料和 PPT，再建立 ARY 本地项目目录与 Knowledge，不急着直接写最终方案。
- Observation：早期 Agent 对“不持久化”“DCR”“Continue”等理解有偏差，Rider 通过追问和纠错把任务收敛到 GRS001 Product Definition。
- Steering：用户明确讨论节奏由人主导，PRD 要区分内部分析和对外展示，并用场景、角色、职责、用例反推数据对象。
- Validation：资料进入 Docs，关键方法进入 Knowledge 和 memory，避免讨论只停留在聊天上下文里。
- Review：本轮最重要的 Riding 价值是把抽象作业要求变成可持续使用的项目知识库和需求分析方法。

001

Prompt
ARY Agent Racing Yard 不需要持久化是什么意思

Agent output
初步解释为 ARY 是一次性 Agent 协作场地 当前一轮竞速或任务结束后 中间状态可以丢弃 不需要长期保存临时评分 临时队列 临时路线和中间日志

Steering
先形成不持久化的直觉 但这个理解后来需要被修正 不能简单理解成平台完全没有数据库

002

Prompt
PoC 是什么 Proof of Concept

Agent output
第一次回答被额度错误中断 第二次解释 PoC 是概念验证 用一个小而可运行的版本证明想法 技术路线或方案可行 不追求完整产品质量

Steering
把 PoC 定义为证明关键假设的 runnable 小系统 后续 ARY 项目不能只写 PRD 还要做可运行证明

003

Prompt
转录长图文档

Agent output
读取截图后发现缓存图只有 61 x 1981 像素 中文已经被压缩到不可可靠识别 本地 OCR 只有英文模型 强行转录会大量错字和漏字

Steering
不猜测转录结果 要求用户提供原图或更高清截图 这是一次防止制造错误内容的控制

004

Prompt
什么是 DCR

Agent output
先按常见缩写解释为 Design Change Request Data Change Request Document Change Request 等 并提示要看语境

Steering
这个解释只是通用解释 后续结合 ARY PPT 后 DCR 更应按 DevCompass Racing 理解

005

Prompt
DevCompass Racing

Agent output
解释为面向 AI 编程的竞速式开发方法 先用 DevCompass 给任务设定方向 规则和验收标准 再让 Agent 或方案并行竞争 最后由人或主控 Agent 选择结果

Steering
把 DevCompass Racing 放到 Agentic Development 语境中理解 它不是自由 vibe coding 而是有方向和验收尺的竞速开发

006

Prompt
读取 wechat_long_image_transcription_20260601.md

Agent output
读取到课堂讲话转录 核心内容是 ARY Genesis Race Series 第一次 race 不是完整实现整个平台 而是完成第一轮产品定义和 PoC 重点交付 PRD 和 PoC 原型系统

Steering
项目从这里开始收敛到 ARY GRS 001 不能按普通赛事平台泛泛理解

007

Prompt
在 Software_Engineering 下新建 ARY 项目文件夹 把 Markdown 放入 Docs 目录

Agent output
创建 /media/lemonhdl/Shared/Software_Engineering/ARY/Docs 并复制转录文档

Steering
ARY 项目开始在本地目录落盘 原始资料先进入 Docs 作为需求依据

008

Prompt
文档重命名为 课堂项目要求录音转录文档.md

Agent output
将文件重命名为 /media/lemonhdl/Shared/Software_Engineering/ARY/Docs/课堂项目要求录音转录文档.md

Steering
用中文文件名明确资料来源和用途 后续讨论可以直接引用课堂要求转录文档

009

Prompt
把 ARY_GRS_transcription.md 放到项目文档中 并重命名为 ARY_PPT_转录文档.md

Agent output
复制 PPT 转录文档到 /media/lemonhdl/Shared/Software_Engineering/ARY/Docs/ARY_PPT_转录文档.md

Steering
项目资料形成两份基础文档 一份课堂录音转录 一份 PPT 转录 后续分析同时参考二者

010

Prompt
Continue from where you left off

Agent output
错误回答 No response requested

Steering
这是一次不合格响应 后续遇到 continue 应继续最近未完成任务 而不是停止

011

Prompt
接下来看看这两个文档 与用户讨论一下这次项目

Agent output
读取两份文档后提炼项目目标 这次真正要做的是 ARY GRS 001 Product Definition 数据安全的 Race 重点不是完整 ARY 平台 而是证明 Race 数据留在 Organizer 侧 ARY 不持久化完整 Race 数据 但仍能创建 披露 组织 展示 Race

Steering
把项目定位成产品定义加技术 PoC 交付包括 PRD 系统设计 技术 PoC 展示页面或 Demo Riding Record

012

Prompt
讨论两份文档里的 Race 1 范围

Agent output
从 PPT 中确认 ARY GRS 001 要证明四点 Race 数据可以存留在 Organizer 侧 ARY 不需要持久化保存完整 Race 数据 ARY 仍然可以创建 披露 组织 展示赛事 展示内容来自 Organizer 主动披露的公开元数据或公开投影

Steering
明确不要打偏 本次不主做完整赛事执行 指导骑行 成果评审 骑行复盘等子系统

013

Prompt
我会一句一句说 你可以补充讨论 但是讨论内容由我主导

Agent output
确认协作方式 由用户逐句主导 我负责确认理解 补充项目关系 标出影响位置 提醒风险 不提前替用户定完整方案

Steering
保存协作偏好 后续按用户主导节奏整合外部软件从业者建议

014

Prompt
PRD 要区分内部考虑和实际展示 PRD 内部可以讨论所有内容 对外只展示适合投资方看的内容 作业中老师类似资本家 小组类似竞标方 还要按用户角色 职责 用例思考

Agent output
整理成三层理解 PRD 分内部分析和对外展示 内部服务决策 对外 PRD 服务说服 角色 职责 用例适合挖掘 ARY 需求 因为 ARY 有 Organizer Rider Coach Reviewer Viewer 平台运营方 以及打分系统 滚榜系统 数据请求方等抽象角色

Steering
确认对外 PRD 可以选择表达角度 但不能编造能力 同时把角色 职责 用例作为需求分析主方法

015

Prompt
可以更新知识库先

Agent output
将 PRD 内外边界和角色 职责 用例方法写入 Claude memory 新增 ary-prd-internal-external-role-method 并加入 MEMORY.md

Steering
先把非显然的项目方法沉淀下来 后续讨论和实现都能复用

016

Prompt
知识库也要在 ARY 目录下落盘 后续不断增量更新 做好索引

Agent output
在 /media/lemonhdl/Shared/Software_Engineering/ARY/Knowledge 下创建项目知识库 写入 INDEX.md 和 prd-内外边界与角色分析方法.md

Steering
项目知识库从此成为 ARY 的本地长期依据 每条讨论按主题增量更新 并同步维护索引

017

Prompt
PRD 中不应只有竞赛平台 赛事发布 小组搭建 历史回放这类功能性需求 还要包含数据安全这种非功能性需求 需要显式区分

Agent output
新建 prd-功能性需求与非功能性需求.md 记录功能性需求回答系统要做什么 非功能性需求回答系统要以什么约束和质量完成这些功能 数据安全是本次 GRS 001 最关键的非功能性需求

Steering
数据安全不能只写在背景或愿景中 要在 PRD 中作为可验证需求单独出现

018

Prompt
用户用例还要加入场景 可以说成 场景 角色 职责 用例 或 角色 职责 用例 加场景 数据不是投资方能说清楚的 而是软件开发者要想清楚的

Agent output
补充到 prd-内外边界与角色分析方法.md 场景用于限定需求发生的上下文 同一角色在不同场景下可能职责不同 数据模型不是先验给定的 而是从场景 角色 职责 用例中反推出来

Steering
把之前对数据长什么样的迷茫转成可操作方法 先分析用例 再推导数据对象

019

Prompt
场景是组织方举办比赛 角色是组织方 职责是发布赛题并提供测评数据样例 用例是上传测评数据样例 因此推出测评样例 这说明数据安全具体指测评数据不能泄漏

Agent output
补充到 prd-功能性需求与非功能性需求.md 数据安全不能一概而谈 要按场景 角色 职责 用例和数据类型具体化 测评样例泄漏给参赛者会破坏公平性 泄漏给其他组织方会破坏保密性

Steering
将数据安全从抽象口号落到具体数据对象和具体风险 后续每类数据都要单独分析

020

Prompt
回顾课堂要求转录文档 平台不对数据做持久化 我的理解类似联邦学习 平台需要访问某些数据 但数据不进入平台数据库 而是在组织方本地计算分数后回传平台

Agent output
回看课堂要求转录文档 19:01 到 21:45 附近 确认老师强调 Organizer 的知识和数据不应存留在平台服务器 新建 数据不持久化与远端评测.md 记录远端评测方案

Steering
把不持久化理解为数据不出域的产品逻辑 不必实现真正联邦学习算法 但可以借用其思想

021

Prompt
参赛者提交题解 平台需要分数 用于评测的数据仍在组织方本地 平台把题解和任务发给组织方本地 组织方本地算分再回传平台

Agent output
整理远端评测流程 Organizer 保存 test cases Rider 在 ARY 提交答案 ARY 调用 Organizer evaluator Organizer 用本地测试数据计算分数 ARY 只收到 score 和 public result 验证 ARY 侧没有测试数据内容

Steering
这个流程成为 PoC 主线候选 证明功能仍可完成 同时测试数据不在 ARY 持久化

022

Prompt
数据不能持久化也要区分需要数据安全的数据和非数据安全的数据 不然平台没有数据库怎么记录排行和用户

Agent output
补强 数据不持久化与远端评测.md 明确平台不是不能有数据库 可以持久化用户账号 队伍信息 Race 索引 公开元数据 公开投影 分数摘要 排行榜 hash 版本号 展示页面配置 不应持久化的是具体场景中被定义为敏感的完整数据

Steering
修正极端理解 数据安全不是平台无数据库 而是平台数据库不保存敏感完整数据

023

Prompt
数据安全的保证方式不只有不持久化 有的队伍提前提交题解 题解肯定要持久化 但不能被其他选手看到 所以需要分用户访问权限的数据结构 课堂要求转录文档也提到了 access

Agent output
查找转录文档中 access 资产 存留 展示等表述 新建 数据安全机制与访问权限.md 记录参赛题解适合持久化 但需要分用户访问权限和公开时机控制

Steering
数据安全机制扩展为按数据类型选择 不持久化 远端计算 权限控制 时间锁 公开投影 hash 审计日志等组合

024

Prompt
定义持久化 让软件开发组员达到共识 比如只进或甚至不进平台服务器内存 不在平台外存落盘长期保留的数据

Agent output
新建 持久化术语定义.md 定义持久化为数据被平台写入外存 并在请求结束 进程重启或一段时间后仍然可以被平台重新读取 外存包括数据库 文件系统 对象存储 日志文件 长期缓存 浏览器或服务端本地长期存储

Steering
团队术语达成共识 不持久化不是平台完全不能接触数据 而是敏感数据不在平台外存落盘长期保留 更严格场景下敏感数据甚至不进入平台服务器 只由 Organizer 侧本地服务使用

025

Prompt
定义不持久化时注意日志和内存

Agent output
在术语文件中补充日志也可能构成持久化 如果平台把敏感数据写入请求日志 错误日志或调试日志 就等于变相持久化 内存通常不算持久化 但高安全级别可以要求敏感数据不进入平台服务器内存

Steering
为后续实现和验收留下检查点 不仅查数据库 也要查文件 日志 长期缓存和数据流

026

Prompt
把上述讨论形成项目知识库

Agent output
当前 ARY Knowledge 已包含 INDEX.md prd-内外边界与角色分析方法.md prd-功能性需求与非功能性需求.md 数据不持久化与远端评测.md 数据安全机制与访问权限.md 持久化术语定义.md

Steering
项目从口头讨论进入可复用知识库状态 后续 PRD 系统设计 PoC 和 Riding Record 都可以引用这些文件
