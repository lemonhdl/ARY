# 权威 Mock 数据规范

## 1. 目标

为第一轮可运行产品提供唯一权威 mock 数据源，避免 A、B、C、D、E 各自维护一套相似但不兼容的数据。

## 2. 权威主文件

必须由 D 交付：

`deliverables/d-data/authority-mock.json`

## 3. 最低对象覆盖

必须覆盖：

1. `races`
2. `liveProjections`
3. `works`
4. `awards`
5. `reviews`
6. `profiles`
7. `dashboard`
8. `caStatuses`
9. `projectionStatuses`
10. `publishedArtifacts`
11. `auditLogs`

## 4. 数据来源优先级

1. D 的 `authority-mock.json` 是主数据源。
2. A、B 的样例用于补齐赛时与管理侧信息。
3. `design-prototype/data/sample-races.json` 只作为初始参考，不再作为最终权威源。

## 5. 执行要求

1. 所有对象必须可映射到 `10-Shared-Field-Dictionary.md`。
2. 所有公开字段必须满足 `11-Publication-Visibility-Rules.md`。
3. E 不得再维护第二份主 mock。