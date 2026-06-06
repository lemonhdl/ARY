# ARY PoC_v2

PoC_v2 在 v1 提交评测闭环上增加登录、组织方视图和多队伍隔离。

## 运行

终端 1 启动 ARY：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2
npm start
```

打开：

`http://127.0.0.1:4400`

终端 2 启动组织方评测服务：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2
npm run start:organizer
```

如果不启动组织方评测服务，队伍提交后会显示暂时无法完成评测，Records 和回放不会开放。

## 开发账号

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 组织方 | `Organizer_001` | `********` |
| 队伍 | `team_001` | `******` |
| 队伍 | `team_002` | `**********` |

这些账号只用于本地演示。

## 页面

- `/login` 登录
- `/organizer` 组织方总览
- `/organizer/race` 组织方 Race 管理
- `/organizer/evaluation` 组织方评价工作台
- `/team` 队伍驾驶舱
- `/team/race` 队伍 Race 指南
- `/team/evaluation` 队伍提交前自查
- `/team/history` 本队历史
- `/team/history/:sessionId` 本队历史详情
- `/team/submit` 本队提交
- `/team/records` 本队 Records
- `/team/records/:recordId` 本队 Record 详情
- `/team/replay` 本队回放
- `/leaderboard` 赛事榜单

## 已覆盖用例

组织方：

- 登录后进入组织方总览，只看到赛事状态、队伍提交、核心指标和下钻入口
- 从组织方总览进入 Race 管理，查看训练场与竞技场闭环：创建、披露、组织、运行、评审、展示
- 从组织方 Race 管理查看 Organizer 持有原始赛事资料、队伍可见范围和公开展示范围
- 从组织方评价工作台查看多维评价维度和优秀作品七维评价
- 查看榜单展示内容
- 不能作为队伍进入队伍页面

队伍：

- 登录后进入本队驾驶舱，首屏只看到当前状态、核心指标、下一步主行动和下钻入口
- 在队伍驾驶舱进入 Race 指南、提交前自查、历史、提交、Records、Replay 和公开榜单
- 在队伍 Race 指南中看到 Race Flow 从组队到复盘：Race Brief、Team Build、工具准备、Riding Plan、Co-Riding、Checkpoint、Submission、Review & Replay，并看到每步对应产出
- 在队伍 Race 指南中看到 Race Deliverables 交付物检查：产品定义、系统设计、技术验证、方案展示和 Riding Record，并优先检查过程摘要与交付质量
- 在队伍 Race 指南中看到 Ready to Ride 行动入口：确认身份、开始本轮 Race、完成骑行闭环和沉淀下一步
- 在队伍提交前自查中看到真实项目、指导成长、展示能力和未来身份四段 Race 主线
- 在队伍提交前自查中看到优秀作品七维评价雷达图：问题定义、产品逻辑、数据主权、关键假设验证、架构边界、展示可理解和协作可复盘，并按证据逐项判断
- 在队伍提交前自查中看到本队可见摘要与原始资料不默认进入 ARY 展示的边界
- 在队伍提交前自查中看到从 Coder 产出指标转向 Rider 能力指标的对照
- 在队伍提交前自查、历史详情、Records 和 Replay 中看到 DevCompass Racing 的指导证据：目标描述、任务拆解、方向检查、方案判断、架构理解和可执行计划
- 在队伍提交前自查、历史详情、Record 详情和 Replay 中看到 Review & Replay 复盘路径：计划、执行、检查、复盘、提升，以及本轮学到什么和下轮怎么改
- 在 Records、Record 详情、Replay 和公开榜单中看到能力档案：Race 完赛状态、项目作品、Riding Replay 过程记录、能力标签、公开评语和可推荐边界
- 在队伍提交前自查、Replay 和公开榜单中看到赛事身份与赛道状态：身份感、未来感、竞技感、历史整理、提交评测、Records 解锁和公开展示
- 在队伍 Race 指南、组织方 Race 管理和公开榜单中看到课堂首发与 Genesis Riders：报名进入、组队骑行、提交复盘、公开展示
- 在组织方 Race 管理和公开榜单中看到资料安全 Race 证明：Organizer 侧存留、公开侧最小承载、仍可组织、主动披露公开摘要
- 在队伍提交前自查、历史详情、Record 详情和 Replay 中看到 Agent Riding Skill 训练证据：目标设定、技术判断、任务拆解、架构理解、过程观察和方向干预
- 查看从本地素材整理出的本队多阶段历史，team_001 当前覆盖项目讨论、可运行验证、角色边界、Race 体验和驾驶舱分层
- 提交通过后查看从多阶段历史整理出的多份本队 Records
- 查看历史详情中的目标、Rider 约束、软件搭建过程、关键 Steering 和验证摘要
- 在历史详情、Record 详情和 Replay 中查看目标清晰、Agent 行动、干预验收和能力复盘证据
- 未提交时不能查看 Records、详情和回放
- 未提交时不能通过回放接口取得本队回放事件
- 伪造提交状态不能解锁 Records 或回放接口
- 提交但组织方评测服务不可用时显示暂时无法评测
- 组织方评测服务可用时，提交后开放本队 Records、详情、回放和回放接口
- 队伍只能看到本队提交、Riding Record、历史和回放事件
- 队伍不能访问组织方控制台
- 队伍不能通过接口读取其他队伍提交

DevCompass：

- 当前使用回放记录样例，不读取真实本地目录
- 回放记录包含目标、Rider 动作、Agent 工作、产物变化、验证结果和修复节点
- 后续方向是下载安装到 Rider 本地，读取本地 `*/.claude` 作为素材库
- 完整历史保留在 Rider 本地，ARY 接收 Rider 整理后的回放记录

公开展示：

- 榜单只展示队伍、名次、等级和公开评语
- 榜单把公开结果表达为作品资产和能力摘要
- 页面不展示本地路径、内部文件名、受保护存储名和过细评审材料

## 验证

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2
npm run verify
```

期望输出：

```text
VERIFY_PASS ARY PoC_v2 role boundary holds
```
