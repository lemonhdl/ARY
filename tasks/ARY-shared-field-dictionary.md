# ARY 共享字段字典（集成初稿）

版本：v0.1  
状态：草案 / 用于四组接线冻结第一轮共享 view model  
适用范围：A Rider 客户端、B 管理系统、C 前端展示、D 数据层、E 整合统一  

## 1. 文档目的

本文不定义数据库 schema，也不替代页面设计稿。本文只做一件事：

把四组在第一轮集成时真正要交换的共享对象冻结成一组统一 view model，避免每组各自维护“看起来差不多但不能直接接线”的字段。

## 2. 使用原则

1. 展示层、管理端、联调脚本优先读取本文定义的 view model，而不是直接读取底层表结构。
2. 当前仓库的 `design-prototype/data/sample-races.json` 可作为第一轮 mock 源，但后续真实数据源必须通过 adapter 转成本文字段。
3. 字段名优先沿用当前原型和任务文档已有叫法，减少第一轮迁移成本。
4. 本文只冻结 P0 必需字段；非 P0 字段可后续扩展，不阻断第一轮可运行产品。

补充：对象是否可公开、是否已发布，不由本文单独定义，统一受 `tasks/ARY-publication-visibility-rules.md` 约束。

## 3. 字段说明口径

| 列 | 说明 |
| --- | --- |
| 字段 | 共享对象中的字段名 |
| 类型 | 推荐数据类型 |
| 来源方 | 当前最适合提供该字段的模块 |
| P0 | 第一轮可运行产品是否必须 |
| 可空 | 是否允许为空 |
| 可公开 | 是否可直接进入 Public Site / Screen Display |
| 备注 | 约束、映射或未决事项 |

## 4. 通用枚举

### 4.1 `RaceStatus`

`registration | running | judging | completed | archived | upcoming`

### 4.2 `WorkVisibility`

`private | review | public | hidden`

说明：

1. `private` 不得进入公开端。
2. `review` 可在内部演示或评审态页面出现，默认不进入公开端。
3. `public` 可进入公开端。
4. `hidden` 表示已被人工下线，不得进入公开端。

### 4.3 `ProjectionHealth`

`healthy | degraded | failed | stale`

### 4.4 `CAConnectionHealth`

`not_configured | registered | handshaken | active | failed | disabled`

### 4.5 `RiskLevel`

`low | idle | cost_watch | safety_boundary | high`

## 5. 共享对象

### 5.1 `RaceSummary`

用途：`Home`、`Race Page`、`Results`、`Review`、管理端赛事概览。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | string | D | 是 | 否 | 是 | 全局唯一 race 标识 |
| `slug` | string | D | 是 | 否 | 是 | 当前原型已存在，可与 `id` 相同 |
| `title` | string | C / D | 是 | 否 | 是 | 赛事展示名称 |
| `domain` | string | D | 是 | 否 | 是 | 领域标签，前端可做文案映射 |
| `status` | `RaceStatus` | D | 是 | 否 | 是 | 页面主状态判定依据 |
| `stageLabel` | string | C / D | 是 | 否 | 是 | 给页面直接展示的状态文案 |
| `summary` | string | C / D | 是 | 否 | 是 | 首页与详情页摘要 |
| `challenge` | string | C / D | 是 | 否 | 是 | 单场赛题说明 |
| `primaryCta` | string | C | 否 | 是 | 是 | 纯展示文案，可由前端 fallback |
| `secondaryCta` | string | C | 否 | 是 | 是 | 纯展示文案，可由前端 fallback |
| `schedule` | object | D | 是 | 否 | 是 | 见 `RaceScheduleView` |
| `metrics` | object | D | 是 | 否 | 是 | 见 `RaceMetricsView` |
| `awards` | string[] | D | 否 | 是 | 是 | 奖项名称列表，可选 |
| `safetyNotes` | string[] | D | 否 | 是 | 是 | 高敏领域安全边界说明 |
| `live` | object | D | 否 | 是 | 是 | running 态可选 live 摘要 |

### 5.2 `RaceScheduleView`

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `registration` | string | D | 是 | 否 | 是 | 当前使用展示文案，不冻结为时间戳 |
| `race` | string | D | 是 | 否 | 是 | 同上 |
| `submission` | string | D | 是 | 否 | 是 | 同上 |
| `judging` | string | D | 是 | 否 | 是 | 同上 |
| `results` | string | D | 是 | 否 | 是 | 同上 |

### 5.3 `RaceMetricsView`

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `riders` | number | D | 是 | 否 | 是 | 参赛骑手数 |
| `activeRiders` | number | D | 否 | 是 | 是 | running 态优先提供 |
| `applicants` | number | D | 否 | 是 | 是 | registration 态可提供 |
| `capacity` | number | D | 否 | 是 | 是 | registration/upcoming 态可提供 |
| `sessions` | number | D | 否 | 是 | 是 | 会话数摘要 |
| `submittedWorks` | number | D | 否 | 是 | 是 | 已提交作品数 |
| `publicWorks` | number | D | 否 | 是 | 是 | 已公开作品数 |
| `reports` | number | D | 否 | 是 | 否 | 公开端可不读，管理端可读 |
| `evidenceRefs` | number | D | 否 | 是 | 否 | 公开端不直接暴露明细，只展示聚合数 |
| `watchers` | number | D | 否 | 是 | 是 | upcoming 态可提供 |

### 5.4 `LiveProjectionView`

用途：`Live Hall`、`Screen Display`、管理端 Projection 概览。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `raceId` | string | D | 是 | 否 | 是 | 对应 `RaceSummary.id` |
| `updatedAt` | string | D | 是 | 否 | 是 | ISO 时间字符串 |
| `status` | `ProjectionHealth` | D | 是 | 否 | 是 | 若缺失则前端 fallback 为 `stale` |
| `headlineMetrics` | object | D | 是 | 否 | 是 | 见 `LiveHeadlineMetricsView` |
| `processLeaderboard` | object[] | D | 是 | 否 | 是 | 见 `ProcessLeaderboardEntry` |
| `eventStream` | object[] | D / A | 是 | 否 | 是 | 见 `LiveEventEntry` |

### 5.5 `LiveHeadlineMetricsView`

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `ridingSignal` | number | D / A | 是 | 否 | 是 | 0-100 或近似强度值 |
| `activeRiders` | number | D | 是 | 否 | 是 | 当前活跃骑手数 |
| `sessions` | number | D | 是 | 否 | 是 | 会话数摘要 |
| `submittedWorks` | number | D | 是 | 否 | 是 | 已提交作品数 |
| `totalCost` | string | D | 是 | 否 | 是 | 第一轮沿用展示字符串，后续可拆数值+币种 |
| `riskSignals` | number | D / A | 是 | 否 | 是 | 风险信号数 |

### 5.6 `ProcessLeaderboardEntry`

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `rank` | number | D | 是 | 否 | 是 | 过程榜名次 |
| `riderId` | string | D | 否 | 是 | 是 | 原型中部分条目缺失，允许为空 |
| `name` | string | D | 是 | 否 | 是 | 展示名 |
| `score` | number | D | 是 | 否 | 是 | 过程分，仅用于 Live Hall |
| `label` | string | D | 否 | 是 | 是 | 能力亮点标签 |

### 5.7 `LiveEventEntry`

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `time` | string | D / A | 是 | 否 | 是 | 当前原型直接显示 `HH:mm` |
| `type` | string | D / A | 是 | 否 | 是 | 如 `session_summary`、`risk`、`work` |
| `text` | string | D / A | 是 | 否 | 是 | 已脱敏、可公开的事件文案 |

### 5.8 `PublishedWorkView`

用途：`Works`、`Work Page`、`Results` 回链、`Rider Profile`。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | string | D | 是 | 否 | 是 | 作品 ID |
| `raceId` | string | D | 是 | 否 | 是 | 所属赛事 |
| `riderId` | string | D | 是 | 否 | 是 | 作者骑手 |
| `title` | string | C / D | 是 | 否 | 是 | 作品标题 |
| `status` | string | D | 是 | 否 | 否 | 如 `draft`、`submitted`、`published` |
| `visibility` | `WorkVisibility` | B / D | 是 | 否 | 否 | 管理规则优先读这里 |
| `summary` | string | C / D | 是 | 否 | 条件公开 | 仅 `visibility=public` 时可直接公开 |
| `demo` | string | D | 否 | 是 | 条件公开 | 可公开时显示链接 |
| `repo` | string | D | 否 | 是 | 条件公开 | 若不允许公开可为空 |
| `evidenceRefs` | string[] | D | 否 | 是 | 否 | 只做内部关联，不默认公开 |
| `awardIds` | string[] | D | 否 | 是 | 是 | 公开作品可展示获奖关系 |

公开规则：

1. Public Site 只应读取 `visibility=public` 的作品。
2. `visibility=review` 可进入内部演示或评审态页面，不应默认公开。
3. `hidden` 永远不得进入公开端。

### 5.9 `PublishedResultView`

用途：`Results`、`Home latest results`、`Review` 回链。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | string | D | 是 | 否 | 是 | 奖项记录 ID |
| `raceId` | string | D | 是 | 否 | 是 | 所属赛事 |
| `name` | string | D | 是 | 否 | 是 | 奖项名称 |
| `rank` | number | D | 是 | 否 | 是 | 排名 |
| `workId` | string | D | 是 | 否 | 是 | 对应作品 |
| `riderName` | string | D | 是 | 否 | 是 | 第一轮直接保留展示名 |
| `reason` | string | B / D | 是 | 否 | 是 | 对外发布后的决策理由摘要 |
| `published` | boolean | B / D | 是 | 否 | 否 | 若为 `false` 不得进入公开端 |

说明：当前原型只有已发布赛果样例，没有独立 `published` 字段。第一轮整合应补上该字段，不能只靠页面猜测。

### 5.10 `PublishedReviewView`

用途：`Review` 页面、`Results` 回链、首页复盘入口。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `raceId` | string | D | 是 | 否 | 是 | 所属赛事 |
| `status` | string | B / D | 是 | 否 | 否 | 第一轮至少区分 `draft` / `published` |
| `summary` | string | B / D | 是 | 否 | 条件公开 | 仅 `published` 时公开 |
| `featuredCases` | string[] | B / D | 否 | 是 | 条件公开 | 公开案例标题 |
| `judgeComments` | string[] | B / D | 否 | 是 | 条件公开 | 应为公开摘要，不是原始评审材料 |

### 5.11 `PublicRiderProfileView`

用途：`Rider Profile`、首页精选骑手、作品作者摘要。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `riderId` | string | D | 是 | 否 | 是 | 骑手 ID |
| `displayName` | string | D | 是 | 否 | 是 | 公开展示名 |
| `headline` | string | C / D | 是 | 否 | 是 | 一句话能力摘要 |
| `featuredRaceIds` | string[] | D | 否 | 是 | 是 | 代表赛事 |
| `featuredWorkIds` | string[] | D | 否 | 是 | 是 | 代表作品 |
| `skillTags` | string[] | D | 是 | 否 | 是 | 公开能力标签 |
| `stats` | object | D | 否 | 是 | 是 | 见 `RiderProfileStatsView` |
| `visibility` | string | B / D | 是 | 否 | 否 | 第一轮建议补 `public | hidden` |

### 5.12 `RiderProfileStatsView`

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `projects` | number | D | 否 | 是 | 是 | 参与项目数 |
| `sessions` | number | D | 否 | 是 | 是 | 会话数 |
| `completion` | string | D | 否 | 是 | 是 | 第一轮沿用展示字符串 |
| `ranking` | string | D | 否 | 是 | 是 | 第一轮沿用展示字符串 |

### 5.13 `CAConnectionStatusView`

用途：管理端 `CA 健康`、`Maintenance`、赛事风险提示、后续 Live Hall 风险角标。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `raceId` | string | D | 是 | 否 | 否 | 所属赛事 |
| `registrationId` | string | A / D | 是 | 否 | 否 | 参赛报名 |
| `raceProjectId` | string | A / D | 是 | 否 | 否 | 参赛工作区 |
| `caConnectionId` | string | A / D | 否 | 是 | 否 | 未配置时可空 |
| `caType` | string | A / D | 否 | 是 | 否 | 第一轮预期 `claude_code` |
| `health` | `CAConnectionHealth` | A / D | 是 | 否 | 否 | 聚合健康状态 |
| `lastSyncedAt` | string | A / D | 否 | 是 | 否 | 最近同步时间 |
| `failureReason` | string | A / D | 否 | 是 | 否 | 失败原因码或摘要 |
| `riskHint` | string | B / D | 否 | 是 | 条件公开 | 对公开端只允许展示脱敏风险提示 |

### 5.14 `DashboardOverview`

用途：管理端首页总览。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `totalUsers` | number | B / D | 是 | 否 | 否 | 平台用户总数 |
| `activeRaces` | number | B / D | 是 | 否 | 否 | running 态赛事数 |
| `totalRegistrations` | number | B / D | 是 | 否 | 否 | 报名总数 |
| `caCoverageRate` | number | B / D | 是 | 否 | 否 | 0-1 或百分比需统一，建议 0-1 |
| `workSubmissionRate` | number | B / D | 否 | 是 | 否 | 0-1 |
| `systemHealth` | string | B / D | 是 | 否 | 否 | `healthy | degraded | down` |

### 5.15 `ProjectionStatus`

用途：管理端 Projection 状态列表、重算入口。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `raceId` | string | B / D | 是 | 否 | 否 | 所属赛事 |
| `projectionType` | string | B / D | 是 | 否 | 否 | 如 `race_progress`、`cost`、`risk`、`screen_feed` |
| `status` | `ProjectionHealth` | B / D | 是 | 否 | 否 | 投影状态 |
| `updatedAt` | string | B / D | 是 | 否 | 否 | 最近更新时间 |
| `rebuildable` | boolean | B | 否 | 是 | 否 | 管理端按钮控制 |
| `failureReason` | string | B / D | 否 | 是 | 否 | 失败摘要 |

### 5.16 `PublishedArtifactStatus`

用途：管理端发布态列表，统一表示 `Results` / `Review` / `Report` 之类可公开资产。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `artifactType` | string | B / D | 是 | 否 | 否 | 如 `results`、`review`、`report` |
| `raceId` | string | B / D | 是 | 否 | 否 | 所属赛事 |
| `status` | string | B / D | 是 | 否 | 否 | 建议至少 `draft | generated | reviewed | published | failed` |
| `publishedAt` | string | B / D | 否 | 是 | 否 | 发布时间 |
| `ownerRole` | string | B | 否 | 是 | 否 | 当前发布 owner，待边界裁定 |
| `failureReason` | string | B / D | 否 | 是 | 否 | 失败摘要 |

### 5.17 `AuditLogEntry`

用途：管理端审计日志。

| 字段 | 类型 | 来源方 | P0 | 可空 | 可公开 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | string | B / D | 是 | 否 | 否 | 审计记录 ID |
| `actionType` | string | B | 是 | 否 | 否 | 如 `roles_changed`、`projection_rebuilt` |
| `actorUserId` | string | B / D | 是 | 否 | 否 | 操作人 |
| `actorGithubAccount` | string | B / D | 否 | 是 | 否 | 当前管理文档已有该方向 |
| `targetType` | string | B | 是 | 否 | 否 | 如 `user`、`work`、`projection` |
| `targetId` | string | B | 是 | 否 | 否 | 目标对象 |
| `summary` | string | B | 是 | 否 | 否 | 可展示审计摘要 |
| `reason` | string | B | 否 | 是 | 否 | 人工操作原因 |
| `createdAt` | string | B / D | 是 | 否 | 否 | 操作时间 |

## 6. 第一轮 adapter 输出建议

如果第一轮继续基于 `design-prototype/` 集成，建议统一 adapter 输出结构至少包含：

```json
{
  "metadata": {},
  "series": {},
  "raceGroups": {},
  "races": ["RaceSummary"],
  "riders": [],
  "works": ["PublishedWorkView"],
  "liveProjections": ["LiveProjectionView"],
  "awards": ["PublishedResultView"],
  "reviews": ["PublishedReviewView"],
  "profiles": ["PublicRiderProfileView"],
  "dashboard": "DashboardOverview",
  "caStatuses": ["CAConnectionStatusView"]
}
```

说明：

1. 前 10 个键尽量兼容现有 `sample-races.json`。
2. `dashboard` 和 `caStatuses` 是为管理端与集成层补出的新增读取面。

## 7. 当前未决项

以下字段仍需后续边界会裁定：

1. `PublishedResultView.published` 的唯一 owner 是 Organizer 还是 Admin。
2. `PublishedReviewView.status` 的状态机是否与 `Report` 共用。
3. `CAConnectionStatusView.riskHint` 的公开粒度。
4. `PublicRiderProfileView.visibility` 的 owner 和默认值。
5. `DashboardOverview.caCoverageRate`、`workSubmissionRate` 最终返回比例还是百分数字符串。
6. `totalCost`、`completion`、`ranking` 是否在第二轮改为结构化数值。

## 8. 第一轮落地建议

1. 由整合人先按本文创建一份统一 mock 数据。
2. C 前端展示只读取 `RaceSummary`、`LiveProjectionView`、`PublishedWorkView`、`PublishedResultView`、`PublishedReviewView`、`PublicRiderProfileView`。
3. B 管理系统只读取 `DashboardOverview`、`ProjectionStatus`、`PublishedArtifactStatus`、`AuditLogEntry`、`CAConnectionStatusView`。
4. A Rider 客户端先只保证能稳定产出与 `LiveEventEntry`、`CAConnectionStatusView` 对齐的输入样例，不要求第一轮直接接 UI。
5. D 数据层先补一份能映射到本文字段的权威 mock / export，再逐步替换底层真实产物。