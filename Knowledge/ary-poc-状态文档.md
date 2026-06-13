# ARY PoC 状态文档

> 来源：飞书文档《ARY PoC 状态文档》；同步日期：2026-06-06；revision: 16。
> URL：https://ccndgn2u777a.feishu.cn/docx/QtzUdHB9GoZgmAxTbJGcTrmlneg

**协作提示：**组员可以使用飞书给指定文本添加评论，也可以根据各自 PRD 分工内容提出功能实现建议。
**协作提示：**组员可以使用飞书给指定文本添加评论，也可以根据各自 PRD 分工内容提出功能实现建议。

当前状态**本地 PoC 已跑通。**主线**Agent Riding Record 展示、详情和回放。**协作方式**围绕 PRD 分工在对应文本处评论。**
当前状态**本地 PoC 已跑通。**
当前状态**本地 PoC 已跑通。**
## 当前状态
**本地 PoC 已跑通。**
主线**Agent Riding Record 展示、详情和回放。**
主线**Agent Riding Record 展示、详情和回放。**
## 主线
**Agent Riding Record 展示、详情和回放。**
协作方式**围绕 PRD 分工在对应文本处评论。**
协作方式**围绕 PRD 分工在对应文本处评论。**
## 协作方式
**围绕 PRD 分工在对应文本处评论。**

# 1 一句话状态

| 维度 | 当前结论 |
| --- | --- |
| 平台主线 | **已收敛到 Agent Riding Race。**<br>不再按普通评测网站组织页面。 |
| 页面能力 | **Race、Records、Detail、Replay 已跑通。**<br>提交与评测状态也已接入。 |
| 数据边界 | **状态变化已跑通。**<br>未提交无结果；不可用显示缺失；可用显示结果；再次不可用后重新缺失。 |
| 展示边界 | **页面不展示内部实现细节。**<br>不展示内部路径、版本指纹、JSON 快照、服务请求细节和未公开材料。 |
| 验证状态 | **自动验收通过。**<br>`VERIFY_PASS ARY PoC participant submission experiment holds` |

---

# 2 页面结构

**阅读方式：**先看 Race 首页，再到提交页触发状态；提交后 Records、Detail 和 Replay 才显示完整内容。
**阅读方式：**先看 Race 首页，再到提交页触发状态；提交后 Records、Detail 和 Replay 才显示完整内容。

Race 入口**`/`**GRS 001 的主题、状态和生命周期。提交与评测**`/evidence`**未提交、数据缺失、评测完成三种状态。Riding 过程**`/records`**提交后进入 Record 列表、详情和回放。
Race 入口**`/`**GRS 001 的主题、状态和生命周期。
Race 入口**`/`**GRS 001 的主题、状态和生命周期。
## Race 入口
**`/`**
GRS 001 的主题、状态和生命周期。
提交与评测**`/evidence`**未提交、数据缺失、评测完成三种状态。
提交与评测**`/evidence`**未提交、数据缺失、评测完成三种状态。
## 提交与评测
**`/evidence`**
未提交、数据缺失、评测完成三种状态。
Riding 过程**`/records`**提交后进入 Record 列表、详情和回放。
Riding 过程**`/records`**提交后进入 Record 列表、详情和回放。
## Riding 过程
**`/records`**
提交后进入 Record 列表、详情和回放。

| 分组 | 页面 | 状态 | 内容 |
| --- | --- | --- | --- |
| Race | **`/`** | 已实现 | Race 首页。 |
| 提交 | **`/evidence`** | 已实现 | 提交入口和评测状态。 |
| Record | **`/records`** | 提交后 | Riding Record 列表。 |
| Detail | **`/records/record-session-02`** | 提交后 | Prompt、Agent Output、Steering。 |
| Replay | **`/replay/record-session-02`** | 提交后 | Riding 事件流。 |

---

# 3 已实现内容

展示侧提交侧
展示侧
## 展示侧
| 模块 | 内容 |
| --- | --- |
| Race | **主题、状态、生命周期。** |
| Records | **两条 Riding Record 示例。** |
| Detail | **Prompt、Agent Output、Steering、Riding Signal。** |
| Replay | **目标下达、任务拆解、Steering、验证事件。** |
提交侧
## 提交侧
| 状态 | 页面结果 |
| --- | --- |
| 未提交 | **无评测结果。**<br>Records、Detail、Replay 显示提交引导。 |
| 数据不可用 | **显示数据缺失。** |
| 数据可用 | **显示本次评测结果。** |
| 再次不可用 | **再次显示数据缺失。** |

---

# 4 数据边界流程

flowchart LR
 U[参赛者提交] --> A[ARY 平台]
 A --> C{数据是否可用}
 C -->|不可用| M[页面显示数据缺失]
 C -->|可用| E[返回本次评测结果]
 E --> V[页面显示评测完成]
 C -->|再次不可用| M2[再次显示数据缺失]
 M2 --> B[平台未保留受限数据继续使用]

| 证据 | 含义 |
| --- | --- |
| 未提交无结果 | **结果不是页面预置。** |
| 不可用时缺失 | **平台不能凭空完成评测。** |
| 可用时有结果 | **平台可以使用本次可用结果。** |
| 再次不可用后缺失 | **平台没有把受限数据保存成长期可用数据。** |

---

# 5 当前 mock implementation

| mock 对象 | 现在的做法 | 后续替换方向 |
| --- | --- | --- |
| 参赛者提交 | **文本框提交“满分答案”。** | 正式提交表单、文件上传、队伍权限。 |
| 评测结果 | **返回固定结果字符串。** | 真实评测任务、异步状态、结果摘要。 |
| 数据可用性 | **单独进程启动和关闭。** | Organizer 服务、授权接口、部署地址。 |
| Record 数据 | **本地 JSON 保存公开摘要和回放事件。** | 数据库、对象存储、审核后的公开内容。 |
| 用户身份 | **默认参赛者视角。** | 登录、角色、队伍和权限系统。 |
| 页面样式 | **轻量本地页面和基础 CSS。** | 正式 UI 和组件化页面。 |

---

# 6 页面表达边界

当前展示当前避免展示
当前展示
当前展示
## 当前展示
- Race 信息
- Riding Record
- Record 详情
- Riding Replay
- 提交内容
- 本次提交状态
当前避免展示
当前避免展示
## 当前避免展示
- 内部路径
- 版本指纹
- JSON 快照
- 服务请求细节
- 终端操作提示
- 未公开材料和评审细则

---

# 7 后续计划

| 优先级 | 方向 | 内容 |
| --- | --- | --- |
| 高 | PRD 对齐 | **按各自分工补齐对应页面、状态或演示证据。** |
| 高 | 页面文案 | **继续减少内部实现词，保持参赛者和评审可读。** |
| 高 | 演示脚本 | **整理 3 到 5 分钟固定点击路径。** |
| 中 | mock 替换 | 优先替换最影响演示说服力的 mock。 |
| 中 | 数据安全证明 | 强化提交前、数据缺失、评测完成、再次缺失的证据。 |
| 中 | 展示材料 | 整理 Riding Record 和 Replay 的可展示版本。 |

---

# 8 可讨论的问题

**当前 PoC 是否覆盖了各自 PRD 分工中的关键功能。**
当前 PoC 是否覆盖了各自 PRD 分工中的关键功能。

**当前页面是否已经体现 Agent Riding Race，而不是普通 OJ。**
当前页面是否已经体现 Agent Riding Race，而不是普通 OJ。

**哪些 mock implementation 会影响演示说服力。**
哪些 mock implementation 会影响演示说服力。

**页面是否还有内部实现、debug 信息或不友好的表达。**
页面是否还有内部实现、debug 信息或不友好的表达。

**还需要补哪些页面、状态或演示证据。**
还需要补哪些页面、状态或演示证据。

---

## 本地补充：Week2 Jumbotron 状态（2026-06-13）

Week2 Jumbotron 已在 `ARY/PoC-GRS-001` 主服务内形成可运行状态：公开入口为 `/jumbotron`，调试入口为 `/jumbotron?debug=1&profile=...`，Calibrator 入口为 `/jumbotron/calibrator` 与 `/jumbotron/calibrator?demo=1`，data evidence endpoint 为 `/api/jumbotron-data-evidence?profile=...`。

当前状态要点：

- 公开大屏聚焦 Race Live View，不展示完整 Coding Agent Session。
- 三套 data profile 已接入 runtime：`curated-full-12`、`smoke-8-visual-low-load`、`coverage-9-enum-complete`。
- mock-data、adapter、lastMessage mapping、validator/status 和 public-hidden evidence 由 cc-data 自行完成，不转交 cc-ARY 代做。
- cc-ARY 负责公开页 UI/runtime：队伍 label bbox 避让、bubble/ticker 降噪、动态态势、领先/追赶/风险叙事、低频现场感动效、focus detail。
- 合作者底图、第二赛道 `real-explicit-closed-course` 和 rider assets 已接入，但语义位置仍来自 `track.profile.json` 与 `track-runtime`，不把图片当成事实来源。
- Calibrator proof / demo walkthrough 已覆盖底图来源、profile 来源、centerline / startFinish / direction / lanes / checkpoints、Validate / Export、runtime 映射链路、鼠标描线、候选导入和可录屏 Demo 路径。
- Calibrator 真实拖拽小闭环已覆盖 centerline point、checkpoint、start/finish handle 与 zone 的 before/current/delta，并保留 SVG proof layer。
- Calibrator asset review 已有 `pending / confirmed / rejected` 三态边界；`real-explicit-closed-course` 已由用户人工确认通过，并作为默认 `/jumbotron` 赛道。
- `debug-preview.png` 已从页面 debug preview 推进为 `/jumbotron/debug-preview.png` 可引用 PNG 证据，包含 centerline、sampled points、message/no-bubble/risk zones、checkpoint 和 collision boxes。
- 当前最新视觉复核包括第二赛道默认赛道、assets integration、轨道重校准、左右朝向、Calibrator proof/drag/asset review/debug-preview；`npm --prefix ./PoC-GRS-001 run verify` 通过，fresh label/bubble metrics 均为 0。

仍需后续复核或交付的内容：

- 最终 3 到 5 分钟 demo video 文件。
- 正式多赛道资产管理流程和后续真实后端聚合。
- 已撤回或未确认的历史候选如 `grandstand-oval`、`nonoval-curve-course` 不能再作为 confirmed 第二赛道；当前默认赛道以 `real-explicit-closed-course` 为准。
- 正式提交前需要重新检查当前工作树、远端身份和 public-hidden 边界。
