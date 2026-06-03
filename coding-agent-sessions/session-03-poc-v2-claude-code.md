# Session 03：PoC_v2 登录、组织方与队伍隔离

## 目标

基于已有 ARY PoC，自主搭建 PoC_v2。

本轮目标：

- 实现 mock 登录
- 支持组织方登录和队伍登录
- 组织方账号 `Organizer_001`，密码 `********`
- 队伍账号 `team_001`，密码 `******`
- 队伍账号 `team_002`，密码 `**********`
- 登录后进入不同角色页面
- 队伍以 team 为数据边界
- 分析并实现不同队伍之间的数据安全用例
- 用“场景 -> 角色 -> 职责 -> 用例”持续发现和推进 PoC_v2

## Step 1：建立任务边界

### Prompt

用户要求充分利用已有上下文和蜂群，自主搭建 PoC_v2。要求实现用户登录和组织方登录，可以使用 mock implementation，不需要数据库核验身份。组织方和两个队伍使用固定账号密码。需要自主探索组织方用例，并考虑不同队伍之间的数据安全引申出的用例。

### Agent Output

先拆成五个任务：

1. 梳理 PoC_v2 角色用例
2. 探索现有 PoC 结构
3. 记录 PoC_v2 Riding 过程
4. 实现 PoC_v2 登录和页面
5. 验证 PoC_v2 行为

同时启动子代理并行分析：

- 现有 PoC 结构
- 场景、角色、职责、用例
- 队伍隔离和数据边界

### Steering

本轮没有人工纠偏。沿用已有 ARY 约束：不能把 PoC 做成普通 OJ，要体现 Agent Riding、Riding Record、数据边界和组织方/参赛者角色差异。

### Result

确认 PoC_v2 的优先级：

- P0 mock 登录和角色分流
- P1 队伍私有提交列表与权限校验
- P2 组织方总览和评测触发
- P3 公开榜单投影
- P4 安全证据页面

## Step 2：读取现有 PoC 结构

### Prompt

读取现有 PoC 的核心服务、存储和验证脚本，判断 PoC_v2 应如何复用。

### Agent Output

已确认现有 PoC：

- `src/start.js` 是 ARY 平台入口
- `src/ary-server.js` 是主页面和 API 路由
- `src/organizer-server.js` 是组织方 mock 服务
- `src/storage.js` 负责 JSON 文件读写
- `src/verify.js` 是自动验收脚本
- `ary-public-store/` 保存公开投影
- `organizer-private/` 保存组织方私有材料
- `ary-protected-store/` 保存受保护的提交数据

### Steering

为避免破坏已完成的 PoC，PoC_v2 使用新目录，不直接覆盖 `/ARY/PoC`。

### Result

决定新建：

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2`

PoC_v2 会复用原生 Node HTTP 服务风格和 JSON 存储方式，但重新组织登录、角色页面、队伍数据隔离和验证脚本。

## Step 3：场景、角色、职责、用例分析

### Prompt

在实现前分析组织方和队伍各自的职责，尤其关注 team_001 和 team_002 之间的数据安全。

### Agent Output

整理出四组场景：

| 场景 | 角色 | 职责 | 用例 |
| --- | --- | --- | --- |
| 登录与分流 | 组织方、队伍 | 进入对应工作区 | mock 登录、错误密码拒绝、退出登录 |
| 组织方管理 | Organizer_001 | 维护 Race、查看汇总、维护评价维度 | 查看全队提交摘要、查看多维评价维度、查看数据边界说明 |
| 队伍参赛 | team_001、team_002 | 查看本队提交和回放 | 查看本队首页、本队提交、本队 Replay |
| 数据安全 | 系统 | 服务端过滤角色和 teamId | 队伍不能访问组织方页，队伍不能读其他队伍 submissionId，公开榜单只展示授权投影 |

### Steering

把登录做成 mock，但不要把“安全”误解成只靠前端隐藏。即使是 PoC，也要让服务端 API 按 session 的 role 和 teamId 过滤数据。

### Result

确定 PoC_v2 的核心证明：

- Organizer_001 能看到全队汇总
- team_001 只能看到 team_001 数据
- team_002 只能看到 team_002 数据
- 两队不能通过 URL 或 API 越权读取对方提交
- 榜单只展示公开投影

## Step 4：实现 PoC_v2

### Prompt

搭建独立 PoC_v2，保持原 PoC 不被覆盖。

### Agent Output

新建目录：

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2`

主要文件：

- `package.json`
- `src/storage.js`
- `src/server.js`
- `src/start.js`
- `src/verify.js`
- `ary-public-store/races.json`
- `ary-public-store/teams.json`
- `ary-public-store/users.json`
- `ary-public-store/leaderboard_projection.json`
- `ary-protected-store/submissions.json`
- `ary-protected-store/riding_records.json`
- `ary-protected-store/replay_events.json`
- `organizer-private/evaluation_policy.json`
- `organizer-private/data_boundary_policy.json`
- `README.md`

实现内容：

- `/login` mock 登录
- `Organizer_001` 登录后进入 `/organizer`
- `team_001` 和 `team_002` 登录后进入 `/team`
- `/team/submissions` 只展示本队提交
- `/team/replay` 只展示本队 Riding Record 事件
- `/organizer` 展示全队汇总和多维评价维度
- `/leaderboard` 展示公开榜单投影
- `/security-evidence` 展示角色和队伍数据边界
- `/api/submissions/:id` 按角色和 teamId 做服务端鉴权
- `/api/my-submissions` 只返回本队提交
- `/api/team-replay` 只返回本队回放事件

### Steering

实现时做了两次收窄：

1. 公开 `users.json` 不保存 mock 密码，密码只留在服务端逻辑中。
2. 安全证据页面不展示内部文件名、本地路径和过细的私有材料原文。

### Result

PoC_v2 已能本地运行：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2
npm start
```

打开：

`http://127.0.0.1:4300`

## Step 5：自动验收和修正

### Prompt

运行验证脚本，检查登录、角色分流、队伍隔离、组织方视图和公开页面边界。

### Agent Output

新增验证脚本：

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2/src/verify.js`

覆盖断言：

- 登录页可访问
- 错误密码被拒绝
- Organizer_001 登录后进入 `/organizer`
- team_001 和 team_002 登录后进入 `/team`
- 组织方可以看全队汇总
- 组织方不能作为队伍访问队伍页面
- 队伍不能访问组织方控制台
- team_001 页面不出现 team_002 的提交和 Record
- team_002 页面不出现 team_001 的提交和 Record
- team_001 replay 不出现 team_002 事件
- team_002 replay 不出现 team_001 事件
- team_001 不能通过 API 读取 team_002 submissionId
- team_002 不能通过 API 读取 team_001 submissionId
- 组织方可以通过 API 查看队伍提交摘要
- 匿名 API 访问被拒绝
- 页面不暴露内部文件名、本地路径和受保护存储名

第一次验证失败：榜单断言还在查内部字段名 `scoreBand`。

修正：页面展示的是 `excellent` 等公开等级值，验证脚本改为检查公开等级值。

第二次验证失败：榜单文案中出现“提交原文”，验证把说明性文字也识别为敏感词。

修正：榜单文案改成“不展示未授权详细内容”。

### Result

最终验证通过：

```text
VERIFY_PASS ARY PoC_v2 role boundary holds
```

## Step 6：收敛页面可见字段

### Prompt

复查 PoC_v2 页面是否暴露过细的内部标识。

### Agent Output

发现队伍提交页一度展示了 `submissionId`。这对 API 越权验证有用，但不适合作为参赛者页面字段。

### Steering

把 `submissionId` 从队伍页面移除。保留 API 路径中的 submissionId，用于证明即使知道对方 ID，也不能读取其他队伍提交。

### Result

修改后再次运行：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2 run verify
```

通过：

```text
VERIFY_PASS ARY PoC_v2 role boundary holds
```

## Step 7：用户批评后的反思

### Prompt

用户截图指出登录页把可用账号、密码约定、角色分流、mock 登录和 PoC 解释直接展示在页面上，并要求反思。随后用户追问为什么没有继承 PoC v1 的功能。

### Agent Output

蜂群反思后确认两个问题：

1. 页面话术问题

我把开发者为了调试和说明 PoC 的信息直接放进用户页面，包括 mock、PoC、可用账号、密码提示、角色分流、授权投影、数据边界等。这让页面像内部演示台，不像可交付平台。

2. 功能继承问题

我把 v2 当成一个新的登录隔离 Demo，而不是 v1 的增量版本。v1 已经具备提交评测、Organizer 可用性实验、提交后解锁 Records、详情、Replay、数据缺失状态和安全展示边界。v2 初版只做了登录、组织方视图和队伍隔离，丢掉了 v1 的核心闭环。

### Steering

修正原则：

- v2 必须继承 v1 的核心产品闭环
- 登录和队伍隔离是增量能力，不是替代 v1
- 开发提示、账号说明、mock 实现细节只能放 README 或验证脚本，不进入用户页面
- 页面面向平台用户，只展示用户需要完成的任务和结果

### Result

完成页面话术收敛：

- 登录页不再展示可用账号和密码
- 页面不再出现 mock、PoC、Demo、固定账号、不接数据库等开发话术
- 页面不再出现 submissionId、URL、API、服务端、授权投影等内部表达
- 榜单改成赛事榜单
- 安全证据页改成访问说明

## Step 8：继承 v1 功能并保留 v2 隔离

### Prompt

把 v1 的提交评测和提交后解锁能力补回 PoC_v2，同时保留组织方和队伍登录隔离。

### Agent Output

新增：

- `src/organizer-server.js`
- `src/start-organizer.js`
- `npm run start:organizer`
- `/team/submit`
- `/team/records`
- `/team/records/:recordId`

修复后的流程：

1. 队伍登录后进入本队首页
2. 未提交时 Records、详情、Replay 都显示提交引导
3. 队伍在 `/team/submit` 提交内容
4. 组织方评测服务未启动时，提交显示暂时无法完成评测，不解锁 Records
5. 组织方评测服务启动后，提交显示评测完成，并写入本队解锁 cookie
6. 解锁只对当前 team 生效
7. team_001 解锁后仍不能查看 team_002 的 Record 和 Replay
8. team_002 不会继承 team_001 的解锁状态
9. 组织方仍可查看全队汇总，但不能作为队伍进入队伍页面

### Steering

保留 v1 的核心证明：评测能力依赖组织方服务，不在平台侧凭空生成结果。保留 v2 的新增证明：队伍级别的内容访问按身份隔离。

### Result

最终验证命令：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2 run verify
```

最终通过：

```text
VERIFY_PASS ARY PoC_v2 role boundary holds
```

## Step 9：移除访问说明页

### Prompt

用户截图指出 `/security-evidence` 访问说明页不应该存在。页面把权限模型、数据范围、组织方/队伍/榜单可见内容做成了产品页面。

### Agent Output

确认问题：

- 这页是评审和开发验证需要的说明，不是用户要完成的任务
- 它把系统设计和数据安全证明直接暴露给用户
- 即使用词已经从“数据边界”收敛成“访问说明”，页面本身仍然不该存在
- 正确做法是通过页面行为体现访问限制：看不到入口、看不到其他队伍内容、未提交时锁定、越权接口返回拒绝

### Steering

删除用户入口和页面，不再试图把说明文案改得更像产品页面。

### Result

已移除：

- 导航中的 `访问说明`
- `/security-evidence` 页面路由
- `renderSecurityEvidence`
- `/api/boundary`
- README 和知识库中的页面入口说明

验证脚本改为检查：

- 导航不出现 `访问说明`
- `/security-evidence` 返回 404
- 其他登录、提交、评测、解锁和队伍隔离流程仍通过

验证结果：

```text
VERIFY_PASS ARY PoC_v2 role boundary holds
```

## Step 10：当前开发过程收口

### Prompt

用户要求更新 `/media/lemonhdl/Shared/Software_Engineering/ARY/coding-agent-sessions` 的开发过程记录，并强调要记录开发过程，不是记录反思。

### Agent Output

本轮继续修改 PoC_v2，实际开发动作如下。

1. 更新页面入口

修改文件：

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2/src/server.js`

改动：

- 登录页只保留账号、密码和进入按钮
- 组织方导航保留 `/organizer` 和 `/leaderboard`
- 队伍导航保留 `/team`、`/team/submit`、`/team/records`、`/team/replay`、`/leaderboard`
- 删除导航中的 `/security-evidence`

2. 增加组织方评测服务

新增文件：

- `/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2/src/organizer-server.js`
- `/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2/src/start-organizer.js`

更新文件：

- `/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2/package.json`
- `/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2/src/start.js`

改动：

- 增加 `npm run start:organizer`
- ARY 主服务默认使用 4400 端口
- 组织方评测服务默认使用 4401 端口
- 队伍提交会请求组织方评测服务
- 组织方评测服务未启动时，提交显示暂时无法完成评测
- 组织方评测服务启动后，提交返回评测结果

3. 增加队伍提交和解锁流程

修改文件：

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2/src/server.js`

新增路由：

- `GET /team/submit`
- `POST /team/submit`
- `GET /team/records`
- `GET /team/records/:recordId`

改动：

- 未提交时 `/team/records` 显示提交引导
- 未提交时 `/team/replay` 显示提交引导
- 提交评测成功后写入本队 cookie
- 本队 cookie 只解锁当前队伍的 Records、详情和 Replay
- team_001 的提交不会解锁 team_002

4. 删除访问说明页

修改文件：

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2/src/server.js`

删除：

- `GET /security-evidence`
- `renderSecurityEvidence`
- `GET /api/boundary`
- 导航中的 `访问说明`

5. 更新验证脚本

修改文件：

`/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2/src/verify.js`

新增检查：

- 登录页不出现权限、队伍、组织方、提交、评价、回放、数据等说明性内容
- 未提交时 Records 和 Replay 锁定
- 未启动组织方评测服务时提交不解锁
- 启动组织方评测服务后提交成功并解锁
- team_001 解锁后 team_002 仍未解锁
- team_001 看不到 team_002 的 Record 和 Replay
- `/security-evidence` 返回 404
- 导航不出现 `访问说明`

6. 更新说明文件

修改文件：

- `/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2/README.md`
- `/media/lemonhdl/Shared/Software_Engineering/ARY/Knowledge/poc-交付记录.md`

改动：

- 记录两个启动命令
- 更新页面列表
- 删除 `/security-evidence` 页面说明
- 更新 PoC_v2 已覆盖用例

### Steering

后续记录以开发动作、文件路径、路由变化和验证结果为主。反思可以保留在前面的 Step 7、Step 9，不在本步骤重复。

### Result

当前稳定页面：

- `/login`
- `/organizer`
- `/team`
- `/team/submit`
- `/team/records`
- `/team/records/:recordId`
- `/team/replay`
- `/leaderboard`

当前启动方式：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2
npm start
```

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2
npm run start:organizer
```

最终验证：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2 run verify
```

```text
VERIFY_PASS ARY PoC_v2 role boundary holds
```

