# session 07：数据边界 PoC 构建与验证

## Agent Riding Skill 证据摘要

- Plan：先用蜂群复核资料边界和代码结构，再新建轻量 PoC，不把概念讨论直接当交付。
- Observation：最初页面容易滑向普通提交、排行榜和调试证据页，独立复核还发现完整题解进入公开存储的风险。
- Steering：Rider 要求 PoC 以课堂资料为最高约束；Agent 将完整题解移入受保护存储，公开区只保留摘要和指针。
- Validation：自动验收覆盖双服务、公开存储不含私有评测数据、完整题解不出现在公开快照、页面返回 200 和敏感内容扫描。
- Review：本轮把“数据留在 Organizer 侧”从口号变成可运行、可检查、可复现的验证链。

001

Prompt
以 Docs 中的转录文档为最核心最需要遵守的内容 利用好蜂群 自主展开调研和实验 直接完成一个可以交付的 PoC

Agent output
启动任务 完成 ARY 数据安全 PoC 先并行调用两个子 Agent 一个复核 Docs 和 Knowledge 中的 PoC 约束 一个勘察 ARY 项目结构

Steering
用户明确要求自主推进 不再停留在讨论阶段 PoC 必须以 Docs 转录文档为最高约束 证明数据留在 Organizer 侧 ARY 不持久化完整 Race 敏感数据 同时仍能展示 Race 和结果

002

Prompt
蜂群复核 PoC 约束

Agent output
子 Agent 复核出验收核心 ARY GRS 001 必须证明 Organizer 数据留在本侧 ARY 不持久化完整 Race 敏感数据 仍能创建 披露 组织 展示 Race Demo 要有 Organizer 私有区 ARY 公开区 提交入口 远端评测 排行榜 数据安全证据页

Steering
把 PoC 定位为数据边界证明系统 不是完整赛事平台 不做指导骑行 成果评审 骑行复盘 生产级权限或复杂平台

003

Prompt
勘察 ARY 项目结构

Agent output
Explore 子 Agent 确认 ARY 当前只有 Docs Knowledge coding-agent-sessions 没有代码项目 package.json 或 src 建议从 poc-范围与演示策略.md 和两份转录文档开始建立 PoC

Steering
需要新建 PoC 项目 不能依赖现有代码 选择轻量本地实现 优先可运行和可点击

004

Prompt
设计 PoC 技术形态

Agent output
采用不依赖外部包的 Node 原生双服务 Demo 一个 ARY 服务负责页面与公开存储 一个 Organizer evaluator 服务负责读取 Organizer 私有数据并返回公开评测结果

Steering
双服务结构直接对应 Docs 中的数据安全要求 Organizer 侧保留私有数据 ARY 侧只持久化公开投影 提交摘要 结果摘要和评测收据

005

Prompt
创建 PoC 目录结构

Agent output
创建 /media/lemonhdl/Shared/Software_Engineering/ARY/PoC 及子目录 organizer-private ary-public-store src 后续又增加 ary-protected-store

Steering
目录本身承担演示证据 Organizer 私有区 ARY 公开区 ARY 受保护提交区三类边界可以在 evidence 页面直接展示

006

Prompt
写入 mock 数据

Agent output
写入 Organizer 私有 Race 定义和私有评测数据 写入 ARY 公开 Race 索引 初始化 submissions leaderboard evaluation_receipts

Steering
一开始使用 mock data 是为了跑通 但后续用户指出交付 PoC 不应强调内部实现和 mock 因此最终页面和文档只表达为 PoC 证明数据流和边界 不在交付展示中突出 mock 字样

007

Prompt
实现 Organizer evaluator

Agent output
实现 organizer-server.js 读取 organizer-private 下的私有评测数据 根据 Rider solution 计算分数 只返回 score publicResult dataVersionHash evaluatedBy proof

Steering
评测发生在 Organizer 侧 ARY 不直接读取私有评测数据 返回值必须是公开结果摘要而不是测试数据内容

008

Prompt
实现 ARY 页面服务

Agent output
实现 ary-server.js 提供四个页面 / /submit /leaderboard /evidence 首页展示 Race 公开投影 提交页提交题解 排行榜展示公开结果 证据页展示三类数据边界

Steering
页面不是调试页 而是给老师点击的演示页 后续进行了 UI 改造 用 Hero 卡片 分栏 边界卡片和可展开公开数据快照提高可读性

009

Prompt
实现验证脚本

Agent output
实现 verify.js 启动 ARY 和 Organizer 双服务 自动访问首页 提交题解 检查排行榜 检查 evidence API 断言 Organizer 有私有评测数据 ARY 公开存储没有私有评测数据和隐藏输入

Steering
PoC 不能只靠肉眼演示 需要自动验收命令 npm run verify 输出 VERIFY_PASS ARY PoC data boundary holds

010

Prompt
补充 README 和演示脚本

Agent output
新增 README.md 说明运行 验证 数据边界 证明点 新增 DEMO_SCRIPT.md 记录 3 到 5 分钟演示路径 首页 提交 排行榜 数据安全证据页

Steering
交付不只是代码 还要能让小组成员和老师快速复现 点击和讲解

011

Prompt
运行自动验收

Agent output
执行 npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC run verify 输出 VERIFY_PASS ARY PoC data boundary holds

Steering
确认主流程可运行 但这只是第一轮 后续还需要独立复核和人工页面检查

012

Prompt
独立复核 PoC

Agent output
启动子 Agent 复核 PoC 是否满足 GRS 001 约束 子 Agent 判断基本满足 但指出 ARY public store 中 submissions.json 持久化了完整 solution 如果题解属敏感数据需改为摘要或策略说明

Steering
这是关键纠偏 完整题解不应出现在公开存储中 应区分 ARY 公开数据和受保护提交内容

013

Prompt
修复完整题解进入公开存储的问题

Agent output
新增 ary-protected-store/submission_payloads.json 完整题解进入受保护提交存储 ary-public-store/submissions.json 只保存 submissionId raceId team submittedAt protectedPayload

Steering
符合之前知识库中“参赛题解可以持久化 但不能被所有人看到”的判断 交付上表达为完整题解不进入公开数据快照

014

Prompt
更新证据页

Agent output
/evidence 改为展示 Organizer 保留 ARY 公开保存 受保护提交内容三栏 并在公开数据快照中只展示 races submissions leaderboard receipts 不展示完整题解

Steering
证据页是本 PoC 最关键的页面 评审应能直接看到 ARY 公开保存区没有私有评测数据和完整题解

015

Prompt
更新自动验收

Agent output
verify.js 增加断言 protectedFiles 包含 submission_payloads.json publicSubmissions 不包含 solution publicSubmissions 指向 protectedPayload evidence 页面不暴露完整提交内容

Steering
把子 Agent 发现的问题固化进自动验收 防止后续改动回退

016

Prompt
清理公开收据中的私有文件名

Agent output
第二次独立复核发现 public receipt 中出现 test_cases.json 字样 虽然只是证明文本 但容易让老师误解 已改成 Organizer private evaluation data was used only on the Organizer side

Steering
交付 Demo 不应在公开结果中出现私有文件名 避免评审误判 ARY 看到了私有文件

017

Prompt
清理内部设计表述

Agent output
用户指出 PoC 交付物不应包含太多内部设计表述 扫描并移除页面与文档中的 mock 生产级 4 天 内部设计 不要说 当前使用 没有实现等词 把内部材料改为未公开材料

Steering
交付物面向老师演示 不是内部讨论稿 应讲证明结果 数据边界和可点击路径 不讲实现取舍和竞标策略

018

Prompt
清理英文界面

Agent output
将页面中的 Product Definition PoC Rider Submission Public Result Data Boundary Evidence Submissions Top Score Organizer private ARY public data Protected submission 等界面标签改成中文

Steering
中文课堂展示应使用清晰中文标签 减少英文装饰和展示噪音

019

Prompt
恢复评测接口

Agent output
清理过程中发现 organizer-server.js 一度只剩 public-projection 和 private-inventory 导致 verify 提交时 /evaluate 返回 404 已恢复 calculateScore 和 POST /evaluate

Steering
每次表达清理都必须重新跑功能验证 文案改动不能破坏可运行性

020

Prompt
最终验证

Agent output
执行 npm run verify 通过 输出 VERIFY_PASS ARY PoC data boundary holds 执行公开存储敏感内容扫描通过 PUBLIC_STORE_SCAN PASS 启动服务后检查 / /submit /leaderboard /evidence 四个页面均返回 200

Steering
最终交付证据包括自动验收 公开存储扫描 页面冒烟检查 三类验证

021

Prompt
记录 PoC 交付状态到知识库

Agent output
新增 /media/lemonhdl/Shared/Software_Engineering/ARY/Knowledge/poc-交付记录.md 并更新 Knowledge/INDEX.md 记录运行方式 验证方式 数据边界 UI 交付状态 演示材料 已知边界

Steering
Knowledge 记录用于团队回看和后续 PRD 系统设计引用 但交付页面本身不应包含内部取舍语言

022

Prompt
最终交付物

Agent output
当前 PoC 路径为 /media/lemonhdl/Shared/Software_Engineering/ARY/PoC 运行 npm start 打开 http://127.0.0.1:4100 包含 Race 公开展示 提交 排行榜 数据安全证据页 README.md DEMO_SCRIPT.md 自动验收 npm run verify

Steering
此版本是第一轮可运行原子系统 证明数据边界和平台能力同时成立 但后续用户指出它仍然太像普通编程题评测网站 需要继续纠偏到 ARY Agent Riding 平台

023

Prompt
用户指出“这个比赛平台是 ARY 不是力扣 现在做的跟 agent 完全没有关联 就像普通编程题目评测网站”

Agent output
重新回顾 Docs 和转录文档 确认 GRS 001 虽然重点是数据安全 但平台语境必须体现 Agent Racing Yard 和 Agent Riding 不能只做提交题解 排行榜和普通评测

Steering
用户将方向从 OJ 式评测网站拉回 ARY 平台 重点应变成 Riding Record 的展示 回放和过程证据

024

Prompt
用户要求开始自主推进 PoC 搭建 最终能够有 agent riding_record 的展示和回放 可以使用 coding-agent-sessions 作为示例数据

Agent output
将 PoC 主线从 /submit /leaderboard 改造为 /records /records/:recordId /replay/:recordId /evidence 新增 riding_records.json riding_record_steps.json record_replay_events.json 使用 session-01 和 session-02 的公开摘要构造 Riding Record

Steering
示例数据来自真实 coding agent session 但平台页面只展示可公开摘要 不把完整原文和筛选依据放入平台可见页面

025

Prompt
重构 ARY 页面服务和公开数据对象

Agent output
重写 ary-server.js 首页展示 Race 信息 Records 页展示两条 Riding Record 详情页展示 Prompt Agent Output Steering 和 Riding Signal Replay 页按事件流回放一次 Agent Riding 过程 Evidence 页展示数据边界

Steering
平台要先让评审看懂 Rider 如何驾驭 Agent 完成真实项目 再说明数据边界 而不是让页面看起来像调试工具或 OJ 后台

026

Prompt
更新验证脚本和交付文档

Agent output
verify.js 改为验证首页 Records 详情 Replay Evidence 页面 并检查页面不暴露 privateDefinition privateReviewFocus fullChallengeBrief 完整 session 绝对路径 以及不出现提交题解 排行榜等 OJ 主线词

Steering
把“不能做成 LeetCode/OJ”固化到自动验收中 防止后续页面又回到普通评测网站表达

027

Prompt
用户指出当前数据证据更像口头证明 没有实验性证明 建议分 server 和 client 用另一个进程是否启动证明数据是否可用

Agent output
新增评测进程 mock-evaluation 接口 ARY 侧增加提交后调用外部评测能力的逻辑 verify.js 增加三阶段验证 数据不可用时缺失 数据可用时返回结果 数据再次不可用后重新缺失

Steering
证据不能只靠文件列表和说明文字 需要通过开关实验展示平台没有提前持有可用评测数据

028

Prompt
用户强调 Organizer 的服务最好是在终端控制启动和关闭 也就是平台无法控制

Agent output
调整启动方式 npm start 只启动 ARY 平台 新增 npm run start:organizer 单独启动评测进程 ARY 页面不提供启动或关闭外部进程的控制按钮

Steering
平台只能观察和使用评测能力 不能控制评测进程 否则无法证明两侧边界

029

Prompt
用户指出我们是平台 访问平台可以以参赛者身份访问 什么都还没提交就有结果不合理 需要提交入口 比如提交“满分答案”后才能触发评测

Agent output
将 /evidence 改成提交与评测页面 增加表单提交入口 POST /evaluate 未提交时显示还没有评测结果 提交后才根据评测能力状态显示数据缺失或 mock 评测结果

Steering
平台身份和参赛者身份要区分 平台不能打开页面就自动产生评测结果 必须由参赛者提交触发

030

Prompt
用户指出 ARY 向组织方发送了什么请求这种内部设计不要暴露在平台可见字样中

Agent output
移除页面中“发送测试请求”“Organizer 在线/未在线”“请在另一个终端启动 Organizer”“关闭后再次提交”等说明 只保留参赛者能理解的状态 未提交 数据缺失 评测完成

Steering
演示页面面向参赛者和评审 不是系统设计说明书 内部通信细节可以存在于代码和演示脚本 不能作为平台 UI 文案

031

Prompt
用户截图指出页面仍有来源投影 路径 record-session-public-v1 等不可读 debug 信息 要用蜂群反思机制自己优化所有类似内容

Agent output
系统扫描 ary-server.js 和公开展示数据 清理页面可见的内部路径 版本指纹 record id JSON 快照 文件名 服务请求细节 Organizer 在线关闭 公开投影 私有筛选标准 完整 session 等调试式表达

Steering
不能被动等用户逐句点名 要按“平台是否可交付”自查所有可见内容 页面应像产品而不是内部 debug 工具

032

Prompt
全面清理平台可见内容

Agent output
首页改为 Race 首页 Records 改为可回放过程记录 提交页改为“提交与评测” Evidence 技术证据页改为用户视角的提交状态页 删除原始 JSON 快照 删除内部文件列表 将公开数据中的摘要也改成用户可读表达

Steering
PoC 可以在底层证明数据边界 但页面不应该把证明材料原样暴露给用户 用户只需要看到赛事 记录 回放 提交 状态

033

Prompt
更新验证和页面审计

Agent output
verify.js 新增统一 UI 黑名单检查 覆盖首页 Records 详情 Replay 提交页和提交结果页 禁止出现 Organizer 公开投影 公开存储 私有 完整 session 文件名 版本指纹 JSON 快照 内部服务 服务请求 数据处理器 终端 在线 关闭等词 同时保留 API 层数据边界检查

Steering
把 UI 文案质量也纳入自动验收 以后页面再出现内部调试口径会直接失败

034

Prompt
最终验证当前 PoC

Agent output
执行 npm run verify 通过 输出 VERIFY_PASS ARY PoC participant submission experiment holds 启动本地页面抓取 / /records /records/record-session-02 /replay/record-session-02 /evidence 和提交结果页 做渲染页面黑名单扫描 通过 UI_AUDIT_PASS

Steering
当前可交付状态是 Agent Riding Record 展示与回放 加参赛者提交触发评测实验 平台页面不暴露内部实现细节 数据不可用时不会凭空给结果 数据可用时才返回本次提交结果

035

Prompt
cc-feishu 给 cc-ARY 发消息明确分工

Agent output
读取 mailbox 得到 cc-feishu 的 handoff cc-ARY 负责 ARY PoC 后续开发 页面实现 验证脚本和本地演示流程维护 cc-feishu 负责飞书文档更新和维护 后续稳定产品口径 页面文案 验证结果由 cc-ARY 通过 mailbox 发给 cc-feishu

Steering
本地 PoC 和飞书文档分工明确 开发侧稳定后再同步给飞书侧 避免文档提前记录未稳定口径

036

Prompt
用户指出 Records 详情和回放内容也应刚开始不显示 等点击提交“满分答案”后再显示出来 回放页也是一样

Agent output
为 /records /records/:recordId /replay/:recordId 增加提交解锁逻辑 未提交时只显示“请先提交答案” 不展示 Riding Record 卡片 详情表格或回放事件 表单提交后设置浏览器 cookie ary_submission=done 后续访问 Records 详情和 Replay 才显示内容

Steering
平台不应在参赛者提交前提前展示过程内容 提交既触发评测状态 也解锁本次可查看的 Riding Record 与回放

037

Prompt
更新验证和演示材料

Agent output
verify.js 增加未提交锁定检查和提交后 cookie 解锁检查 未提交时 Records Detail Replay 不应显示 Record 内容 提交后带 cookie 才显示 Records 详情和回放 README DEMO_SCRIPT Knowledge 交付记录同步更新

Steering
解锁逻辑必须进入自动验收 防止之后页面又变成一打开就展示全部过程内容
