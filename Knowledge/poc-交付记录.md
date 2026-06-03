# PoC 交付记录

## 当前交付物

路径：

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC`

这是一个本地双进程 Demo，用于证明 ARY GRS 001 的数据安全关键假设，并展示 Agent Riding Record 的组织、展示和回放能力。

## 运行方式

终端 1 启动 ARY 平台：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC
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
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC
npm run start:organizer
```

评测进程由终端控制启动和关闭，ARY 页面不能控制它。

## 验证方式

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC
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

`/media/lemonhdl/Shared/Software_Engineering/ARY/Knowledge/riding-record-去中心化设计.md`

## PoC_v2 交付状态

路径：

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2`

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
- `/team/submit` 本队提交
- `/team/records` 本队 Records
- `/team/records/:recordId` 本队 Record 详情
- `/team/replay` 本队回放
- `/leaderboard` 赛事榜单

PoC_v2 已覆盖的用例：

- 组织方登录后查看队伍提交摘要和评价维度
- 队伍登录后进入本队工作区
- 未提交时，本队 Records、详情和回放不开放
- 组织方评测服务不可用时，队伍提交后显示暂时无法完成评测
- 组织方评测服务可用时，队伍提交后开放本队 Records、详情和回放
- 队伍只能看到本队提交、本队 Riding Record 和本队回放事件
- 队伍不能访问组织方控制台
- 组织方不能作为队伍进入队伍页面
- 队伍不能通过接口读取其他队伍的提交
- 赛事榜单只展示公开结果，不展示未授权详细内容

验证方式：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2
npm run verify
```

已验证通过：

```text
VERIFY_PASS ARY PoC_v2 role boundary holds
```

本次实现过程记录：

`/media/lemonhdl/Shared/Software_Engineering/ARY/coding-agent-sessions/session-03-poc-v2-claude-code.md`

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

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC/DEMO_SCRIPT.md`

项目说明：

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC/README.md`

构建回放记录：

`/media/lemonhdl/Shared/Software_Engineering/ARY/coding-agent-sessions/session-02-claude-code.md`

## 当前验证范围

当前 PoC 验证的是：

- Agent Riding Record 可以被 ARY 组织和展示
- Riding Record 可以通过事件流回放
- 平台页面不展示内部调试信息
- 未提交时不会出现评测结果
- 参赛者提交后才触发评测
- 数据可用时，提交会得到 mock 评测结果
- 数据不可用时，提交会提示数据缺失
