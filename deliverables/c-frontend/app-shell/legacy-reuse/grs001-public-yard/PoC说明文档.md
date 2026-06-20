# GRS 001 PoC 说明文档

## 1. PoC 目标

本 PoC 验证 GRS 001 的核心假设：

> Race 源数据留在 Organizer 侧，ARY 只读取 Organizer 主动披露的公开摘要，也能完成 Race 发现、组织入口、提交状态和公开展示。

它不是完整赛事平台，而是一个可运行的关键技术验证版本。重点不是做复杂功能，而是证明 ARY 不需要成为 Race 数据中心。

## 2. 使用说明

### 2.1 运行环境

需要本机已安装 Node.js。PoC 使用 Node 原生 HTTP 服务，不需要额外安装依赖。

### 2.2 启动 ARY 页面服务

在提交仓库根目录执行：

```bash
cd PoC-GRS-001
npm start
```

页面服务默认运行在：

```text
http://127.0.0.1:4400
```

### 2.3 启动 Organizer 本地评测服务

另开一个终端，在提交仓库根目录执行：

```bash
cd PoC-GRS-001
npm run start:organizer
```

Organizer 评测服务默认运行在本地 4401 端口。页面服务会在 Team 提交时请求该服务完成评测。

### 2.4 本地演示账号

| 身份 | 账号 | 密码 |
| --- | --- | --- |
| Organizer | `Organizer_001` | `********` |
| Team 001 | `team_001` | `******` |
| Team 002 | `team_002` | `**********` |

### 2.5 建议演示路径

1. 打开 `/yard`  
   查看 ARY 当前可见的公开 Race。

2. 打开 `/race/grs-001`  
   查看 Organizer 主动披露的公开摘要、提交要求、状态和参与入口。

3. 使用 Organizer 账号登录，进入 `/organizer/race`  
   查看 Race 创建记录、披露版本、公开字段和状态控制。

4. 在 `/organizer/race` 切换状态  
   可以演示草案、开放、暂停、待更新和下线。

5. 进入 `/organizer`，点击“切断服务”  
   模拟 Organizer 本地数据服务不可用。

6. 使用 `team_001` 登录并进入 `/team/submit`  
   在服务切断时提交，页面显示“数据缺失，暂无法评分”。

7. 恢复 Organizer 本地数据服务后再次提交  
   Team 可以进入 `/team/records` 查看整理后的 Riding Evidence，并进入 `/team/replay` 查看回放记录。

8. 打开 `/leaderboard`  
   查看公开排名、等级、公开评语和六维结果画像。

### 2.6 自动验证

在 `PoC-GRS-001` 目录执行：

```bash
npm run verify
```

期望输出：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

验证脚本会自动检查公开披露、私有数据不泄露、状态切换、数据服务不可用、队伍隔离、过程证据和公开榜单。

## 3. 内容说明

### 3.1 页面内容

| 页面 | 内容 |
| --- | --- |
| `/demo` | 同一浏览器下的 Organizer 和 Team 入口，方便录制演示。 |
| `/login` | 登录入口，只负责身份进入。 |
| `/yard` | Public Yard，展示 ARY 当前可见的公开 Race。 |
| `/race/grs-001` | Race 公开详情，展示公开目标、提交要求、状态和参与路径。 |
| `/organizer` | Organizer 控制台，展示源数据状态、本地数据服务状态和评测结果摘要。 |
| `/organizer/race` | Race 创建与披露控制，展示 Organizer 侧创建记录、披露字段和生命周期控制。 |
| `/team` | Rider Workspace，展示队伍当前提交状态和可执行动作。 |
| `/team/submit` | Team 提交方案摘要和整理后的 Riding Record 摘要。 |
| `/team/records` | Team 提交成功后可见的 Riding Evidence 和六维结果画像。 |
| `/team/replay` | Team 可见的回放记录，包含时间线、actor 和验证节点。 |
| `/leaderboard` | 公开结果页，只展示排名、等级、公开评语和六维结果画像。 |

### 3.2 数据内容

PoC 使用三类本地数据目录表达数据边界。

| 目录 | 说明 |
| --- | --- |
| `organizer-private/` | Organizer 侧私有源数据。保存完整 Race brief、未公开材料、评测依据、评测服务状态和披露控制。 |
| `ary-public-store/` | ARY 可展示的公开披露数据。保存公开摘要、Race 状态、公开入口、队伍公开信息和公开榜单。 |
| `ary-protected-store/` | Team 提交和过程证据摘要。保存提交状态、整理后的 Riding Record 和回放事件摘要。 |

主要文件：

| 文件 | 内容 |
| --- | --- |
| `organizer-private/race_source.json` | Race 创建记录、完整源数据、披露版本、公开字段、生命周期状态。 |
| `organizer-private/evaluator_service.json` | Organizer 本地数据服务是否可用。 |
| `organizer-private/evaluation_policy.json` | Organizer 侧评测依据。 |
| `ary-public-store/public_disclosures.json` | ARY 可见的公开 Race 摘要、状态和入口。 |
| `ary-public-store/leaderboard_projection.json` | 公开榜单结果和六维结果画像。 |
| `ary-protected-store/submissions.json` | Team 提交状态。 |
| `ary-protected-store/riding_records.json` | Team 整理后的 Riding Record 摘要。 |
| `ary-protected-store/replay_events.json` | 回放事件摘要、actor 和验证节点。 |

## 4. 实现说明

### 4.1 服务结构

PoC 包含两个本地服务。

1. ARY 页面服务  
   入口文件：`src/start.js`  
   默认端口：4400  
   功能：渲染页面、处理登录、展示公开披露、接收 Team 提交、请求 Organizer 评测。

2. Organizer 本地评测服务  
   入口文件：`src/start-organizer.js`  
   默认端口：4401  
   功能：模拟 Organizer 侧评测能力。只有本地数据服务可用且 Race 状态允许时，才返回评分。

### 4.2 核心代码

| 文件 | 作用 |
| --- | --- |
| `src/server.js` | 主页面服务，包含页面渲染、角色入口、Race 状态、提交流程和公开榜单。 |
| `src/organizer-server.js` | Organizer 本地评测服务。 |
| `src/storage.js` | 读取和写入本地 JSON 数据。 |
| `src/verify.js` | 自动验收脚本。 |
| `src/start.js` | 启动 ARY 页面服务。 |
| `src/start-organizer.js` | 启动 Organizer 本地评测服务。 |

### 4.3 Race 生命周期实现

Race 状态包括：

| 状态 | 页面行为 |
| --- | --- |
| 草案 | Public Yard 不展示 Race。 |
| 开放 | Public Yard 和详情页展示 Race，并提供提交入口。 |
| 暂停 | Race 可见，但评测暂停。 |
| 待更新 | Race 详情提示等待 Organizer 更新，不提供提交入口。 |
| 下线 | Public Yard 保留状态，不提供提交入口。 |

Organizer 可以在 `/organizer/race` 切换这些状态。Public Yard 和 Race 详情页会根据公开披露状态改变展示和入口。

### 4.4 数据服务不可用实现

Organizer 控制台 `/organizer` 提供“切断服务”和“恢复服务”。

切断后：

- `organizer-private/evaluator_service.json` 中的服务状态变为不可用。
- Team 提交时，ARY 无法完成评测。
- 页面显示“数据缺失，暂无法评分”。
- Team 的过程证据不会解锁。

恢复后：

- Team 再次提交可以完成评测。
- Team 可以查看本队 Riding Evidence 和结果画像。

### 4.5 结果展示实现

评测完成后，公开结果进入榜单展示。

公开展示内容包括：

- 排名
- 队伍
- 等级
- 公开评语
- 六维结果画像

六维结果画像包括：

- 产品定义
- 去中心化架构
- 技术验证
- 智能体骑行
- 展示体验
- 创世骑手

公开榜单不展示 Team 提交原文，也不展示 Team 的过程细节。

## 5. 对关键问题的回答

### 5.1 Race 是否能在 Organizer 侧被创建

可以。

`/organizer/race` 展示 Race 创建记录、创建时间、披露版本和生命周期状态。数据保存在 `organizer-private/race_source.json`。这说明 Race 源数据由 Organizer 持有，不是从 ARY 公共页产生。

当前边界：PoC 只围绕 GRS 001 单个样例 Race 展示创建和状态控制，不是完整多 Race 创建系统。

### 5.2 Organizer 是否能向 ARY 披露公开数据

可以。

Organizer 在 `/organizer/race` 控制披露状态。披露并开放后，ARY 的 `/yard` 和 `/race/grs-001` 展示公开摘要、公开目标、提交要求、状态和入口。

公开披露数据保存在 `ary-public-store/public_disclosures.json`。它不包含完整 Race brief、未公开材料和内部评测依据。

当前边界：披露是本地原型状态切换，没有实现签名、可信时间戳和跨服务同步协议。

### 5.3 ARY 是否能展示 Race 列表、详情、状态和入口

可以。

`/yard` 展示公开 Race 列表和状态。`/race/grs-001` 展示公开详情和参与入口。状态变化会影响页面行为：草案不展示，开放可提交，待更新和下线不提供提交入口。

当前边界：当前只有一个样例 Race，没有多 Race 筛选、排序和分页。

### 5.4 ARY 是否不依赖自身保存完整 Race 数据

可以证明。

完整 Race 源数据保存在 `organizer-private/`。ARY 公开页只读取 `ary-public-store/` 中的公开披露数据。Team 页面读取的是受控提交和整理后的 Riding Record 摘要。

自动验收会检查 Public 和 Team 页面不出现 Organizer 私有材料、内部文件名、内部路径、完整本地历史、未公开材料和内部评测口径。

当前边界：数据分层是在本地目录中模拟，仍不是生产部署中的物理隔离。

### 5.5 PoC 中哪些数据在哪里保存

见本文第 3.2 节。核心分为三层：

- Organizer 私有源数据：`organizer-private/`
- ARY 公开披露数据：`ary-public-store/`
- Team 提交和过程证据摘要：`ary-protected-store/`

这个结构直接对应 GRS 001 的数据主权问题。

### 5.6 是否有最小可运行原型和数据样例

有。

`PoC-GRS-001` 可以直接运行，包含页面服务、Organizer 本地评测服务、JSON 数据样例和自动验收脚本。

运行命令：

```bash
npm start
npm run start:organizer
npm run verify
```

### 5.7 是否能处理基本异常

可以处理主链路所需的基本异常。

| 异常 | PoC 行为 |
| --- | --- |
| Organizer 本地数据服务不可用 | Team 提交显示数据缺失，过程证据不解锁。 |
| 披露待更新 | Race 详情不提供提交入口。 |
| Race 下线 | Public Yard 保留状态，不提供提交入口。 |
| 草案未披露 | Public Yard 不展示 Race。 |
| 队伍越权读取 | 自动验收确认 team_002 不能读取 team_001 记录。 |

当前边界：还没有模拟字段缺失、服务超时、披露版本冲突和评测服务返回异常格式。

### 5.8 PoC 边界与未实现部分是否清楚

清楚。

本 PoC 不实现：

- 完整赛事平台
- 多 Organizer 接入后台
- 生产级认证和权限系统
- HTTPS、签名 cookie、CSRF
- 真实数据库和对象存储
- 披露签名、可信时间戳和版本链
- 生产级监控、重试和告警
- 大规模队伍和多 Race 性能验证

这些没有实现，是因为本次目标是验证 GRS 001 的关键技术假设，而不是提交生产系统。

## 6. 当前完成度反思

### 6.1 已经做好的部分

1. 主链路完整  
   Organizer 创建并持有 Race 源数据，ARY 只展示公开披露数据，Team 能提交，Organizer 可用时完成评测，公开榜单展示结果。

2. 数据边界清楚  
   三类数据分别保存，公开页和 Team 页不会展示 Organizer 私有材料。

3. 异常能演示  
   已覆盖数据服务不可用、待更新、下线、草案和队伍隔离。

4. 结果展示完整  
   提交后有六维结果画像，公开榜单只展示公开结果。

5. 自动验证可重复  
   `npm run verify` 能重复检查关键行为。

### 6.2 还没实现好的部分

1. Race 创建仍偏样例化  
   目前是一个 GRS 001 样例 Race 的创建记录和状态控制，还不是可新增任意 Race 的后台。

2. 披露可信度还不够  
   有披露字段和披露状态，但没有签名、可信时间戳、版本链和第三方校验。

3. Organizer 服务还是本地模拟  
   能证明数据不可用时 ARY 不伪造评分，但没有真实远程服务接入和网络错误处理。

4. 数据隔离不是生产部署隔离  
   目录分层和页面边界已经清楚，但没有部署到不同机器、账户或存储权限中。

5. 异常覆盖还可以更细  
   缺少服务超时、字段缺失、版本冲突、重复提交和部分失败等情况。

6. 文档还可以继续图形化  
   当前说明已经完整，但后续可以补数据流图和状态图，让评审更快理解。

## 7. 提交内容说明

提交仓库建议结构：

```text
ARY-PRD/
  ary-grs-001-prd.md
PoC-GRS-001/
  PoC说明文档.md
  README.md
  package.json
  src/
  organizer-private/
  ary-public-store/
  ary-protected-store/
  assets/
riding_record/
  session-10-public-yard-private-source-restructure.md
  artifact-ui-visual-prompts.md
README.md
```

其中：

- `ARY-PRD/` 放 PRD 提交稿。
- `PoC-GRS-001/` 放可运行 PoC 和本文档。
- `riding_record/` 放 Agent Riding 过程记录和 UI 素材 prompt。
- 根目录 `README.md` 是提交入口。
