# session 10：Public Yard / Private Race Source 重构

## Agent Riding Skill 证据摘要

- Plan：按作业 README 重排提交版 PoC，不继续堆功能，优先证明 Organizer 私有源数据与 ARY 公开披露分离。
- Observation：PoC_v2 功能很多，但主证明链被 Records、Replay、自查、评价和榜单冲淡，评审不一定能第一眼看出 GRS001 要证明什么。
- Steering：用户同意新建 PoC_grs001，保留 PoC_v2，不用破坏已有版本；后续又要求 UI 面向观众，而不是内部设计说明页。
- Validation：验收覆盖公开披露、数据缺失、待更新和下线状态、队伍隔离、Replay actor、人-Agent 分工，以及页面敏感词和内部信息扫描。
- Review：第二轮优化发现 Riding Evidence 还不够显性，于是补计划、观察、干预、验收、复盘，并把视觉 prompt 作为辅助素材而非阻塞项。

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

## Step 9：README 100 分目标复核

用户要求以重新拉取的 README 为标准，结合最新版 PRD，但不修改 PRD，继续把 `PoC_grs001` 优化到尽量贴近 100 分。

本轮使用蜂群审查：

1. README / PRD scoring audit：按 25、20、20、15、10、10 的权重找缺口。
2. PoC code flow audit：审查 `server.js`、`organizer-server.js`、`verify.js` 和三层数据存储。
3. Submission docs audit：审查作业提交仓库 `poc/`、README、docs、evidence 是否同步。
4. Plan agent 复核：确认最优先补 Organizer 创建、披露生命周期、异常状态、Riding Evidence 和提交仓库证据。

关键判断：

- 当前 PoC 已能证明主链路，但“Race 在 Organizer 侧创建”和“主动披露生命周期”不够可观察。
- Agent Riding 页面需要更明显展示计划、观察、干预、验收、复盘。
- 页面需要更有观众意识，但不能因为缺图片素材阻塞。

## Step 10：第二轮实现

本轮改动：

1. `src/server.js`
   - 新增 Race 状态：草案、开放、暂停、待更新、下线。
   - `/organizer/race` 增加创建与披露控制按钮。
   - `/yard` 和 `/race/grs-001` 根据公开状态显示入口、等待更新或下线。
   - `/team/submit` 在 Race 非开放时不提交。
   - `/team/records` 展示计划、观察、干预、验收、复盘。
   - `/team/replay` 独立展示回放时间线、人-Agent 分工和验证节点。
   - CSS 增加渐变背景、visual card、流程卡、状态信号和分栏图饰。

2. `organizer-private/race_source.json`
   - 补 `createdAt`、`disclosedAt`、`lifecycleStatus`、`disclosureStatus`。
   - 保留 Organizer 私有材料和公开字段列表。

3. `ary-public-store/public_disclosures.json`
   - 补公开状态、入口状态、公开要求和待更新 / 下线说明。

4. `ary-protected-store/riding_records.json` 与 `replay_events.json`
   - 补五段过程摘要。
   - 增加 Observation 事件。
   - 保持 `containsFullSession=false` 和 `sourceRetainedLocally=true`。

5. `src/organizer-server.js`
   - 评测依赖评测开关、源数据可用、Race 开放状态。
   - 返回分数时检查方案摘要和回放记录五段内容。

6. `src/verify.js`
   - 覆盖公开页、Race 详情、Organizer 创建披露、过期、下线、草案、重新开放、数据缺失、数据恢复、同浏览器多角色、队伍隔离、回放记录、人-Agent 分工和泄露词检查。

7. `coding-agent-sessions/artifact-ui-visual-prompts.md`
   - 记录 5 组可交给 gpt-image-2 的 prompt。
   - 当前 PoC 先用 CSS 占位，不等待生成图。

验证结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence holds
```

## Step 11：六维结果雷达图

用户确认旧七维雷达图可以迁回，但应改为提交评测后的结果展示，并且公开榜单和 Organizer 也可以看到。

本轮处理：

1. `PoC_grs001` 原本没有雷达图，旧实现只保留在 `PoC_v2/src/server.js`。
2. 将旧纯 SVG 算法迁入 `PoC_grs001/src/server.js`，改成六维结果画像：
   - 产品定义
   - 去中心化架构
   - 技术验证
   - 智能体骑行
   - 展示体验
   - 创世骑手
3. 结果维度写入公开结果数据 `ary-public-store/leaderboard_projection.json`。
4. `/team/records` 在提交成功后展示本队结果画像。
5. `/leaderboard` 展示各队公开六维结果画像，但不展示提交原文或过程细节。
6. `/organizer` 展示队伍评测结果，方便 Organizer 录制和讲解。
7. 验收脚本新增断言：
   - 未提交前不显示结果维度。
   - Team 提交后显示六个维度。
   - Leaderboard 和 Organizer 能看到六维结果。
   - 页面不出现“七维”“最佳”“奖”等旧表达。

验证结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

## Step 12：Public Yard 视觉素材落地

用户确认第 1 张 gpt-image-2 生成图可加入 PoC。

本轮处理：

1. 源图：`/home/lemonhdl/Downloads/ChatGPT Image 2026年6月7日 10_04_20.png`。
2. 检查结果：1672×941，接近 16:9，无稳定可读文字。
3. 压缩为 WebP：
   - `PoC_grs001/assets/public-yard-hero.webp`
   - `ary-grs-001-sinbawang/poc/assets/public-yard-hero.webp`
4. `src/server.js` 增加单一资产路由：`/assets/public-yard-hero.webp`。
5. `/yard` 与 `/race/grs-001` 的 hero 区使用 `public-hero` 背景图。
6. 保留白色渐变遮罩，保证标题、状态卡和按钮可读。
7. 不改变登录、Team、Organizer 和榜单页面的主视觉。

验证结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

资产路由烟测：

```text
GET /assets/public-yard-hero.webp -> 200 image/webp 169188 bytes
```

## Step 13：本地数据服务切断实验强化

用户指出 Organizer 页面右侧“评测状态”卡片需要更突出说明本地数据服务切断功能。

本轮处理：

1. 将 `/organizer` 右侧卡片从“允许评测”开关改为“本地数据服务”实验面板。
2. 连接状态显示为：
   - 本地数据服务已连接
   - 本地数据服务已切断
3. 操作按钮改为：
   - 切断服务
   - 恢复服务
4. 页面明确说明：切断后，ARY 只保留公开摘要，不能替 Organizer 完成评分；Team 提交会显示数据缺失，过程证据不会解锁。
5. 验收脚本新增 Organizer 页面断言：
   - 本地数据服务
   - 切断服务
   - 本地数据服务已切断
   - 恢复服务

验证结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

## Step 14：Organizer 视觉素材落地

用户确认第 2 张 Organizer 生成图可加入 PoC，采用 10:19:43 版本。

本轮处理：

1. 源图：`/home/lemonhdl/Downloads/ChatGPT Image 2026年6月7日 10_19_43.png`。
2. 检查结果：1536×1024，标准 3:2，OCR 噪声少于 10:17:48 版本。
3. 压缩为 WebP：
   - `PoC_grs001/assets/organizer-source-visual.webp`
   - `ary-grs-001-sinbawang/poc/assets/organizer-source-visual.webp`
4. `src/server.js` 增加单一资产路由：`/assets/organizer-source-visual.webp`。
5. `/organizer` hero 使用 `organizer-hero` 背景。
6. `/organizer` 右侧本地数据服务卡片使用 `organizer-card` 背景。
7. `/organizer/race` 顶部 hero 使用 `organizer-hero` 背景。
8. 保留渐变遮罩，弱化伪文字痕迹，保证按钮和状态卡可读。

验证结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

资产路由烟测：

```text
GET /assets/public-yard-hero.webp -> 200 image/webp 169188 bytes
GET /assets/organizer-source-visual.webp -> 200 image/webp 59314 bytes
```

## Step 15：Public Yard 背景可见度调整

用户反馈第 1 张 Public Yard 背景图被白色遮罩压得太浅，页面中看不清图片。

本轮处理：

1. 仅调整 `public-hero` 背景遮罩，不改 Organizer 视觉素材和页面文案。
2. 将白色渐变从 `.96 -> .86` 改为左侧 `.86`、中段 `.62`、右侧 `.34`。
3. 左侧仍保留文字可读遮罩，右侧显著露出背景图。
4. 同步修改提交仓库 `ary-grs-001-sinbawang/poc/src/server.js`。
5. 重启 4400 / 4401 最新服务，确认浏览器访问的不是旧进程。

验证结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

页面与资产烟测：

```text
GET /yard -> 200 text/html
GET /race/grs-001 -> 200 text/html
GET /assets/public-yard-hero.webp -> 200 image/webp 169188 bytes
public_hero=linear-gradient(90deg,rgba(255,255,255,.86) 0%,rgba(255,255,255,.62) 52%,rgba(255,255,255,.34) 100%),url('/assets/public-yard-hero.webp') center/cover
organizer_port=4401 open
```

## Step 16：关键技术 PoC 有效性说明

用户给出 25 分评分项，要求为当前 PoC 写一份说明文档，逐一回答评分要点，并反思还有哪些没实现好。

本轮处理：

1. 新增提交仓库文档：`docs/technical-poc-validity.md`。
2. 文档逐项回答：Organizer 创建 Race、公开披露、ARY 展示 Race 列表和详情、ARY 不保存完整 Race 数据、数据保存位置、可运行原型、异常处理、PoC 边界。
3. 在每一项后补“当前不足”，避免只写优点。
4. 总体反思中明确：当前 PoC 已击中主命题，但创建仍偏样例化、披露可信度未生产化、Organizer 服务仍是本地模拟、数据隔离是逻辑证明不是部署证明、异常覆盖还可以更细。
5. README 文档列表增加 `docs/technical-poc-validity.md` 入口。

验证结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

## Step 17：提交包整理

用户要求把 PoC 整理成可提交状态，并写好 PoC 说明文档，包含使用说明、内容说明、实现说明和对关键问题的回答。

本轮处理：

1. 按提交仓库现有目录整理结构：`ARY-PRD/`、`PoC-GRS-001/`、`riding_record/`。
2. 将最新版 `PoC_grs001` 复制到 `PoC-GRS-001/`。
3. 将 PRD 提交稿复制到 `ARY-PRD/ary-grs-001-prd.md`。
4. 将过程记录和 UI 素材 prompt 复制到 `riding_record/`。
5. 新增 `PoC-GRS-001/PoC说明文档.md`，覆盖使用说明、内容说明、实现说明、数据保存位置、关键问题逐项回答、当前不足和提交内容说明。
6. 重写根目录 `README.md`，作为提交入口。
7. 重写 `PoC-GRS-001/README.md`，作为快速运行入口。
8. 清理空目录 `.gitkeep`，检查没有 `node_modules`、`dist`、临时文件。

验证结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

最终提交包核心文件：

```text
README.md
ARY-PRD/ary-grs-001-prd.md
PoC-GRS-001/PoC说明文档.md
PoC-GRS-001/README.md
PoC-GRS-001/src/server.js
PoC-GRS-001/src/verify.js
riding_record/session-10-public-yard-private-source-restructure.md
```

