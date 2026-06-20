# ARY 数据层完整指南（DATA-GUIDE）

本文是 D 组数据层的完整介绍与交付说明,覆盖 `todos/04-D-Authority-Mock-Data.md` 的数据生成、数据库设计、
产物、命令、不变量与设计取舍。

---

## 1. 一句话总览

一套「确定性数据生成器 + PostgreSQL 数据库生命周期管理」的数据工程,同时为第一轮单机 Web 应用提供唯一
权威 mock 数据面 `authority-mock.json`。

两层产物边界(对齐 `todos/04` §12.1、`todos/19`):

1. **数据生产层 / 离线工具层**:`source/`、PostgreSQL、generator、schema、seed。
2. **运行时主入口**:`authority-mock.json`,可被单机应用直接加载,**数据库不是启动硬前置**。

---

## 2. 技术选型与本地化

| 项 | 选择 | 说明 |
|---|---|---|
| 数据库 | PostgreSQL 16 | 监听 `127.0.0.1:5433`,避免污染系统默认 5432 |
| 运行环境 | conda `SE` | 不动 `SE` 之外任何内容 |
| 数据目录 | `source/pgdata/` | 项目内,允许一键清除 |
| 生成器 | 纯 Python(标准库;Faker 为预留可选依赖,当前不消费) | 确定性、可重复、可提交、可 diff |
| 连接凭证 | `.env` | 集中管理,不写系统环境变量 |

**硬约束**:不安装系统服务、不写系统环境变量、不动 `SE` 之外任何内容;`destroy` 只能删除受控路径白名单
(`pgdata/`、`seed/`、`exports/`、`backups/`)。

---

## 3. 数据库设计

### 3.1 两层 schema

* `core`:事实源表,权威,不可被派生数据覆盖。
* `read_model`:派生读取模型,可整体重算,不是最终事实源。

### 3.2 表清单

**core(19 表)**:`users`、`user_roles`、`races`、`race_organizers`、`registrations`、`race_projects`、
`ca_connections`、`sessions`、`riding_signals`、`riding_session_snapshots`、`riding_metrics`、`works`、
`work_evidence`、`judge_assignments`、`scores`、`awards`、`rider_reports`、`announcements`、`evidence_chain`。

**read_model(9 表)**:`projections`、`leaderboard_read_model`、`rider_profiles`、`screen_displays`、
`projection_status`、`published_artifacts`、`ca_connection_status`、`dashboard_overview`、`audit_log`。

### 3.3 主键

主键统一使用「可读字符串 ID」(如 `work-bay-area-happy-trip-001`),而非 uuid——便于阅读、diff 与跨组对账
(设计取舍见 §7)。

---

## 4. 不变量:如何在数据库层强制

`todos/04` §8 的 12 条不变量,能用 `UNIQUE / FK / CHECK / 触发器` 落库的都落库,其余由生成器构造保证并由
`verify` 校验。

| # | 不变量 | 落库强制方式 |
|---|---|---|
| 1 | 一人一赛至多一报名 | `registrations UNIQUE(race_id, user_id)` |
| 2 | approved 幂等生成 RaceProject | `race_projects.registration_id UNIQUE` + FK |
| 3 | 每报名至多一主作品 | `UNIQUE INDEX works(registration_id) WHERE is_primary` |
| 4 | rider_report 与 subject_registration 同赛事 | 复合 FK `(subject_registration_id, race_id) → registrations(id, race_id)` |
| 5 | 同赛事同奖项 rank 唯一 | `awards UNIQUE(race_id, name, rank)` |
| 6 | public 作品不得为 draft/hidden | `works CHECK(visibility<>'public' OR status IN('submitted','published'))`(public 与 hidden 由枚举互斥) |
| 7 | riding_signals 幂等键不重复 | `riding_signals UNIQUE(idempotency_key)` |
| 8 | 评分必源于 JudgeAssignment | `scores.judge_assignment_id NOT NULL FK` + 触发器校验 work 一致 |
| 9 | Award 不串场 | 复合 FK `awards(work_id, race_id) → works(id, race_id)` |
| 10 | 有握手才有会话 | `sessions` BEFORE 触发器:CA 状态必须 handshaken/active |
| 11 | 获奖作品不得为 hidden | 复合 FK `awards(work_id, work_visibility) → works(id, visibility)` + `CHECK(work_visibility<>'hidden')` |
| 12 | 已发布 rider_report 必有 published_at | `rider_reports CHECK(status<>'published' OR published_at IS NOT NULL)` |

`python manage.py verify` 对 `relational-mock.json` 逐条复核以上 12 项(无需运行数据库即可执行)。

---

## 5. 数据如何生成

### 5.1 确定性

固定:随机种子 `ARY_RANDOM_SEED`、Faker 种子、时间基准 `2026-06-14T13:58:00+08:00`、ID 分配逻辑(顺序计数)。
连续两次 `generate.py` 产出**逐字节一致**。

### 5.2 八场赛事覆盖全生命周期

| 赛事 | 状态 | 角色 |
|---|---|---|
| 湾区开心游 `bay-area-happy-trip` | running | 实时主赛事 / Live Hall / featured |
| 智能投研助理 `smart-investment-analyst` | running | 安全敏感域(金融) |
| 自媒体运营 Agent `media-ops-agent` | judging | 评审中 |
| 网商经营 Copilot `merchant-copilot` | registration | 报名中 |
| 健康习惯教练 `health-habit-coach` | registration | 安全敏感(健康) |
| 政务办事导航 Agent `gov-service-navigator` | completed | 已发布赛果 |
| 创世骑行挑战赛 `genesis-dogfood-race` | archived | 已归档但保留公开资产 |
| 医疗随访助手 `medical-followup-assistant` | upcoming | 高敏边界 / 空骑行样本 |

覆盖枚举 `registration / running / judging / completed / archived / upcoming` 全集。

### 5.3 必含特殊样本

| 样本 | 落点 |
|---|---|
| 安全敏感域风险样本 | `smart-investment-analyst` 的 Owen(risk=safety_boundary)+ 风险审计日志 |
| 空骑行样本 | `medical-followup-assistant`(无报名/会话)+ `media-ops-agent` 的 Iris(0 会话) |
| CA failed 但仍提交作品 | `media-ops-agent` 的 Iris(ca=failed,sessions=0,work=submitted) |
| hidden 作品样本 | `bay-area-happy-trip` 的 Rae(work visibility=hidden,无奖项) |
| 成本与风险样本 | `bay-area-happy-trip` 的 Jun(risk=cost_watch,高成本) |

---

## 6. 产物与命令

### 6.1 三类权威产物

1. `seed/seed.sql`——直接灌库。
2. `exports/relational-mock.json`——关系数据 JSON 镜像。
3. `exports/authority-mock.json`——前端兼容导出(同步发布到 `deliverables/d-data/authority-mock.json`)。

### 6.2 命令

`init / start / stop / status / generate / load / reset / verify / backup / restore / psql / destroy`
(详见 [README.md](README.md))。

---

## 7. 已知设计取舍(诚实说明)

1. **PK 用可读字符串 ID 而非 uuid**:利于阅读、diff 与跨组人工对账;代价是需要生成器保证唯一。
2. **前端导出是「对齐前端实际读取字段」**,不是 core 对象逐键全等;`authority-mock.json` 的 View 是面向页面的投影。
3. **`verify` 覆盖的是可落库强制的核心不变量**(12 条),不是全部业务规则。
4. **`ca_connections` 的 `public_key_fingerprint` 等属于实现扩展字段**,非前端必需。
5. **详细 rider/session/work 行是确定性的「代表子集」**,而 `races[].metrics` 的 riders/sessions 等是策划用的展示聚合
   数(如 36 名骑手)——两者刻意不强行相等,避免为对齐展示数字而灌入大量噪声行。该取舍在
   `../data-coverage-report.md` 中明确标注。
6. **运行态主入口是 `authority-mock.json`**:数据库与 generator 是离线增强能力,未来可在不破坏单机部署体验的
   前提下逐步替换为 DB 直读。
