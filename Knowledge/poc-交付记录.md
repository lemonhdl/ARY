# PoC 交付记录

## GRS001 提交版 PoC 与录屏交付

当前提交仓库：

`/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang`

核心交付物：

- `ARY-PRD/ary-grs-001-prd.md`：PRD 提交稿。
- `PoC-GRS-001/`：可运行 PoC、数据样例和自动验收脚本。
- `PoC-demo/`：关键技术 PoC 录屏证据和文字说明。
- `riding_record/`：Agent Riding 过程记录和视觉素材 prompt。

PoC 当前证明主线：Race 源数据留在 Organizer 侧，ARY 只读取公开摘要，也能完成 Race 发现、详情展示、参与入口、提交状态和公开结果展示。

录屏 demo 当前包含：

1. `01-organizer-create-disclose.mp4`：Organizer 侧创建 Race 并披露公开字段。
2. `02-public-yard-race-detail.mp4`：ARY Public Yard 和 Race 详情展示公开摘要、状态和入口。
3. `03-local-data-service-cutoff.mp4`：切断 Organizer 本地数据服务后，Team 提交显示数据缺失，过程证据不解锁。
4. `04-restore-submit-result.mp4`：恢复服务后，Team 完成评测，结果进入过程证据页和公开榜单。

当前自动验收结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

## 历史交付物

路径：

`./PoC`

这是一个本地双进程 Demo，用于证明 ARY GRS 001 的数据安全关键假设，并展示 Agent Riding Record 的组织、展示和回放能力。

## 运行方式

终端 1 启动 ARY 平台：

```bash
cd ./PoC
npm start
```

打开：

`http://127.0.0.1:4100`

关键页面：

- `/` Race 首页
- `/records` Agent Riding Records
- `/records/record-session-02` Record 详情
- `/replay/record-session-02` Riding Record 回放
- `/evidence` 提交与评测

终端 2 启动评测进程：

```bash
cd ./PoC
npm run start:organizer
```

评测进程由终端控制启动和关闭，ARY 页面不能控制它。

## 验证方式

```bash
cd ./PoC
npm run verify
```

已验证通过：

```text
VERIFY_PASS ARY PoC participant submission experiment holds
```

## 已通过的检查

- 自动验收通过
- 未提交时不显示评测结果，也不展示 Riding Record 详情和回放内容
- 参赛者提交后才触发评测，并解锁 Records、详情和回放页面
- 三阶段实验通过：数据不可用时提交显示缺失，数据可用时提交显示结果，数据再次不可用后提交重新缺失
- `/`、`/records`、`/records/record-session-02`、`/replay/record-session-02`、`/evidence` 页面可访问
- ARY 页面包含 Riding Record 展示、步骤摘要、过程回放和提交评测流程
- 平台页面不展示内部路径、版本指纹、record id、JSON 快照或服务请求细节
- 平台页面不展示未公开材料、完整协作原文或评审细则
- 页面主线已从普通题解评测改为 Agent Riding Record 展示与回放

## UI 交付状态

当前页面围绕 ARY Agent Riding 语境组织：

- 首页突出 GRS 001 Riding Record、状态和生命周期
- Records 页提交前显示提交引导，提交后展示两条示例 Riding Record
- Record 详情页提交前显示提交引导，提交后展示 Prompt、Agent Output、Steering 和 Riding Signal
- Replay 页提交前显示提交引导，提交后按事件流展示 Agent Riding 过程
- 提交页提供参赛者提交入口，并在提交后展示评测状态
- 页面面向平台用户，不作为内部 debug 工具展示

## 数据边界

评测侧保留：

- 原始赛事材料
- 完整协作记录
- 评审依据
- 未公开项目材料

ARY 页面展示：

- Race 信息
- Riding Record 列表
- 过程摘要
- 回放事件
- 提交状态和评测结果

## Riding Record 去中心化方向

当前 PoC 使用本地示例数据展示 Riding Record、详情和回放，这是为了验证 ARY 的展示与评测能力，不表示未来平台必须集中保存用户的完整 Riding Record。

后续系统设计应倾向于：

- 用户或组织方本地保存完整 Riding Record
- ARY 定义 Riding Record 的数据结构规范
- ARY 提供可在本地运行的读取、评价和回放服务
- 本地服务在授权范围内生成评价输入、公开投影和回放事件
- 平台基于这些投影完成多维评价与展示

因此，平台价值应表达为标准、评价、回放和展示能力，而不是占有完整过程记录。

详细说明见：

`./Knowledge/riding-record-去中心化设计.md`

## PoC_v2 交付状态

路径：

`./PoC_v2`

PoC_v2 在 v1 提交评测闭环上增加登录、组织方视图和多队伍隔离。

已实现账号：

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 组织方 | `Organizer_001` | `********` |
| 队伍 | `team_001` | `******` |
| 队伍 | `team_002` | `**********` |

已实现页面：

- `/login` 登录
- `/organizer` 组织方控制台
- `/team` 队伍首页
- `/team/history` 本队历史
- `/team/history/:sessionId` 本队历史详情
- `/team/submit` 本队提交
- `/team/records` 本队 Records
- `/team/records/:recordId` 本队 Record 详情
- `/team/replay` 本队回放
- `/leaderboard` 赛事榜单

PoC_v2 已覆盖的用例：

- 组织方登录后查看队伍提交摘要和评价维度
- 队伍登录后进入本队工作区
- 队伍可以查看从本地素材整理出的本队历史
- 队伍可以查看历史详情中的目标、Rider 约束、软件搭建过程、关键 Steering 和验证摘要
- 未提交时，本队 Records、详情和回放不开放
- 组织方评测服务不可用时，队伍提交后显示暂时无法完成评测
- 组织方评测服务可用时，队伍提交后开放本队 Records、详情和回放
- 队伍只能看到本队提交、本队历史、本队 Riding Record 和本队回放事件
- 队伍不能访问组织方控制台
- 组织方不能作为队伍进入队伍页面
- 队伍不能通过接口读取其他队伍的提交
- 赛事榜单只展示公开结果，不展示未授权详细内容

验证方式：

```bash
cd ./PoC_v2
npm run verify
```

已验证通过：

```text
VERIFY_PASS ARY PoC_v2 role boundary holds
```

本次实现过程记录：

`./coding-agent-sessions/session-03-poc-v2-claude-code.md`
`./coding-agent-sessions/session-04-rider-history-session.md`

DevCompass 方向：

- 当前 PoC_v2 使用回放记录样例，不读取真实本地目录
- 回放记录整理目标、Rider 动作、Agent 工作、产物变化、验证结果和修复节点
- 后续 DevCompass 可下载安装到 Rider 本地，把本地所有 `*/.claude` 作为素材库
- DevCompass 从本地素材中整理目标、关键指令、Steering、验证动作和回放事件
- 完整历史保留在 Rider 本地，ARY 接收整理后的回放记录和评价结果

## 实验性证明

`/evidence` 页面提供参赛者提交入口。示例提交内容：

```text
满分答案
```

三种状态：

1. 未提交：页面显示还没有评测结果。
2. 只启动 ARY，不启动评测进程，提交后页面提示数据缺失。
3. 启动评测进程，提交后页面收到 mock 评测结果 `这个小组的解答测评结果为:满分!`。
4. 关闭评测进程，再次提交后页面再次提示数据缺失。

这个实验比单纯文件列表更直接：平台不能控制评测进程，只能在参赛者提交后尝试完成评测。评测能力不可用后，平台没有本地持久化数据可继续产生结果。

## 设计说明

完整赛事材料、完整协作记录和评审依据留在评测侧。

ARY 页面只展示：

- Race 信息
- Riding Record 列表
- 过程摘要
- 回放事件
- 提交状态和评测结果

这样既能展示和回放 Agent Riding 过程，也能避免把未公开材料放入平台页面。

## 演示材料

演示脚本：

`./PoC/DEMO_SCRIPT.md`

项目说明：

`./PoC/README.md`

构建回放记录：

`./coding-agent-sessions/session-02-claude-code.md`

## 当前验证范围

当前 PoC 验证的是：

- Agent Riding Record 可以被 ARY 组织和展示
- Riding Record 可以通过事件流回放
- 平台页面不展示内部调试信息
- 未提交时不会出现评测结果
- 参赛者提交后才触发评测
- 数据可用时，提交会得到 mock 评测结果
- 数据不可用时，提交会提示数据缺失

## Week2 Jumbotron 当前交付状态（2026-06-13）

内部仓库 `ARY/PoC-GRS-001` 已把 Week2 Jumbotron 主线接入现有 PoC 服务，当前证明重点从第一周的数据边界扩展为“可信赛事大屏 / 可校准赛道资产 / data profile 可复验”。

当前可运行入口：

```bash
npm --prefix ./PoC-GRS-001 start
```

常用页面与 endpoint：

```text
http://127.0.0.1:4400/jumbotron
http://127.0.0.1:4400/jumbotron?profile=full
http://127.0.0.1:4400/jumbotron?profile=smoke-8
http://127.0.0.1:4400/jumbotron?profile=coverage-9
http://127.0.0.1:4400/jumbotron?debug=1&profile=full
http://127.0.0.1:4400/jumbotron/calibrator
http://127.0.0.1:4400/jumbotron/calibrator?demo=1
http://127.0.0.1:4400/jumbotron/debug-preview.png
http://127.0.0.1:4400/api/jumbotron-data-evidence?profile=full
```

已完成的 Week2 Jumbotron 交付状态：

- `/jumbotron` 默认公开 Race Live View：Header / KPI Strip / 主赛道 / TOP3 / 现场播报 ticker / focus detail 已接入，默认赛道为已人工确认的 `real-explicit-closed-course`。
- `profile=full|smoke-8|coverage-9` 已接入 runtime，分别对应完整压力 profile、低负载视觉 smoke profile、enum coverage/debug profile。
- `/jumbotron?debug=1&profile=...` 与 `/api/jumbotron-data-evidence?profile=...` 已展示 dataProfileId、counts、motion/message coverage、publicHiddenFields、validatorStatus 与 lastMessage mapping evidence。
- `/jumbotron/calibrator` 已形成 Track Profile Calibrator proof / demo walkthrough：展示底图来源、profile 来源、centerline / startFinish / direction / lanes / checkpoints 证据，以及 `progress → centerline distance → point/rotation → laneOffset → displayAdjustment` 运行链路。
- `/jumbotron/calibrator?demo=1` 已提供可录屏的 Demo 路径，覆盖公开大屏、多个 Racing Entry、TOP3/KPI/message/risk、Calibrator、Validate/Export、profile 进入 runtime 和 PoC 边界说明。
- Calibrator drag proof 已覆盖 centerline point、checkpoint、start/finish handle 与 zone 的 before/current/delta，并保留 SVG proof layer 证据。
- Calibrator asset review 已有 `pending / confirmed / rejected` 三态：pending 不自动进入正式资产，rejected 不得进入正式大屏资产流程，confirmed 明确需要 human review 边界。
- 第二赛道 `real-explicit-closed-course` 资产已由用户人工确认通过，并作为默认 `/jumbotron` 赛道；`/jumbotron?profile=full&track=default-public-track` 仍保留旧公开赛道显式切换入口。
- Calibrator 已融合鼠标描线模式、候选导入、自动尖角修复证据和 candidate direct view；`/jumbotron/calibrator?candidate=real-explicit-closed-course` 使用受控 candidate asset route 与 1672×941 viewBox。
- `/jumbotron/debug-preview.png` 已提供可引用 PNG 证据，包含 centerline、sampled points、messageZones / noBubbleZones / riskZones overlay、checkpoint 和 preview horse collision boxes。
- Race Live View 已使用合作者 `background1.png`、第二赛道 `background.webp` 和 `rider3_run/walk/stay` 动态人马 sprite；位置仍由 `track.profile.json`、centerline、lane offset 和 runtime pose 驱动。
- 人马 sprite 已限制为按轨道切向左右翻转，文字、编号、状态 pill 不镜像；fresh HTML 同时包含 `data-facing="left"` 与 `data-facing="right"`。
- public/debug/API 均保持边界：不输出 raw `targetUrl`、raw `remoteCockpitUrl`、完整 Session log、private path、复杂 diff 或内部评分细则。

当前验证摘要：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
full validator: pass / 0 warnings
smoke-8 validator: pass_with_expected_warnings / 5 expected warnings
coverage-9 validator: pass / 0 warnings
fresh /jumbotron label metrics: label=0, marker=0, bubble=0, out-of-viewbox=0
fresh /jumbotron/calibrator: 200
fresh /jumbotron/calibrator?demo=1: 200
fresh /jumbotron/debug-preview.png: 200 image/png, PNG signature valid
```

仍不能伪装完成的项：最终 3 到 5 分钟 demo video 文件、正式多赛道资产管理流程和后续真实后端聚合。已撤回或未确认的历史候选如 `grandstand-oval`、`nonoval-curve-course` 不能再作为 confirmed 第二赛道；当前默认赛道以 `real-explicit-closed-course` 为准。

当前远端内部仓库 `lemonhdl/ARY` 的 `main` 已更新到 `865893e6572bba232da8fcd88e2f6c7dc34b63cc`（`Update Week2 Jumbotron review records`）。后续若继续提交，需要再次检查 remote、GitHub 账号和当前工作树状态。
