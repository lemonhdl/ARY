# session 01：Harness 搭建、飞书资料读取和记录规范

## Agent Riding Skill 证据摘要

- Plan：先搭 Harness 和记录规范，再进入 PRD 或 PoC 产出，避免没有规则就让 Agent 自由扩写。
- Observation：Agent 能读取群聊、知识库和妙记，但权限 scope 分散、记录更新也可能失效，需要 Rider 持续检查执行规则是否真的生效。
- Steering：用户把执行优先级、文件操作边界、飞书读写边界和记录格式写入 CLAUDE.md，明确约束 Agent 的行动范围。
- Validation：发现 Agent 没有自动更新 Riding Record 后，立即要求补录 Round 5 和 Round 6，用记录本身验证 Harness 是否被遵守。
- Review：本轮说明 Riding Skill 不只体现在产出内容，还体现在先建立可执行、可追踪、可纠偏的协作环境。

## 原始记录

## 概述

- **目标**：搭建项目 harness（CLAUDE.md），建立 Riding Record 记录规范
- **产出**：`CLAUDE.md`（项目配置）、本记录文件
- **涉及资源**：飞书 happy_coding 群聊、ARY 项目知识库、妙记录制

---

## Round 1 — 探索 happy_coding

**时间**：约 09:00

### Prompt
> 你现在能访问飞书cli吗？仔细看一下happy_coding的内容

### Agent Answer
- 确认 `lark-cli` v1.0.45 可用
- 搜索发现 happy_coding 是一个飞书外部群聊（chat_id: `oc_672adff9cd3d751d2f2410c2bac4fb02`）
- 拉取了全部 33 条消息，梳理出：
  - 群成员：创建者、若干队员、飞书用户等
  - 共享资源：妙记录制链接、ARY 项目知识库文件夹（`ZRkvfoRGhlL1ggd3HOxctSB2nYf`）
  - 关键讨论：验收标准 v1、ARY 持久化边界、Organizer 视角、非功能需求、Agent 协同记录方式（MD: Prompt + Agent Answer + Steering）
  - 下一步：约开会讨论

### Steering

（留空 — 等待用户填补）

---

## Round 2 — 申请 lark-cli 权限

**时间**：约 09:10–09:20

### Prompt
> 你直接申请全权限吧，这个账号很干净，没有隐私信息

（后续多次：扫二维码完成授权 → "好了"）

### Agent Answer
分 3 轮逐步申请了以下 scope：

| 轮次 | Scope | 用途 |
|------|-------|------|
| 1 | `search:docs:read`, `drive:drive.metadata:readonly`, `im:chat.members:read`, `minutes:minutes.basic:read` | 搜索文档、读取云盘元数据、群成员、妙记基本信息 |
| 2 | `space:document:retrieve`, `vc:note:read` | 浏览知识库文件夹内容、获取妙记 AI 产物 |
| 3 | `docx:document:readonly`, `sheets:spreadsheet.meta:read`, `sheets:spreadsheet:read`, `minutes:minutes:readonly`, `minutes:minutes.artifacts:read`, `minutes:minutes.transcript:export` | 读取 docx 文档、电子表格数据、妙记逐字稿和 AI 产物 |

每次使用 split-flow（`--no-wait --json` → 生成二维码 → 用户扫码 → `--device-code` 完成）。

### Steering

（留空 — 等待用户填补）

---

## Round 3 — 深度读取知识库

**时间**：约 09:20–09:30

### Prompt
> （扫描二维码完成授权）

### Agent Answer
拉取了「ARY 项目知识库」全部 8 个文件：

| # | 文件名 | 类型 | 作者 | 核心内容 |
|---|--------|------|------|----------|
| 1 | ARY PRD 提交文档 | docx | 团队成员 | 产品需求文档：角色、功能、数据需求、验收标准、风险 |
| 2 | ARY PRD 内部设计 | docx | 团队成员 | 内部判断、取舍、方案演进、待讨论清单 |
| 3 | ARY PoC 设计文档 | docx | 团队成员 | Demo 页面路径、实验性证明、实现策略、验证方式 |
| 4 | ARY PoC 状态文档 | docx | 团队成员 | 当前 PoC 状态、数据边界流程、mock 实现、后续计划 |
| 5 | Organizer 视角 | docx | ou_420e | 角色、用例（UC-O*）、功能需求（FR-O*）、数据主权分类 |
| 6 | 非功能需求 | docx | ou_c0a5 | 8 项质量属性（安全、最小化、可验证、可回放等） |
| 7 | 验收标准 | sheet | 用户044503 | 7 个评估维度 + 可量化验收方法 |
| 8 | 风险分析 | sheet | 用户044503 | 5 大风险项 + 缓解措施 |

同时拉取了妙记（`obcnyoxn671w2lbga2rk1wui`）的逐字稿（38 分钟课程 kick-off 录音）。

- 逐字稿文件：`C:\Users\ROG\Desktop\se\minutes\obcnyoxn671w2lbga2rk1wui\transcript.txt`

### Steering

（留空 — 等待用户填补）

---

## Round 4 — 建立 CLAUDE.md

**时间**：约 10:10

### Prompt
> 我们先来完成harness，我希望你持久化的记住一些要求

→ 询问 CLAUDE.md 读取方式
→ 确认每次新会话自动加载

> 接下来我来提要求，你来写CLAUDE.md

### Agent Answer
- 解释了 CLAUDE.md 机制：每次新会话开始时自动加载到系统 prompt
- 提出建议结构（项目定位、目录结构、飞书 token 映射、团队分工、数据安全原则等）
- 按用户第一条要求写入对话记录规范

### Prompt
> 你的对话记录要保存在哪里，写明白，从现在开始做，怎么组织的

### Agent Answer
- 更新 `CLAUDE.md`，明确了：
  - 存放路径：`C:\Users\ROG\Desktop\se\riding-records\`
  - 命名规则：`YYYY-MM-DD-session-{序号}-{描述}.md`
  - 三段结构：Prompt / Agent Answer / Steering
  - 记录时机：每次会话结束时 Claude 主动整理
- 创建 `riding-records/` 目录
- 创建本记录文件（第一条 Riding Record）

### Steering

（留空 — 等待用户填补）

---

## Round 5 — 执行优先级规则

**时间**：约 10:20

### Prompt
> 要求agent在执行时，第一优先级是参考以-this-is-a-name-A为后缀的文件夹内的内容，之后考虑我的prompt，再然后是其他内容。

### Agent Answer
- 更新 `CLAUDE.md`，新增「执行优先级」段：
  1. `*-this-is-a-name-A` 目录（课程评审标准、硬性要求）
  2. 当前 Prompt
  3. 其他内容（知识库、聊天记录等）
- 冲突时高优先级覆盖低优先级

### Steering

（留空 — 等待用户填补）

---

## Round 6 — Riding Record 自动更新缺失

**时间**：约 10:22

### Prompt
> 你为什么没有自动更新对话记录

### Agent Answer
- 承认未按 CLAUDE.md 中自己刚写的规则，在每次产出后主动追加 Riding Record
- 补录 Round 5 和 Round 6 到本文件
- 后续改进：每完成一轮交互（Prompt → Answer → 产出）立即追加记录，不等会话结束

### Steering

（留空 — 等待用户填补）

---

## Round 7 — 文件操作规则

**时间**：约 10:28

### Prompt
> 要求agent不允许删除文件，修改文件时要和我确认

### Agent Answer
- 更新 `CLAUDE.md`，新增「文件操作规则」：
  - ❌ 删除文件：禁止
  - ⚠️ 修改文件：需先向用户说明改动内容，获同意后执行
  - ✅ 创建文件：允许，无需确认

### Steering

（留空 — 等待用户填补）

---

## Round 8 — 飞书只读约束

**时间**：约 10:30

### Prompt
> 任何情况下都只能读取飞书中的内容，不得修改，上传，发送任何东西

### Agent Answer
- 更新 `CLAUDE.md`，新增「飞书操作边界」：
  - ✅ 读取（文档、表格、妙记、群聊、知识库）
  - ❌ 修改、上传、发送消息、创建 — 一律禁止
- 总结：「飞书只读，任何情况下不得写入」

### Steering

（留空 — 等待用户填补）

---

## Round 9 — 任务分工确认

**时间**：约 10:35

### Prompt
> 将任务分为这5个部分：1.验收清单和风险分析 2.项目概述和PoC 3.Rider角度的角色与用例...4.Organizer角度...5.非功能需求

### Agent Answer
- 逐项评估了 5 个任务的完成度
- 结论：Organizer 视角（85%）、非功能需求（85%）、验收清单和风险分析（80%）、项目概述和PoC（75%）、**Rider 视角最大缺口（10%）**

### Steering
（留空）

---

## Round 10 — 拆解 Organizer 视角文档结构

**时间**：约 10:40

### Prompt
> 看一下 Organizer 视角是怎么写的

### Agent Answer
- 拆解出 5 章骨架：本视角设想的问题 → 角色 → 用例(UC-O*) → 功能需求(FR-O*) → 数据类型与安全机制
- 归纳结构特点：视角开头设问题、角色→用例→FR 逐层推进、数据分类贯穿始终、安全机制是自然结论
- 提取可复用模板格式

### Steering
（留空）

---

## Round 11 — 审视验收标准与风险分析

**时间**：约 10:45

### Prompt
> 看一下验收清单和风险分析

### Agent Answer
- 整理验收标准 7 个维度（含 9 项 Agent Riding Skill 清单）
- 整理风险分析 5 项（2 高风险 + 3 中风险）
- 关键发现：第 7 条验收维度直接定义了 9 项 Riding Skill，可作为 Rider 视角核心参考

### Steering
（留空）

---

## Round 12 — 归纳 Rider 侧要求

**时间**：约 10:48

### Prompt
> 简单总结这个对rider侧的要求是什么

### Agent Answer
- 一句话总结：**用 Riding Record 证明你是一个骑手，而不仅仅是让 AI 替你把活干了。**
- 9 项骑行技能必须能在记录中被看到——定目标、拆任务、看输出、判断、干预、验收，每步有痕迹。

### Steering
（留空）

---

## Round 13 — 完成 Rider 视角文档

**时间**：约 11:15

### Prompt
> 写文档吧

（经前面多轮对 Rider 角色的澄清：生产者、组内协作透明、组间隔离、仅握需求、沙箱验证、防造假面板、留言板 Agent 可代劳）

### Agent Answer
- 创建本地 `C:\Users\ROG\Desktop\se\rider-perspective.md`
- 按 Organizer 视角模板结构：问题 → 角色 → 用例(UC-R1~R10) → FR(R1~R10) → 数据类型三级 → 安全机制(6项)

### Steering
（留空）

---

## Round 14 — 同步飞书文档

**时间**：约 13:10

### Prompt
> 同步到飞书文档吧
→ 发现缺 `docx:document:create` scope，扫码授权
→ 你要保证本地和云端的文档的一致性哦

### Agent Answer
- CLAUDE.md 飞书规则从「任何情况不得写入」修正为「除非用户明确要求」
- 创建飞书文档到 ARY 项目知识库：https://jcnboj5dg0t7.feishu.cn/docx/X4AqdDG4joXWVfxkRiEcXgIMncd
- 本地 `rider-perspective.md` 头部加入飞书 URL 和 Document ID 锚定
- CLAUDE.md 新增「文档同步规则」：本地产出后同步飞书、两端标题一致、本地头部标注飞书链接

### Steering
（留空）

---

## 本轮关键产出

| 产出 | 路径 |
|------|------|
| 项目配置文件 | `C:\Users\ROG\Desktop\se\CLAUDE.md` |
| 对话记录目录 | `C:\Users\ROG\Desktop\se\riding-records\` |
| Rider 视角文档 | `C:\Users\ROG\Desktop\se\rider-perspective.md` |

---

## Agent 自评

- ✅ 完成了 happy_coding 全部内容的读取和整理
- ✅ 知识库 8 个文档全部拉取完整内容 + 妙记逐字稿
- ✅ CLAUDE.md 和 Riding Record 规范已建立
- ⚠️ 群成员列表因外部群限制未能获取（需同租户权限）
- ❌ Round 5 写入 CLAUDE.md 后未同步追加 Riding Record（已被用户纠正）
  - 修正：CLAUDE.md 记录时机改为「每轮立即追加」，不等会话结束
- ❌ 权限申请缺少提前预判，分了 3 轮扫码（应事先列出全部所需 scope，一轮完成）
