# Session 05：GRS001 PoC 重构

## Step 1：读取作业提交仓库

用户提供本次 ARY 作业提交仓库：

- `https://github.com/sysu-se/ary-grs-001-sinbawang`

Claude Code 将仓库拉取到本地：

- `/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang`

首次 `git clone` 因 GitHub 443 连接失败中断，随后通过 `gh repo view` 和 `gh api repos/sysu-se/ary-grs-001-sinbawang/readme` 成功读取仓库信息与 README，之后 `gh repo clone` 完成本地拉取。

## Step 2：提取 README 评分核心

README 的主命题是：

> 在 Race 数据存留于 Organizer 侧、ARY 不持久化 Race 数据的前提下，ARY 仍然可以完成赛事的创建、披露、组织与展示。

硬性入围门槛：

1. 不违背 ARY 的数据主权原则。
2. 有可解释的 Product Definition。
3. 有关键技术 PoC。
4. 提交 Riding Record。

评分权重集中在：

- 问题理解与产品定义：15 分
- 去中心化数据主权与系统架构：20 分
- 关键技术 PoC 有效性：25 分
- 赛事创建、披露、组织、展示体验：10 分
- Agent Riding Skill 与过程质量：20 分
- 文档、表达：10 分

本轮判断：现有 PoC_v2 功能很多，但主证明线被 Records、Replay、自查、评价、榜单等内容冲淡。GRS001 提交版应收敛到“Public Yard / Private Race Source”这一条证明链路。

## Step 3：审视现有 PoC_v2

当前 PoC_v2 已覆盖：

- 登录与角色分流
- 组织方视图
- 队伍驾驶舱
- Race 指南
- 提交前自查
- Rider 历史
- Records
- Replay
- 榜单
- 组织方评测服务
- team_001 / team_002 隔离
- 自动验收

主要问题：

1. `src/server.js` 过大，路由、权限、HTML、CSS、数据读取和业务逻辑混在一起。
2. 页面数量多，但评委第一眼不一定知道 PoC 要证明什么。
3. 自动验证依赖大量页面文案断言，后续修改文案容易误伤。
4. 产品表达有时像评分标准或内部系统设计说明，而不是帮助用户完成当前任务。
5. Rider 过程证据需要避免被理解为 ARY 默认抓取完整本地日志。

## Step 4：确定重构方向

用户同意新建重构版，不直接破坏现有 PoC_v2。

重构方向：

> 将 PoC 从“多页面赛事平台”重构为“Public Yard / Private Race Source 证明型 PoC”。

新的证明链：

1. Organizer 持有 Race 源数据。
2. Organizer 主动披露公开摘要。
3. ARY 只读取公开披露。
4. ARY 可以展示 Race、组织入口、处理提交状态。
5. Organizer 数据不可用时，ARY 显示数据缺失，不能伪造评分。
6. Rider 提交的是整理后的 Riding Record 摘要，不是完整本地历史。

## Step 5：计划新建 PoC_grs001

新目录：

- `/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_grs001`

建议页面结构：

- Race Discovery：公开 Race 发现页
- Race Detail / Public Disclosure：公开披露详情页
- Organizer Console：Organizer 私有源数据与披露控制台
- Rider Submit：方案摘要 + Riding Record 摘要
- Review Status：等待评测、数据缺失、评分完成
- Riding Evidence：过程证据，不做完整本地历史展示

建议数据分层：

- `organizer-private/`：Race 源数据、评测策略、运行状态
- `ary-public-store/`：公开披露摘要、Race 索引、公开榜单
- `rider-evidence-store/`：Riding Record、Rider session 摘要、Replay events

验证重点：

1. ARY 只展示公开披露内容。
2. Organizer 数据不可用时不能完成评分。
3. Race 下线或披露失效后，ARY 不继续开放入口。
4. team_001 和 team_002 的过程证据不串队。
5. 页面不展示内部路径、完整本地历史、私有评测逻辑和实现细节。

## Step 6：下一步

下一步进入实现：

1. 基于 PoC_v2 初始化 `PoC_grs001`。
2. 优先收敛页面与数据模型，而不是继续堆功能。
3. 改写验证脚本为场景验收。
4. 准备作业仓库结构：`README.md`、`docs/`、`poc/`、`evidence/`。

## Step 7：第一轮重构实现

已创建独立重构目录：

- `/media/lemonhdl/Shared/Software_Engineering/ARY/PoC_grs001`

本轮改动：

1. 新增 Organizer 私有源数据：
   - `organizer-private/race_source.json`
   - 记录完整 Race brief、私有材料、公开字段、披露版本和评测依赖。

2. 新增 ARY 公开披露数据：
   - `ary-public-store/public_disclosures.json`
   - 公开页只读取 Race 名称、公开目标、公开要求、公开状态和披露时间。

3. 收敛公开数据和过程证据：
   - `ary-public-store/races.json`
   - `ary-public-store/teams.json`
   - `ary-public-store/leaderboard_projection.json`
   - `ary-protected-store/submissions.json`
   - `ary-protected-store/riding_records.json`
   - `ary-protected-store/rider_sessions.json`
   - `ary-protected-store/replay_events.json`

4. 重写主服务：
   - `src/server.js`
   - 页面收敛为 `/yard`、`/race/grs-001`、`/organizer`、`/organizer/race`、`/team`、`/team/submit`、`/team/records`、`/leaderboard`。
   - 登录页只保留登录动作。
   - Team 页面只展示本队过程证据。
   - Organizer 页面展示源数据状态和评测可用性。

5. 重写 Organizer 评测服务：
   - `src/organizer-server.js`
   - 评分依赖方案摘要和 Riding Record 摘要。
   - 主服务中通过 `evaluator_service.json` 控制“数据缺失，暂无法评分”。

6. 重写验收脚本：
   - `src/verify.js`
   - 从多页面文案断言改为场景验收：公开披露、私有源数据、数据缺失、队伍隔离、过程证据边界。

验证结果：

```text
VERIFY_PASS GRS001 Public Yard / Private Race Source scenario holds
```

实现中发现并修正的页面表达问题：

- 未登录页不应出现公开导航中的“榜单”。
- Rider 过程证据页不应出现“完整本地历史”。
- Rider 过程证据页不应出现“内部评分口径”。
- 产品页不应出现 `PoC`。

当前状态：

- `PoC_grs001` 已能通过自动验收。
- 下一步准备作业仓库结构，把通过验证的版本复制到 `ary-grs-001-sinbawang/poc/`，并补齐 README、docs 和 evidence。

## Step 8：准备作业仓库提交结构

已将通过验证的 GRS001 版本复制到作业仓库：

- `/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/poc`

新增作业文档：

- `docs/product-definition.md`
- `docs/architecture.md`
- `docs/poc-walkthrough.md`
- `docs/riding-record.md`

新增验证证据：

- `evidence/verify-output.txt`

重写作业仓库入口 README：

- `/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/README.md`

README 现在直接说明：

1. 本提交证明什么。
2. 如何运行。
3. 如何按演示路径检查 Organizer 数据可用性。
4. 如何验证。
5. 文档和证据在哪里。

作业仓库内验证结果：

```text
VERIFY_PASS GRS001 Public Yard / Private Race Source scenario holds
```

当前 `git status --short` 显示：

```text
 M README.md
?? docs/
?? evidence/
?? poc/
```

尚未提交。下一步如果用户要求提交，再按作业提交节奏创建 commit。
