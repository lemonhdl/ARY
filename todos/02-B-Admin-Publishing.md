# B 组任务：管理系统完整任务与发布治理交付

本文保留原始管理系统设计中的详细模块、页面、接口、权限和边界说明，并在后半部分追加统一读取模型、样例文件与 handoff 要求。

## 1. 定位与边界

管理系统在 ARY 中的位置是平台级管理中枢，不是赛事执行工具。管理系统 = Admin Console + System Dashboard + Internal Maintenance + Audit & Config。

你负责：

1. 跨赛事、全平台视角的管理。
2. User、System Config、全局健康的读取与维护。
3. 发布治理、审计、异常处理。

你不负责：

1. 赛事创建、编辑、发布、归档。
2. 报名审核。
3. 评审分配。
4. 选手 CA 接入配置。
5. 作品提交与管理。
6. Screen Console 控制面。
7. 数据库 Schema 设计。
8. 前端路由或组件整合。
9. 公开端页面。

## 2. 功能模块总览

管理系统按优先级分为三层：

1. `M1` 账号与角色管理（Admin Console）。
2. `M2` 系统运行仪表盘（System Dashboard）。
3. `M3` 内部数据维护（Internal Maintenance）。
4. `M4` 系统配置管理（System Config）。
5. `M5` 审计日志（Audit Log）。

## 3. M1 账号与角色管理（Admin Console）

### 3.1 页面结构

```text
/console/admin
├─ /users
├─ /users/:userId
├─ /profile-completion
└─ /roles
```

### 3.2 用户列表页

页面功能：

1. 查看所有通过 GitHub 登录的 ARY User。
2. 按 GitHub 账号、displayName、邮箱搜索。
3. 按 roles、资料补全状态筛选。
4. 按注册时间、最近登录时间排序。

列表字段：头像、displayName、githubAccount、profileCompleted、roles、registeredAt、lastSignInAt、raceCount。

状态标识：

1. 资料未补全，标记“待补全”。
2. 无角色，标记“未授权”。
3. 异常账号，标记“需处理”。

### 3.3 用户详情页

必须包含：

1. GitHub 账号信息。
2. ARY 个人资料。
3. 资料补全状态和补全时间。
4. 当前 `User.roles`。
5. 角色授予与撤销操作。
6. 参赛记录只读摘要。
7. 危险操作区，如暂停账号、强制下线。

### 3.4 角色变更约束

1. 必须至少保留一个 admin 账号。
2. 不能撤销自己的 admin role。
3. 角色变更必须记录审计日志。
4. `User.roles` 是 Set，同一 role 不重复授予。

### 3.5 资料补全状态总览

必须支持：

1. 已补全与未补全分类。
2. 补全率统计。
3. 未补全用户筛选。

补全字段检查：displayName、学校或单位、联系方式。

## 4. M2 系统运行仪表盘（System Dashboard）

页面结构：

```text
/console/admin/dashboard
├─ 平台总览卡片行
├─ 赛事状态分布
├─ CA 接入全局健康
├─ Projection 状态
├─ Report 状态
└─ 关键性能指标
```

### 4.1 平台总览卡片

必须展示：总用户数、活跃赛事数、总报名数、CA 接入率、作品提交率、系统健康状态。

### 4.2 赛事状态分布

需要按 `draft`、`published`、`registration`、`running`、`judging`、`completed`、`archived` 等状态展示，并可跳转到具体赛事。

### 4.3 CA 接入全局健康

必须展示：

1. 总 Registration 数。
2. CA 已配置数。
3. CA active 数。
4. CA failed 数。
5. CA 未配置数。
6. 接入异常列表。

### 4.4 Projection / Report / 性能指标

Projection 需要看最近重建时间、失败列表、类型分布和重算入口。

Report 需要看生成状态、失败列表、发布状态以及“未发布但赛事已结束”的提醒。

性能指标需要看公开页首屏响应时间、Live Hall 刷新、Screen Console 页面切换、GitHub 登录成功率、并发在线用户数。

## 5. M3 内部数据维护（Internal Maintenance）

页面结构：

```text
/console/admin/maintenance
├─ CA 接入状态详情
├─ Projection 管理
├─ Report 管理
└─ 公开展示异常处理
```

### 5.1 CA 接入状态详情

按 Race 或 User 查看接入状态；查看单个 CAConnection 详细信息和失败原因；查看 RaceProject 聚合接入健康度；可标记已知异常连接。

### 5.2 Projection 管理

可执行：查看 Projection 状态、手动重算、批量重算、查看重算历史。

约束：Projection 重算不影响核心事实数据；重算期间可回退到上一稳定版本；重算完成后记录操作日志。

### 5.3 Report 管理

可执行：查看 Report 生成状态、手动重跑、查看失败原因、标记已审核。

### 5.4 公开展示异常处理

可执行：隐藏 Work、隐藏 Rider Profile、标记异常数据。

约束：隐藏不删除数据，仅控制可见性；必须有原因；必须写审计日志。

## 6. M4 系统配置管理（System Config）

配置项至少应覆盖：

1. 支持的 CA 类型注册。
2. Connector 版本管理。
3. Connector 端点配置。
4. 公开注册开关。
5. 报名开关。
6. 维护模式。
7. Projection 默认刷新间隔。
8. Session 数据保留天数。
9. 最大 CAConnection 数 / RaceProject。

## 7. M5 审计日志（Audit Log）

需记录的操作包括：

1. `User.roles` 变更。
2. 资料补全状态变更。
3. Admin 登录。
4. Projection 手动重算。
5. Report 手动重跑。
6. Work 可见性变更。
7. 系统配置变更。
8. 权限越权尝试。

日志字段至少包含：`logId`、`timestamp`、`actorUserId`、`actorGithubAccount`、`actionType`、`targetResourceType`、`targetResourceId`、`detail`、`ip`、`userAgent`、`result`。

## 8. 与团队其他模块的接口边界

你需要消费外部的 User、Race、Registration、CA 接入状态、Projection 状态、Report 状态、Work 可见性、审计日志存储能力。

你需要暴露给外部：

1. 权限校验中间件或服务。
2. `User.roles` 查询。
3. 系统配置读取。
4. 维护模式状态。

## 9. 权限模型

管理系统的每个 API 端点必须：

1. 验证请求者已登录。
2. 验证请求者具有 `admin` role。
3. 对 `managed race` 范围操作，验证 Organizer 是否负责该 Race。

## 10. 统一执行输入

必须先读：

1. `todos/10-Shared-Field-Dictionary.md`
2. `todos/11-Publication-Visibility-Rules.md`
3. `todos/16-Project-Baseline-Requirements.md`
4. 本文

## 11. 统一交付输出

你必须在 `deliverables/b-admin/` 下交出以下产物：

1. `handoff.manifest.json`
2. `dashboard-overview.sample.json`
3. `projection-status.sample.json`
4. `published-artifacts.sample.json`
5. `audit-log.sample.json`
6. `admin-read-models.md`
7. `user-roles.sample.json`
8. `profile-completion.sample.json`
9. `system-config.sample.json`
10. `maintenance-ops.md`

## 12. 交付附加要求

`published-artifacts.sample.json` 必须覆盖 Results、Review、Report 发布态和撤回态，并遵守 `todos/11-Publication-Visibility-Rules.md`。

`admin-read-models.md` 必须明确映射到 `DashboardOverview`、`ProjectionStatus`、`PublishedArtifactStatus`、`AuditLogEntry`。

`maintenance-ops.md` 必须说明 Work visibility 变更、Rider Profile visibility 变更、Projection 重算、Report 重跑。

## 13. 验收标准

1. E 能读取你的产物判断哪些 Results、Review、Profile、Work 可公开。
2. C 不需要自己发明公开规则。
3. D 能基于你的读取模型补齐统一 mock 数据中的管理端部分。
4. 交付内容不能把原始管理系统任务降格成几份样例文件。