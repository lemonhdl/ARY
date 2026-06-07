# session 03：非功能需求与数据边界审阅

## Agent Riding Skill 证据摘要

- Plan：先只读知识库和课程资料，确认团队主线，再从数据主权开始写非功能需求。
- Observation：非功能需求不能套模板写性能、安全、可用性；在 GRS001 中，它直接约束数据主权、公开披露、可验证性、可回放性和展示边界。
- Steering：用户多次要求逐步展开、区分可验证性与可演示性，并强调文档审阅阶段以用户逐句判断为准。
- Validation：同步飞书前确认读取和写入边界；成稿后保留本地 Knowledge 版本，确保团队协作材料可追溯。
- Review：本轮体现了 Rider 把 Agent 从泛化文档写作拉回 GRS001 数据安全命题的能力。

## 原始记录

coding agent session 01

001

Prompt

用户提供课堂录音转录和 ARY PPT 转录，要求先阅读资料，理解“针对 ARY 智能体骑场完成 PRD 文档，需要留意数据安全，包括策略、数据结构设计，以及针对这部分定义 PoC 作为验证”的课程任务。

Agent output

Claude Code 读取本地文件：

- `wechat_long_image_transcription_20260601(1).md`
- `ARY_PPT_转录文档(1).md`

总结出本次 GRS 001 的核心命题：

- Race 数据应留在 Organizer 侧。
- ARY 不应持久化完整 Race 私有数据。
- ARY 仍需完成赛事的创建、披露、组织与展示。
- PoC 的重点不是完整赛事系统，而是证明数据安全假设成立。

Claude Code 初步建议采用 “Organizer 私有数据 + Public Projection + ARY 公共索引” 的产品定义思路，并说明 PRD 应重点覆盖数据主权、公开披露、数据结构和 PoC 验证路径。

Steering

后续讨论应始终围绕 GRS 001 的核心命题展开：不要把任务理解为普通赛事平台或普通 OJ，而要证明 “数据安全的 Race” 是否成立。


002

Prompt

用户要求安装飞书 CLI，并提供飞书 CLI 安装文档链接。

Agent output

Claude Code 读取安装指南后确认安装步骤：

- 安装 Node.js / npm 依赖环境。
- 使用 `npm install -g @larksuite/cli` 安装飞书 CLI。
- 运行 `lark-cli config init --new` 初始化配置。
- 运行 `lark-cli auth login --recommend` 或相关授权命令完成用户身份授权。
- 使用 `lark-cli auth status` 检查状态。

安装过程中发现本机 `ALL_PROXY=socks5://127.0.0.1:7890` 指向不可用代理，导致安装脚本下载失败。Claude Code 临时清除代理环境变量后成功安装 `lark-cli 1.0.46`。

Steering

飞书 CLI 的作用是让 Claude Code 能读取和整理飞书知识库资料。安装和授权过程只服务于本次 PRD 协作，不应默认进行飞书写入操作。


003

Prompt

用户完成飞书 CLI 初始化与用户授权后，要求确认 CLI 当前状态，并判断后续是否可以用于读取飞书知识库资料。

Agent output

Claude Code 使用 `lark-cli auth status` 检查飞书 CLI 状态，确认：

- bot 身份 ready。
- user 身份 ready。
- 当前默认身份为 user。
- token 处于有效状态。

随后 Claude Code 说明：当前配置已经可以用于读取飞书文档、知识库文件夹和相关项目资料；如果涉及创建、更新或写入飞书文档，应在执行前单独确认目标位置和写入范围。

Steering

飞书 CLI 后续主要用于知识库资料读取与 PRD 协作。读取操作可用于理解项目上下文；写入操作需要用户明确授权，避免误改已有文档。


004

Prompt

用户提供飞书文件夹链接，询问是否能读取这个知识库。

Agent output

Claude Code 使用 `lark-cli drive +inspect` 解析链接，确认该文件夹为：

- `ARY 项目知识库`
- 类型：folder
- token：`ZRkvfoRGhlL1ggd3HOxctSB2nYf`

首次列文件时缺少 `space:document:retrieve` 权限。用户完成补充授权后，Claude Code 使用 `lark-cli drive files list` 成功读取文件夹列表，发现初始文档包括：

- `ARY PRD 提交文档`
- `ARY PRD 内部设计`
- `ARY PoC 状态文档`
- `ARY PoC 设计文档`

Steering

知识库读取应以只读理解为主。用户明确要求“只读，理解，先不考虑完成工作”，因此本阶段不修改飞书文档，只总结现有方案状态。


005

Prompt

用户要求只读理解知识库里的 PRD 和 PoC 文档。

Agent output

Claude Code 读取四个飞书文档正文后，总结当前小组方案已经收敛为：

- 主线不是普通 OJ 或刷题平台。
- 主线是 Agent Riding Record 展示、详情与回放。
- 提交和评测状态只作为数据边界证明实验。
- PoC 页面包括：
  - `/`
  - `/evidence`
  - `/records`
  - `/records/record-session-02`
  - `/replay/record-session-02`

Claude Code 识别到当前 PoC 的关键证明链：

1. 未提交无结果。
2. 数据不可用显示缺失。
3. 数据可用显示本次结果。
4. 数据再次不可用后重新显示缺失。

该链路用于证明 ARY 没有将 Organizer 侧受限数据持久化为长期可继续使用的数据。

Steering

后续建议应尊重小组已经形成的主线：Agent Riding Record 是 ARY 的核心过程资产，提交评测只是数据边界证明，不应喧宾夺主。


006

Prompt

用户说明小组分工：

1. 验收清单和风险分析。
2. 项目概述和 PoC。
3. Rider 角度的角色与用例、对应功能需求和数据类型。
4. Organizer 角度的角色与用例、对应功能需求和数据类型。
5. 非功能需求。

用户自己的分工是“非功能需求”，希望先评估分工是否合理。

Agent output

Claude Code 判断该分工整体合理，能覆盖 PRD 的主要结构，但提醒需避免五个人写出不同口径。

Claude Code 对每个分工进行定位：

- 第 1 位负责最终验收和风险收口。
- 第 2 位负责项目主线和 PoC 证明路径。
- 第 3 位负责 Rider 视角，强调查看 Race、Record、Detail、Replay 和提交状态，不应只写提交答案。
- 第 4 位负责 Organizer 视角，是数据主权主线关键。
- 第 5 位负责非功能需求，应围绕数据安全、数据最小化、可验证性、展示边界和可演进性。

Steering

用户负责的“非功能需求”不是边角内容，而是回答本次 GRS 001 数据安全命题的关键部分。


007

Prompt

用户询问“非功能需求”是什么意思。

Agent output

Claude Code 用普通登录系统举例说明：

- 功能需求回答“系统能做什么”。
- 非功能需求回答“这些功能要满足什么质量、边界和约束”。

结合 ARY 项目，Claude Code 将非功能需求解释为：

- ARY 不能持久化 Organizer 的完整私有数据。
- 页面不能暴露内部路径、文件名、JSON 快照。
- 数据不可用时不能继续显示旧评测结果。
- 页面要让评审看懂这是 Agent Riding Race，而不是普通 OJ。
- Riding Replay 要可读、可回放、可解释。
- 系统状态变化要能证明数据安全，而不是只靠口头承诺。

Steering

非功能需求不是模板化的“性能、安全、可用性”列表，而是 GRS 001 中用于约束数据安全、展示边界和证明路径的关键要求。


008

Prompt

用户表示“我们一点一点来”，希望逐步完成非功能需求。

Agent output

Claude Code 建议先从“数据安全与去中心化数据主权”开始，并给出非功能需求的结构：

- 需求说明。
- 验收方式。
- 与 PoC 的对应关系。

随后起草第一节，强调 Organizer 是 Race 数据的唯一主权方，ARY 不应成为完整 Race 私有数据的中心化存储方，而应作为公开内容的组织、索引和展示平台。

Steering

先写最能支撑核心命题的一节，不急着铺开全部非功能需求。这样可以让用户逐段判断口径是否正确。


009

Prompt

用户继续要求展开非功能需求。

Agent output

Claude Code 继续起草后续非功能需求，包括：

- 数据最小化与公开披露边界。
- 可验证性。
- 可理解性与展示清晰度。
- 可回放性。
- 页面表达边界。
- 可演示性。
- 可扩展性与可演进性。

每节都包含“需求说明”和“验收方式”，避免只有抽象口号。

Steering

每一条非功能需求都必须能回到本次 GRS 001 的核心证明：数据不在平台侧完整持有，但 Race 仍能被创建、披露、组织和展示。


010

Prompt

用户询问“可验证性”和“可演示性”是否重复。

Agent output

Claude Code 区分两者：

- 可验证性强调这个安全命题能否被证明。
- 可演示性强调评审能否在短时间内看懂并复现演示路径。

随后建议保留两者，但避免内容重复：可验证性写状态变化和证据；可演示性写演示路径、时间控制和页面证明点。

Steering

看起来相近的 PRD 条目不能机械保留。要判断它们回答的是不是不同问题；如果不同，就通过验收方式区分。


011

Prompt

用户要求把非功能需求整理成可以给组员看的文档。

Agent output

Claude Code 将前面讨论整理为完整 Markdown 文档，形成“非功能需求”稿件。文档结构包括：

- 数据安全与去中心化数据主权。
- 数据最小化与公开披露边界。
- 可验证性。
- 可理解性与展示清晰度。
- 可回放性。
- 页面表达边界。
- 可演示性。
- 可扩展性与可演进性。

Steering

给组员看的内容需要清楚、可检查，不应只保留内部讨论中的跳跃表达。


012

Prompt

用户要求将非功能需求放进飞书知识库。

Agent output

Claude Code 使用飞书文档接口创建或更新对应文档，将非功能需求稿件同步到 ARY 项目知识库。

同步后，本地知识库也保留了相应 Markdown：

`/media/lemonhdl/Shared/Software_Engineering/ARY/Knowledge/非功能需求.md`

Steering

飞书是小组协作入口，本地 Knowledge 是项目长期沉淀。两边都要保留，避免后续找不到依据。


013

Prompt

用户继续逐句修正非功能需求文档。

Agent output

Claude Code 根据用户反馈调整措辞，重点收敛：

- 不能把“平台没有数据”误写成“平台没有任何数据”。
- 不能把“不持久化”误写成“不使用数据库”。
- 不能把 PoC 的简化实现写成最终生产形态。
- 页面表达应面向评审和参赛者，不展示内部路径、服务请求或调试信息。

Steering

文档审阅阶段以用户逐句判断为准。Agent 不应为了完整性擅自扩展成系统设计文档。


本次骑行小结

本次 Riding 主要完成非功能需求的理解、拆解、成稿和知识库沉淀。关键 Steering 是：先确认分工意义，再从数据安全主线开始写；发现概念相近时区分验证和演示；在飞书和本地 Knowledge 都保留可追溯版本。
