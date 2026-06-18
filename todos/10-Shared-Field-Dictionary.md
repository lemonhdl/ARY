# 共享字段字典

本文件是分发版共享字段字典。字段口径以 `tasks/ARY-shared-field-dictionary.md` 为基础，但这里用“面向执行”的方式压缩成分工包入口。

## 1. 第一轮必须统一的共享对象

1. `RaceSummary`
2. `LiveProjectionView`
3. `PublishedWorkView`
4. `PublishedResultView`
5. `PublishedReviewView`
6. `PublicRiderProfileView`
7. `CAConnectionStatusView`
8. `DashboardOverview`
9. `ProjectionStatus`
10. `PublishedArtifactStatus`
11. `AuditLogEntry`

## 2. 第一轮核心枚举

### `RaceStatus`

`registration | running | judging | completed | archived | upcoming`

### `WorkVisibility`

`private | review | public | hidden`

### `ProjectionHealth`

`healthy | degraded | failed | stale`

### `CAConnectionHealth`

`not_configured | registered | handshaken | active | failed | disabled`

## 3. 执行要求

1. A 到 E 不得自行扩展同名字段的含义。
2. 新增字段允许追加，但不得改变本文件定义字段的语义。
3. 所有交付都以本文件和 `11-Publication-Visibility-Rules.md` 的组合为准。
4. 如果只分发 `todos/`，则本文件就是共享字段的直接执行入口，不依赖 `tasks/` 目录。

## 4. 详细字段基线

详细字段定义直接以 `tasks/ARY-shared-field-dictionary.md` 为权威基线执行。