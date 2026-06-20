# B 组管理端读取模型

版本：v0.2
上游契约：`todos/10-Shared-Field-Dictionary.md`、`todos/11-Publication-Visibility-Rules.md`

本文定义 B 组管理系统交付的四个核心读取模型，供 C（前端壳）、D（权威 mock）、E（自动集成）对齐消费。

---

# 1. DashboardOverview

## 1.1 用途

系统运行仪表盘首屏总览。C 的 admin dashboard 页面直接读取此结构渲染平台总览卡片、赛事分布和关键指标。

## 1.2 字段定义

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| totalUsers | number | 是 | 已登录 ARY 的用户总数 |
| activeRaces | number | 是 | 当前 status=running 的 Race 数量 |
| totalRegistrations | number | 是 | 所有 Race 的 Registration 累计数 |
| caIngestionRate | number | 建议 | RaceProject 至少有一个 active CAConnection 的比例(0-1) |
| workSubmissionRate | number | 建议 | 已提交 Work / 已批准 Registration (0-1) |
| systemHealth | string | 是 | `healthy` / `degraded` / `down` |

## 1.3 赛事状态分布

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| raceStatusDistribution | object | 是 | 按 RaceStatus 分组的计数 |
| raceStatusDistribution.draft | number | 是 | |
| raceStatusDistribution.published | number | 是 | |
| raceStatusDistribution.registration | number | 是 | |
| raceStatusDistribution.running | number | 是 | |
| raceStatusDistribution.judging | number | 是 | |
| raceStatusDistribution.completed | number | 是 | |
| raceStatusDistribution.archived | number | 是 | |

## 1.4 CA 接入全局健康

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| caHealth.totalRegistrations | number | 是 | 全部 approved Registration 数 |
| caHealth.configured | number | 是 | RaceProject 至少有一个 CAConnection 的 Registration 数 |
| caHealth.active | number | 是 | 至少一个 CAConnection active 的 Registration 数 |
| caHealth.failed | number | 是 | RaceProject 聚合状态为 failed 的 Registration 数 |
| caHealth.notConfigured | number | 是 | 从未配置过 CAConnection 的 Registration 数 |

## 1.5 性能指标

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| performance.publicPageMs | number | 建议 | 公开页首屏响应时间(ms)，目标<1000 |
| performance.liveHallRefreshMs | number | 建议 | Live Hall 数据刷新时间(ms)，目标<3000 |
| performance.screenPageMs | number | 建议 | Screen Console 页面切换时间(ms)，目标<1000 |
| performance.loginSuccessRate | number | 建议 | GitHub 登录成功率(0-1) |
| performance.concurrentUsers | number | 建议 | 当前并发在线用户数 |

## 1.6 样例结构

参见 `dashboard-overview.sample.json`。

---

# 2. ProjectionStatus

## 2.1 用途

追踪每个 Race 的各类 Projection 生成状态。C 的 admin maintenance 页面和 E 的装配脚本都可能消费此模型。

## 2.2 字段定义

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| raceId | string | 是 | 所属 Race ID |
| raceTitle | string | 是 | 赛事名称（冗余，方便展示） |
| projectionType | string | 是 | `race_progress` / `cost` / `risk` / `submission` / `judging` / `current_leaderboard` / `screen_feed` |
| health | string | 是 | 共享枚举 `ProjectionHealth`：`healthy` / `degraded` / `failed` / `stale` |
| lastRebuiltAt | string(ISO 8601) | 是 | 最近一次成功重建时间 |
| lastFailedAt | string(ISO 8601) | 可选 | 最近一次重建失败时间 |
| failureReason | string | 可选 | 失败原因摘要 |
| rebuildCount | number | 建议 | 累计重建次数 |
| staleThresholdSeconds | number | 建议 | 超过此秒数未更新视为 stale |

## 2.3 与共享字段字典的关系

`health` 使用 `ProjectionHealth` 枚举；`projectionType` 对应领域模型中的 ProjectionType。

## 2.4 样例结构

参见 `projection-status.sample.json`。

---

# 3. PublishedArtifactStatus

## 3.1 用途

追踪 Results、Review、Report、Work、Rider Profile 的发布态与可见性。此模型是 C 判断"能否进入 Public Site"的直接输入。

## 3.2 核心规则

遵守 `todos/11-Publication-Visibility-Rules.md`：
- Work 只有 `visibility = public` 才能进公开端
- Result 只有 `publicationStatus = published` 才能进公开端
- Review / Report 只有已发布且公开可见才能进公开端
- Rider Profile 只有公开档案才能进公开端

## 3.3 通用字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| artifactType | string | 是 | `result` / `review` / `report` / `work` / `rider_profile` |
| artifactId | string | 是 | 作品/赛果/报告等资源 ID |
| raceId | string | 是 | 所属 Race ID |
| publicationStatus | string | 是 | `draft` / `published` / `withdrawn` |
| visibility | string | 是 | 仅 Work 和 Profile 使用：`private` / `review` / `public` / `hidden` |
| publishedAt | string(ISO 8601) | 可选 | 首次发布时间 |
| withdrawnAt | string(ISO 8601) | 可选 | 撤回时间 |
| withdrawnReason | string | 可选 | 撤回原因 |
| isPubliclyVisible | boolean | 是 | 综合判定结果：C 和 E 的直接消费字段 |
| lastModifiedAt | string(ISO 8601) | 是 | 最近状态修改时间 |

## 3.4 isPubliclyVisible 判定逻辑

| artifactType | isPubliclyVisible = true 条件 |
|-------------|-------------------------------|
| work | `visibility = public` |
| result | `publicationStatus = published` |
| review | `publicationStatus = published` |
| report | `publicationStatus = published` |
| rider_profile | `visibility = public` |

如果某资源被撤回，`publicationStatus = withdrawn`，`isPubliclyVisible = false`。

## 3.5 样例结构

参见 `published-artifacts.sample.json`。该文件必须覆盖：
- Results 的发布态和撤回态
- Review 的发布态
- Report（race_report、review_summary）的发布态和未发布态
- Work 的 public/private/hidden 态
- Rider Profile 的公开/隐藏态

---

# 4. AuditLogEntry

## 4.1 用途

记录平台级敏感操作，支撑安全审计和事故追溯。Admin 可在审计日志页面查看。

## 4.2 字段定义

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| logId | string | 是 | 日志唯一标识 |
| timestamp | string(ISO 8601) | 是 | 操作发生时间 |
| actorUserId | string | 是 | 操作人 User ID |
| actorGithubAccount | string | 是 | 操作人 GitHub 账号（冗余，方便展示） |
| actionType | string | 是 | `role_change` / `profile_update` / `admin_login` / `projection_rebuild` / `report_regenerate` / `report_reviewed` / `ca_anomaly_flag_change` / `work_visibility_change` / `profile_visibility_change` / `config_update` / `access_denied` |
| targetResourceType | string | 是 | 被操作资源类型：`User` / `Race` / `Work` / `Projection` / `Report` / `Config` |
| targetResourceId | string | 是 | 被操作资源 ID |
| detail | object | 是 | 操作详情（变更前后值、原因等），结构因 actionType 而异 |
| ip | string | 建议 | 操作来源 IP |
| userAgent | string | 建议 | 操作来源 User-Agent |
| result | string | 是 | `success` / `failed` / `denied` |

## 4.3 detail 字段按 actionType 的结构

### role_change
```json
{
  "previousRoles": ["rider"],
  "newRoles": ["rider", "judge"],
  "reason": "指定为评委"
}
```

### profile_update（资料补全状态变更）
```json
{
  "previousProfile": { "displayName": "Ana Ruiz", "organization": "SZU Design Lab", "contact": "" },
  "newProfile": { "displayName": "Ana Ruiz", "organization": "SZU Design Lab", "contact": "ana.ruiz@example.com" },
  "reason": "用户自行补全联系方式"
}
```
> 区别于 `profile_visibility_change`：`profile_update` 记录用户资料字段（displayName、organization、contact）的变更；`profile_visibility_change` 记录 Rider Profile 公开展示开关（public/hidden）的变更。两者是不同的操作类型，下游按 actionType 过滤、聚合时不应混用。

### projection_rebuild
```json
{
  "raceId": "bay-area-happy-trip",
  "projectionTypes": ["race_progress", "cost", "screen_feed"],
  "reason": "手动重算"
}
```

### report_reviewed
```json
{
  "raceId": "bay-area-happy-trip",
  "reportType": "race_report",
  "subjectRegistrationId": null,
  "previousReviewStatus": "pending",
  "newReviewStatus": "reviewed",
  "reason": "人工审核通过，允许进入发布流程"
}
```

### ca_anomaly_flag_change
```json
{
  "raceId": "bay-area-happy-trip",
  "riderId": "rider-bay-fail-01",
  "previousFlaggedAnomaly": false,
  "newFlaggedAnomaly": true,
  "previousAnomalyNote": null,
  "newAnomalyNote": "已确认该失败为已知异常，等待 connector 修复",
  "reason": "手动标记为已知异常"
}
```

### work_visibility_change
```json
{
  "previousVisibility": "public",
  "newVisibility": "hidden",
  "reason": "包含不当内容"
}
```

### config_update
```json
{
  "configKey": "maintenance_mode",
  "previousValue": false,
  "newValue": true
}
```

## 4.4 样例结构

参见 `audit-log.sample.json`。

---

# 5. 补充读取模型（非共享契约核心，B 组自维护）

## 5.1 UserRolesView

用于 Admin Console 用户列表和用户详情。字段对齐 `User` 领域实体。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string | 是 | |
| githubAccount | string | 是 | |
| displayName | string | 是 | |
| avatarUrl | string | 可选 | |
| profileCompleted | boolean | 是 | |
| roles | string[] | 是 | `rider` / `judge` / `organizer` / `admin` 的子集 |
| registeredAt | string(ISO 8601) | 是 | |
| lastSignInAt | string(ISO 8601) | 是 | |
| raceCount | number | 建议 | 参与赛事数（派生统计） |

参见 `user-roles.sample.json`。

## 5.2 ProfileCompletionView

用于资料补全状态总览。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| userId | string | 是 | |
| displayName | string | 是 | |
| displayNameFilled | boolean | 是 | |
| organizationFilled | boolean | 是 | 学校/单位是否已填 |
| contactFilled | boolean | 是 | 联系方式是否已填 |
| profileCompleted | boolean | 是 | 综合判定 |
| completedAt | string(ISO 8601) | 可选 | 补全时间 |
| completionRate | number | 是 | 全局补全率(0-1) |

参见 `profile-completion.sample.json`。

## 5.3 SystemConfigView

用于系统配置管理。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| configKey | string | 是 | 配置项唯一标识 |
| configValue | any | 是 | |
| defaultValue | any | 是 | 默认值 |
| description | string | 是 | |
| updatedAt | string(ISO 8601) | 可选 | 最近更新时间 |
| updatedBy | string | 可选 | 最近更新人 |

参见 `system-config.sample.json`。

---

# 6. 共享枚举汇总

以下枚举直接引用 `todos/10-Shared-Field-Dictionary.md`，在此仅列名确认对齐：

| 枚举 | 使用字段 | 值 |
|------|---------|-----|
| RaceStatus | DashboardOverview.raceStatusDistribution | `registration` / `running` / `judging` / `completed` / `archived` / `upcoming` |
| ProjectionHealth | ProjectionStatus.health | `healthy` / `degraded` / `failed` / `stale` |
| CAConnectionHealth | DashboardOverview.caHealth | `not_configured` / `registered` / `handshaken` / `active` / `failed` / `disabled` |
| WorkVisibility | PublishedArtifactStatus.visibility | `private` / `review` / `public` / `hidden` |

---

# 7. C 和 E 的消费指引

1. **C（前端壳）**：admin dashboard 页面优先读取 `DashboardOverview`；admin maintenance 页面读取 `ProjectionStatus` 和 `PublishedArtifactStatus`；admin audit 页面读取 `AuditLogEntry`。
2. **D（权威 mock）**：`authority-mock.json` 中的 `dashboard`、`projectionStatuses`、`publishedArtifacts`、`auditLogs` 顶层字段应分别映射到本文四个模型。
3. **E（自动集成）**：assembly 时校验 `isPubliclyVisible` 字段未被绕过，确保公开端不泄露未发布内容。
