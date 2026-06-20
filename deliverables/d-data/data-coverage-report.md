# 数据覆盖报告（data-coverage-report）

本文回答三个问题(对齐 `todos/04` §13):哪些对象与状态**已覆盖**、哪些仍是 **fallback / 假数据**、
哪些**应来自 A、B handoff**。

> 数据由 `source/generate.py` 确定性生成;统计随生成器变化,重算命令见末尾。

## 1. 当前数据规模（本轮快照）

### core（事实源,19 表）

| 表 | 行数 | 表 | 行数 |
|---|---|---|---|
| users | 17 | works | 13 |
| user_roles | 18 | work_evidence | 26 |
| races | 8 | judge_assignments | 6 |
| race_organizers | 8 | scores | 18 |
| registrations | 15 | awards | 2 |
| race_projects | 13 | rider_reports | 4 |
| ca_connections | 13 | announcements | 5 |
| sessions | 54 | evidence_chain | 162 |
| riding_signals | 108 | | |
| riding_session_snapshots | 54 | | |
| riding_metrics | 13 | | |

### read_model（派生,9 表）

| 表 | 行数 | 表 | 行数 |
|---|---|---|---|
| projections | 5 | published_artifacts | 33 |
| leaderboard_read_model | 13 | ca_connection_status | 15 |
| rider_profiles | 3 | dashboard_overview | 1 |
| screen_displays | 5 | audit_log | 8 |
| projection_status | 5 | | |

### authority-mock.json 11 个共享 View

| View | 计数 | 备注 |
|---|---|---|
| races (RaceSummary) | 8 | 覆盖 6 个 RaceStatus 全集 |
| liveProjections (LiveProjectionView) | 2 | 两场 running 赛事 |
| works (PublishedWorkView) | 13 | public 4 / review 4 / private 4 / hidden 1 |
| results (PublishedResultView) | 2 | completed + archived |
| awards | 2 | 均指向 public 作品 |
| reviews (PublishedReviewView) | 2 | 均已发布 |
| profiles (PublicRiderProfileView) | 3 | 均为公开档案 |
| dashboard (DashboardOverview) | 1 | |
| caStatuses (CAConnectionStatusView) | 15 | health 覆盖 active/handshaken/failed/not_configured |
| projectionStatuses (ProjectionStatus) | 5 | health 四态齐全 healthy/degraded/failed/stale |
| publishedArtifacts (PublishedArtifactStatus) | 33 | result/review/report/work |
| auditLogs (AuditLogEntry) | 8 | severity 覆盖 info/notice/warning/danger |

## 2. 对象与状态覆盖

### 2.1 生命周期(全覆盖)

`registration / running / judging / completed / archived / upcoming` —— 8 场赛事均有对应,无缺口。

### 2.2 必含特殊样本(全覆盖)

| 样本 | 落点 | 状态 |
|---|---|---|
| 安全敏感域风险样本 | `smart-investment-analyst` Owen(safety_boundary)+ audit-007 | ✅ |
| 空骑行样本 | `medical-followup-assistant`(无报名/会话)+ `media-ops-agent` Iris(0 会话) | ✅ |
| CA failed 但仍提交作品 | `media-ops-agent` Iris(ca=failed, sessions=0, work=submitted)+ audit-005 | ✅ |
| hidden 作品样本 | `bay-area-happy-trip` Rae(work visibility=hidden,无奖项)+ audit-004 | ✅ |
| 成本与风险样本 | `bay-area-happy-trip` Jun(cost_watch;relational 镜像 `riding_metrics.cost=38.4`,authority-mock 中体现为 `races[].live.costWatchRiders=3` 与 `caStatuses` 风险提示)+ audit-006 | ✅ |

### 2.3 不变量(全部 PASS)

`python manage.py verify` 对 12 条核心不变量逐条校验,本轮 **12/12 PASS**(详见 `source/DATA-GUIDE.md` §4)。

## 3. fallback / 假数据 与诚实标注

| 项 | 性质 | 说明 |
|---|---|---|
| `races[].metrics`(riders=36 等) | **策划展示聚合数** | 不与详细 rider/session 行强行相等;详细行是确定性代表子集 |
| 详细 rider/session/work 行 | **代表子集(真实风格)** | 为可读、可 diff,刻意不灌满展示聚合数对应的全部行 |
| 文案(标题/摘要/评语) | **生成器内中文样例** | 真实风格,非真实用户数据 |
| `demo` / `repo` URL | **mock:// 占位** | 非真实可达链接 |
| `signature` / `public_key_fingerprint` | **占位串** | 形态正确,非真实密码学产物;真实签名应来自 A 组 |
| `mock://avatar/...` | **占位头像** | |

以上均为 D 自带的确定性 mock,**不依赖任何上游即可独立跑通公开端主路径**。

## 4. 应来自 A、B handoff 的部分（当前为 D 自带占位,等待覆盖）

依据 `todos/04` §9 与 `todos/12` §4,A、B 的样例用于**补齐**赛时与管理侧信息,但不另立第二份主 mock。
当前 D 已自带可用占位;A、B handoff 就绪后由 E 注入覆盖对应字段。

| 上游 | 期望 handoff 文件 | 覆盖 authority-mock 的部分 | 当前 D 占位状态 |
|---|---|---|---|
| A-rider | `riding-events.sample.json` | `liveProjections[].eventStream`、riding 过程信号 | D 自带脱敏事件流占位 |
| A-rider | `ca-status.sample.json` | `caStatuses[].health / lastSignalAt` | D 自带 CA 状态占位(含 failed) |
| A-rider | `signature-samples.json` | riding_signals 的 `signature` | D 自带占位串 |
| B-admin | `dashboard-overview.sample.json` | `dashboard` 治理摘要 | D 自带聚合占位 |
| B-admin | `projection-status.sample.json` | `projectionStatuses` | D 自带四态占位 |
| B-admin | `published-artifacts.sample.json` | `publishedArtifacts` | D 自带占位 |
| B-admin | `audit-log.sample.json` | `auditLogs` | D 自带 8 条治理样例 |

约定:E 注入 A/B handoff 时,**以发布态/可见性规则为准做覆盖与校验**,不得让未发布内容进入公开端。

## 5. 验收对照（`todos/04` §14）

| 验收项 | 结论 |
|---|---|
| C 能只读 authority-mock.json 跑公开端主路径 | ✅ 已通过 adapter + 发布规则联检(无泄露) |
| E 能注入 A、B handoff 重新生成或验证兼容性 | ✅ 顶层键/View 稳定,`consumes` 已在 manifest 声明 |
| 全项目不再出现两份并行权威 mock | ✅ authority-mock.json 为唯一主源;`design-prototype/...` 仅作初始参考 |
| 不把数据层退化成「只给一个 mock JSON」 | ✅ 同时交付 generator/schema/seed/relational/verify/DB 生命周期 |

## 6. 重算与复核

```bash
cd deliverables/d-data/source
python generate.py     # 重新生成三份产物
python manage.py verify # 12 条不变量校验
```
