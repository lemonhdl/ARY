# D 组任务：数据层完整任务与权威 mock 统一交付

本文保留原始数据层文档中的生成器、数据库、产物、命令、不变量和对接说明，并在后半部分追加第一轮统一 authority mock 与 handoff 规范。

## 1. 一句话总览

你负责的是一套“确定性数据生成器 + PostgreSQL 数据库生命周期管理”的数据工程，同时还要给当前产品壳提供第一轮统一权威 mock 数据面。

## 2. 这一项要做的两件事

### 2.1 数据生成

为多场比赛生成完整事实链，覆盖 `registration / running / judging / completed / archived` 全生命周期；每场赛事生成报名、RaceProject、CA 接入、Session、骑行记录、作品、评审分配、评分、奖项、证据、报告；遵守领域不变量；生成真实风格中文样例；同时导出前端兼容 JSON。

### 2.2 数据库管理

使用 PostgreSQL，本地化、可一键清除；连接信息集中在 `.env`；GitHub 登录数据进入 `core.users`；骑行记录包括 `core.riding_signals`、`core.riding_session_snapshots`、`core.sessions`；初始化、启停、建表、灌数据、重置、备份、恢复全部由 `manage.py` 管理。

## 3. 目录结构应该承担什么职责

原始数据层任务至少应覆盖：

1. `README.md` 快速上手。
2. `DATA-GUIDE.md` 完整介绍与交付说明。
3. `environment.yml`。
4. `requirements.txt`。
5. `.env.example`。
6. `config.py`。
7. `manage.py`。
8. `generate.py`。
9. `content.py`。
10. `schema/`。
11. `seed/`。
12. `exports/`。
13. `pgdata/` 与 `backups/` 生命周期约定。

## 4. 技术选型与本地化设计

1. 数据库使用 PostgreSQL。
2. 运行环境使用 conda 环境 `SE`。
3. 监听 `127.0.0.1:5433`，避免污染系统默认实例。
4. 数据目录放项目内，允许一键清除。
5. 生成器使用纯 Python + Faker，要求确定性、可重复、可提交、可 diff。
6. 连接凭证集中在 `.env`。

硬约束：不安装系统服务、不写系统环境变量、不动 `SE` 之外任何内容；`destroy` 只能删除受控路径。

## 5. 数据库设计

### 5.1 两层 schema

1. `core` 是事实源表，权威，不可被派生数据覆盖。
2. `read_model` 是派生读取模型，可整体重算，不是最终事实源。

### 5.2 需要覆盖的核心对象

1. 身份与账号：`users`、`user_roles`。
2. 赛事：`races`、`race_organizers`。
3. 报名、工作区、CA 接入、会话：`registrations`、`race_projects`、`ca_connections`、`sessions`。
4. 骑行记录：`riding_signals`、`riding_session_snapshots`、`riding_metrics`。
5. 作品、评审、奖项、证据、报告、公告。
6. 读取模型：`projections`、`leaderboard_read_model`、`rider_profiles`、`screen_displays`。

### 5.3 主键与不变量

主键允许用可读字符串 ID。关键不变量必须在数据库层强制，包括一人一报名、approved 幂等生成 RaceProject、单主作品、Award 不串场、同赛事同奖项 rank 唯一、rider_report 约束、握手门禁等。

## 6. 数据如何生成

必须保证确定性生成。至少固定随机种子、Faker 种子、时间基准和 ID 分配逻辑。

必须生成 8 场覆盖全生命周期的赛事，并覆盖安全敏感域风险样本、空骑行样本、CA failed 但仍提交作品样本、hidden 作品样本、成本与风险样本。

## 7. 产物与命令

至少需要三类权威产物：

1. `seed.sql`，用于直接灌库。
2. 关系数据 JSON 镜像。
3. 前端兼容导出 JSON。

至少需要以下命令：

1. `init`
2. `start`
3. `stop`
4. `status`
5. `generate`
6. `load`
7. `reset`
8. `verify`
9. `backup`
10. `restore`
11. `psql`
12. `destroy`

## 8. `verify` 必须承担的不变量校验

至少应覆盖：

1. 一个 User 对同一 Race 至多一个 Registration。
2. approved 报名均已幂等生成 RaceProject。
3. 每个 Registration 至多一个主 Work。
4. rider_report 与 `subject_registration_id` 约束。
5. Award rank 唯一。
6. public 作品不得为 draft 或 hidden。
7. `riding_signals` 幂等键不重复。
8. 评分记录必源于 JudgeAssignment。
9. Award 不串场。
10. 有握手才有会话快照和事件入证据链。
11. 获奖作品不得为 hidden。
12. 已发布 rider_report 必有 `published_at`。

## 9. 与各端对接

你必须同时服务前端展示、Rider 接入和整合方：

1. 前端需要零改动或低改动消费兼容导出。
2. CA 接入契约字段要与 `ary-ca-integration-spec` 对齐。
3. 所有端都应能从仓库一键重建同一份确定性数据。

## 10. 已知设计取舍要诚实写清

包括但不限于：

1. PK 使用可读字符串 ID 而非 uuid。
2. 前端导出是“对齐前端实际读取字段”，不是整对象逐键全等。
3. `verify` 覆盖的是可落库强制的核心不变量。
4. `ca_connections` 的某些字段属于实现扩展字段。

## 11. 统一执行输入

必须先读：

1. `todos/10-Shared-Field-Dictionary.md`
2. `todos/11-Publication-Visibility-Rules.md`
3. `todos/12-Authority-Mock-Data-Spec.md`
4. `todos/16-Project-Baseline-Requirements.md`
5. `todos/17-Original-Task-Coverage-Map.md`
6. 本文

## 12. 统一交付输出

你必须在 `deliverables/d-data/` 下交出以下产物：

1. `handoff.manifest.json`
2. `authority-mock.json`
3. `authority-mock.schema.md`
4. `data-coverage-report.md`
5. `data-mapping-notes.md`
6. `source/`

`source/` 至少应承载原始数据层完整实现或等价结构：`README.md`、`generate.*`、`schema/`、`seed/`、`exports/`、`manage.*`。

## 12.1 运行态落地约束

为了让第一轮部署简单，D 组需要明确区分两层产物：

1. `source/`、PostgreSQL、generator、schema、seed 属于数据生产层或离线工具层。
2. `authority-mock.json` 属于第一轮单机 Web 应用的运行时主入口。

这意味着：

1. 数据库不应成为第一轮应用启动的硬前置条件。
2. D 组应优先保证 `authority-mock.json` 可直接被应用加载。
3. 如果未来需要数据库增强，可以在不破坏单机部署体验的前提下逐步替换。

## 13. 交付附加要求

`authority-mock.json` 必须至少覆盖 `RaceSummary[]`、`LiveProjectionView[]`、`PublishedWorkView[]`、`PublishedResultView[]`、`PublishedReviewView[]`、`PublicRiderProfileView[]`、`DashboardOverview`、`CAConnectionStatusView[]`、`ProjectionStatus[]`、`PublishedArtifactStatus[]`、`AuditLogEntry[]`。

`data-coverage-report.md` 必须说明哪些对象和状态已覆盖，哪些仍用 fallback 或假数据，哪些来自 A、B handoff。

## 14. 验收标准

1. C 能只读你的 `authority-mock.json` 跑公开端主路径。
2. E 能把 A、B 的 handoff 注入后重新生成统一 mock 或直接验证兼容性。
3. 全项目不再出现两份权威 mock 并行。
4. 交付内容不能把原始数据层任务退化成“只给一个 mock JSON”。