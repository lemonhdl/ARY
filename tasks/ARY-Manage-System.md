# ARY 管理系统设计

版本：v0.1
文档类型：管理系统功能设计
负责范围：ARY 平台级管理系统
上游文档：`docs/ary-mvp.prd.md`、`docs/ary-mvp.ia.md`、`docs/ary-permission-matrix.md`、`docs/ary-domain-analysis.v0.3.md`

---

# 1. 定位与边界

## 1.1 管理系统在 ARY 中的位置

ARY 平台根据产品体验面划分为五类：

```text
ARY
├─ Public Site         公开端 — 公众浏览赛事、作品、赛果
├─ Race Console        赛事工作台 — 围绕单场 Race 的执行操作
│  ├─ Organizer View   主办方视图 — 由 Organizer 端负责
│  ├─ Rider View       选手视图 — 由 Rider 端负责
│  └─ Judge View       评委视图 — 可归 Organizer 端或 Rider 端
├─ Admin Console       账号与角色控制台 — ★ 管理系统核心
├─ Screen Console      大屏控制台 — 可由 Organizer 端或管理系统承载
└─ Screen Display      大屏展示输出
```

**管理系统 = Admin Console + System Dashboard + Internal Maintenance + Audit & Config**

## 1.2 核心定位

管理系统是 ARY 的**平台级管理中枢**，不是赛事执行工具。关键区分：

| 维度 | 管理系统（你负责） | Race Console（Organizer/Rider 端） |
|------|-------------------|----------------------------------|
| 管理范围 | 跨赛事、全平台 | 单场 Race 内部 |
| 操作角色 | Admin（admin role） | Organizer / Rider / Judge |
| 核心对象 | User、System Config、全局健康 | Race、Registration、Work、Judging |
| 典型操作 | 分配角色、查看全局状态、重算 Projection | 创建赛事、审核报名、提交作品 |
| 信息视角 | 平台运维视角 | 赛事执行视角 |

## 1.3 不做事项

以下内容**不在管理系统范围内**，由其他团队成员负责：

| 内容 | 归属 |
|------|------|
| 赛事创建、编辑、发布、归档 | Organizer 端 |
| 报名审核（approve/reject） | Organizer 端 |
| 评审分配（JudgeAssignment） | Organizer 端 |
| 选手 CA 接入配置 | Rider 端 |
| 作品提交与管理 | Rider 端 |
| Screen Console 大屏控制 | Organizer 端（或整合统一） |
| 数据库 Schema 设计 | 数据及数据库 |
| 前端路由/组件整合 | 整合统一 |
| 公开端页面 | 整合统一 |

---

# 2. 功能模块总览

管理系统按优先级分为三层：

```text
ARY Management System
│
├─ P0 第一场赛事必须具备
│  ├─ M1 账号与角色管理 (Admin Console)
│  ├─ M2 系统运行仪表盘 (System Dashboard)
│  └─ M3 内部数据维护 (Internal Maintenance)
│
├─ P1 体现平台管理能力
│  ├─ M4 系统配置管理 (System Config)
│  └─ M5 审计日志 (Audit Log)
│
└─ P2 后续增强
   ├─ M6 高级监控与告警
   └─ M7 多租户/多组织管理（当前 MVP 不做）
```

---

# 3. M1 账号与角色管理 (Admin Console)

> 来源：`docs/ary-mvp.prd.md` §7.2、`docs/ary-mvp.ia.md` §8.5、`docs/ary-permission-matrix.md` §3.11

## 3.1 功能概述

Admin Console 是管理系统最核心的模块，承载 ARY 平台所有用户账号和角色身份的管理。它的定位是**最小账号与角色管理**——只做必须由平台管理员做的事。

## 3.2 页面结构

```text
/console/admin
├─ /users                    用户列表
├─ /users/:userId            用户详情
│  ├─ 基本信息
│  ├─ 资料补全状态
│  ├─ 当前 roles
│  └─ 角色变更操作
├─ /profile-completion       资料补全状态总览
└─ /roles                    角色管理（按角色维度查看用户）
```

## 3.3 用户列表页

### 页面功能
- 查看所有通过 GitHub 登录的 ARY User
- 搜索：按 GitHub 账号、displayName、邮箱
- 筛选：按 roles（rider/judge/organizer/admin）、按资料补全状态
- 排序：按注册时间、最近登录时间

### 列表字段
| 字段 | 说明 | 来源 |
|------|------|------|
| 头像 | GitHub 头像 | User.githubAccount |
| displayName | 显示名称 | User.displayName |
| githubAccount | GitHub 账号名 | User.githubAccount |
| profileCompleted | 资料是否补全 | User.profileCompleted |
| roles | 当前角色集合 | User.roles |
| registeredAt | 首次登录时间 | User.registeredAt |
| lastSignInAt | 最近登录时间 | User.lastSignInAt |
| raceCount | 参与赛事数（可选） | 派生统计 |

### 用户状态标识
- 资料未补全：标记"待补全"
- 无角色：标记"未授权"（仅有登录但无任何 role）
- 异常账号：标记"需处理"（如 GitHub 账号已注销）

## 3.4 用户详情页

### 基本信息区
- GitHub 账号信息（头像、用户名、主页链接）
- ARY 个人资料（displayName、学校/单位、联系方式）
- 资料补全状态和补全时间

### 角色管理区
- 当前 User.roles 展示（rider / judge / organizer / admin）
- 角色的授予和撤销操作
- 每个角色的授予时间、授予人（若后续建模 RoleAssignment 可追溯）

### 参赛记录区（只读摘要）
- 参加过的 Race 列表（从 Registration 读取）
- 各 Race 中的 Registration 状态
- 拥有的作品数、获奖数

### 危险操作区
- 暂停账号（禁止登录）
- 强制下线
- 数据清除请求（MVP 可不做）

## 3.5 角色变更操作

### 可执行的操作
| 操作 | 权限 | 说明 |
|------|------|------|
| 授予 rider role | admin | 使 User 可报名参赛 |
| 授予 judge role | admin | 使 User 可成为评委 |
| 授予 organizer role | admin | 使 User 可创建和管理赛事 |
| 授予 admin role | admin | 使 User 成为管理员（谨慎） |
| 撤销任意 role | admin | 移除 User 的某个角色 |

### 约束规则
- 必须至少保留一个 admin 账号
- 不能撤销自己的 admin role（防止锁死）
- 角色变更必须记录审计日志
- MVP 中 User.roles 是 Set，同一 role 不重复授予

## 3.6 资料补全状态总览

### 页面功能
- 按补全状态分类：已补全 / 未补全
- 统计补全率
- 可筛选未补全用户并批量提醒（后续版本）

### 补全字段检查
- displayName 是否填写
- 学校/单位 是否填写（若 PRD 要求）
- 联系方式 是否填写

## 3.7 数据依赖

| 数据 | 来源 | 操作类型 |
|------|------|---------|
| User 列表 | User 表/集合 | Read |
| User 详情 | User 表/集合 | Read |
| User.roles 更新 | User 表/集合 | Write |
| Registration 摘要 | Registration 表/集合 | Read（跨 Race） |
| 审计日志写入 | AuditLog 表/集合 | Write |

## 3.8 接口草案

```text
# 用户管理
GET    /api/admin/users                    # 用户列表（分页、搜索、筛选）
GET    /api/admin/users/:userId            # 用户详情
PATCH  /api/admin/users/:userId/roles      # 更新用户角色
GET    /api/admin/users/:userId/registrations  # 用户参赛记录

# 资料补全
GET    /api/admin/profile-completion       # 补全状态统计
GET    /api/admin/profile-completion/incomplete  # 未补全用户列表

# 角色维度
GET    /api/admin/roles/:roleType/users    # 按角色查看用户列表
```

---

# 4. M2 系统运行仪表盘 (System Dashboard)

> 来源：`docs/ary-release-ops-plan.md` §4、`docs/ary-mvp.prd.md` §14.5

## 4.1 功能概述

System Dashboard 为 Admin 提供 ARY 平台的整体运行状况视图。它不是单场赛事的监控（那是 Organizer View 的职责），而是跨所有赛事的全局健康检查。

## 4.2 页面结构

```text
/console/admin/dashboard
├─ 平台总览卡片行
├─ 赛事状态分布
├─ CA 接入全局健康
├─ Projection 状态
├─ Report 状态
└─ 关键性能指标
```

## 4.3 平台总览卡片

首屏展示关键数字：

| 指标 | 说明 | 来源 |
|------|------|------|
| 总用户数 | 已登录 ARY 的用户总数 | User |
| 活跃赛事数 | 当前 running 的 Race 数量 | Race（status=running） |
| 总报名数 | 所有 Race 的 Registration 总数 | Registration |
| CA 接入率 | 至少有一个 active CAConnection 的 Registration 占比 | CAConnection |
| 作品提交率 | 已提交 Work / 已批准 Registration | Work + Registration |
| 系统健康状态 | healthy / degraded / down | 综合判断 |

## 4.4 赛事状态分布

以可视化方式展示所有 Race 的状态分布：

```text
draft:       2
published:   1
registration: 2
running:     2
submitting:  0
judging:     1
completed:   2
archived:    1
```

支持点击进入具体赛事（跳转到 Organizer 端或公开 Race Page）。

## 4.5 CA 接入全局健康

| 展示内容 | 说明 |
|---------|------|
| 总 Registration 数 | 所有 approved Registration |
| CA 已配置数 | RaceProject 至少有一个 CAConnection |
| CA active 数 | 至少一个 CAConnection active |
| CA failed 数 | RaceProject 聚合状态为 failed |
| CA 未配置数 | RaceProject 聚合状态为 not_configured |
| 接入异常列表 | 具体的 failed Registration 和原因 |

对于接入异常，可查看详情但不在此页面直接处理（处理在 Internal Maintenance）。

## 4.6 Projection 状态

| 展示内容 | 说明 |
|---------|------|
| 各 Race 的 Projection 最近重建时间 |
| Projection 失败列表 |
| Projection 类型分布（race_progress / cost / risk / screen_feed 等） |
| 可触发重算的入口（跳转到 Internal Maintenance） |

## 4.7 Report 状态

| 展示内容 | 说明 |
|---------|------|
| 各 Race 的 Report 生成状态 |
| 生成失败列表 |
| Report 发布状态（draft / generated / reviewed / published） |
| 未发布但赛事已结束的提醒 |

## 4.8 关键性能指标

来源：`docs/ary-mvp.prd.md` §14.2

| 指标 | 目标值 | 当前值 |
|------|--------|--------|
| 公开页首屏响应时间 | <1s | 实时/近期均值 |
| Live Hall 数据刷新 | <3s | 实时/近期均值 |
| Screen Console 页面切换 | <1s | 实时/近期均值 |
| GitHub 登录成功率 | >99% | 近期比率 |
| 并发在线用户数 | 支持 200 | 当前峰值 |

## 4.9 数据依赖

Dashboard 本质是**读取模型**，消费各模块的统计数据。需要与数据及数据库同学协商 Dashboard 专用的聚合查询或 Read Model。

| 数据 | 来源 | 备注 |
|------|------|------|
| 用户统计 | User 表 | 计数查询 |
| 赛事统计 | Race 表 | 按 status 分组 |
| CA 接入统计 | RaceProject + CAConnection | 聚合查询 |
| Projection 状态 | Projection 表 | 最近更新时间、状态 |
| Report 状态 | Report 表 | 分组统计 |

## 4.10 接口草案

```text
GET  /api/admin/dashboard/overview        # 平台总览数据
GET  /api/admin/dashboard/races           # 赛事状态分布
GET  /api/admin/dashboard/ca-health       # CA 接入全局健康
GET  /api/admin/dashboard/projections     # Projection 状态列表
GET  /api/admin/dashboard/reports         # Report 状态列表
GET  /api/admin/dashboard/performance     # 性能指标
```

---

# 5. M3 内部数据维护 (Internal Maintenance)

> 来源：`docs/ary-mvp.ia.md` §8.6、`docs/ary-permission-matrix.md` §3.9/3.10

## 5.1 功能概述

Internal Data Maintenance 是 Admin（和授权 Organizer）处理系统异常、手动重算数据、管理公开展示的最小维护工具集。MVP 不提供独立的 Data/Ops Console，这些能力集成在管理系统中。

## 5.2 页面结构

```text
/console/admin/maintenance
├─ CA 接入状态详情
├─ Projection 管理
├─ Report 管理
└─ 公开展示异常处理
```

## 5.3 CA 接入状态详情

### 功能
- 按 Race 或按 User 查看 CA 接入详细状态
- 查看单个 CAConnection 的详细信息和失败原因
- 查看 RaceProject 聚合接入健康度
- 标记已知异常的 CAConnection（用于区分已知问题和突发故障）

### 信息展示
| 层级 | 展示内容 |
|------|---------|
| Race 级 | 该 Race 下所有 Registration 的接入状态分布 |
| Registration/RaceProject 级 | 聚合状态、connectionHealth、上次同步时间 |
| CAConnection 级 | caType、connectorId、ingestionStatus、registeredAt、lastSyncedAt、失败原因 |
| Session 级 | CAConnection 下最近的 Session 摘要 |

### 可执行操作
- 查看接入失败详细原因
- 手动标记/取消标记异常连接
- 查看原始 CA 接入状态日志

## 5.4 Projection 管理

### 功能
Projection 是过程展示数据，不作为最终事实源。当 Projection 生成失败或数据异常时，Admin 需要手动介入。

### 可执行操作
| 操作 | 说明 |
|------|------|
| 查看 Projection 状态 | 查看各 Race 各类 Projection 的最近更新时间和状态 |
| 手动重算 Projection | 对指定 Race 的指定 Projection 类型触发重建 |
| 批量重算 | 对指定 Race 的所有 Projection 触发全量重建 |
| 查看重算历史 | Projection 重建记录和时间线 |

### 重算触发
```text
POST /api/admin/maintenance/projections/rebuild
{
  "raceId": "bay-area-happy-trip",
  "projectionTypes": ["race_progress", "cost", "risk", "screen_feed"],
  "reason": "数据异常修复后手动重算"
}
```

### 约束
- Projection 重算不影响核心事实数据
- 重算期间 Live Hall 和 Screen Console 可回退到上一稳定版本
- 重算完成后记录操作日志

## 5.5 Report 管理

### 功能
当 Report 自动生成失败时，Admin 可手动触发重跑。

### 可执行操作
| 操作 | 说明 |
|------|------|
| 查看 Report 生成状态 | 各 Race 各类型 Report 的状态 |
| 手动重跑 Report 生成 | 对指定 Report 触发重新生成 |
| 查看生成失败原因 | 生成错误日志 |
| 标记 Report 为已审核 | 辅助发布流程 |

## 5.6 公开展示异常处理

### 功能
处理影响 Public Site 展示的异常数据。例如：作品包含不当内容、骑手档案信息有误、Projection 显示异常数据等。

### 可执行操作
| 操作 | 说明 |
|------|------|
| 隐藏 Work | 从公开 Works 列表移除（Work.visibility=hidden） |
| 隐藏 Rider Profile | 暂停骑手档案公开展示 |
| 标记/取消标记异常数据 | 给数据打异常标记，供 Organizer 后续处理 |

### 约束
- 隐藏操作必须有操作原因记录
- 隐藏不删除数据，仅控制可见性
- 操作需写入审计日志

## 5.7 数据依赖

| 数据 | 来源 | 操作类型 |
|------|------|---------|
| CA 接入状态 | RaceProject + CAConnection | Read |
| Projection 状态 | Projection 表 | Read + Trigger Rebuild |
| Report 状态 | Report 表 | Read + Trigger Regenerate |
| Work 可见性 | Work 表 | Write（visibility 字段） |
| 审计日志 | AuditLog 表 | Write |

## 5.8 接口草案

```text
# CA 接入状态
GET    /api/admin/maintenance/ca-status                    # 全局 CA 接入状态
GET    /api/admin/maintenance/ca-status/:raceId            # 指定 Race 的 CA 接入详情
GET    /api/admin/maintenance/ca-connections/:connectionId  # 单个 CAConnection 详情

# Projection 管理
GET    /api/admin/maintenance/projections                  # Projection 状态列表
POST   /api/admin/maintenance/projections/rebuild           # 触发重算

# Report 管理
GET    /api/admin/maintenance/reports                      # Report 状态列表
POST   /api/admin/maintenance/reports/:reportId/regenerate  # 触发重跑

# 异常处理
PATCH  /api/admin/maintenance/works/:workId/visibility      # 修改 Work 可见性
PATCH  /api/admin/maintenance/riders/:riderId/profile-visibility  # 修改档案可见性
```

---

# 6. M4 系统配置管理 (System Config)

> 来源：隐含在 PRD 和 OPS 文档中的系统级配置需求

## 6.1 功能概述

系统配置管理为 Admin 提供对 ARY 平台全局参数和功能的控制能力。MVP 阶段保持最小配置集，后续可扩展。

## 6.2 配置项清单

### CA Connector 管理
| 配置项 | 说明 | MVP 必要性 |
|--------|------|-----------|
| 支持的 CA 类型注册 | codex / claude_code / other | 必须 |
| Connector 版本管理 | 各 connector 的当前版本 | 建议 |
| Connector 端点配置 | connector HTTP 地址 | 必须（若不走服务发现） |

### 功能开关
| 配置项 | 说明 | MVP 必要性 |
|--------|------|-----------|
| 公开注册开关 | 是否允许新用户 GitHub 登录 | 建议 |
| 报名开关 | 是否允许新报名（全局或按 Race） | 可选 |
| 维护模式 | 全站维护页面 | 建议 |

### 系统参数
| 配置项 | 说明 | MVP 必要性 |
|--------|------|-----------|
| 默认 Projection 刷新间隔 | 影响 Live Hall 更新频率 | 建议 |
| Session 数据保留天数 | 原始 CA Session 存储策略 | 可选 |
| 最大 CAConnection 数/RaceProject | 限制单选手接入数量 | 可选 |

## 6.3 接口草案

```text
GET    /api/admin/config                    # 获取所有配置项
PUT    /api/admin/config/:key               # 更新指定配置项
GET    /api/admin/config/ca-connectors       # CA Connector 列表
POST   /api/admin/config/ca-connectors       # 注册新 Connector
```

---

# 7. M5 审计日志 (Audit Log)

> 来源：`docs/ary-permission-matrix.md`、`docs/ary-release-ops-plan.md` §10

## 7.1 功能概述

记录平台级敏感操作，支撑安全审计、问题追溯和事故复盘。

## 7.2 需记录的操作

| 操作类型 | 记录内容 |
|---------|---------|
| User.roles 变更 | 操作人、目标用户、变更前 roles、变更后 roles、时间 |
| 资料补全状态变更 | 操作人、目标用户、变更内容 |
| Admin 登录 | 登录时间、IP、User-Agent |
| Projection 手动重算 | 操作人、目标 Race、Projection 类型、原因、结果 |
| Report 手动重跑 | 操作人、目标 Report、原因、结果 |
| Work 可见性变更 | 操作人、目标 Work、原可见性、新可见性、原因 |
| 系统配置变更 | 操作人、配置项、旧值、新值 |
| 权限越权尝试 | 用户、尝试访问的资源、时间、IP |

## 7.3 审计日志查看

```text
/console/admin/audit-log
├─ 按时间范围筛选
├─ 按操作类型筛选
├─ 按操作人筛选
├─ 按目标资源筛选
└─ 日志导出（后续版本）
```

## 7.4 日志字段

```text
{
  logId: string,
  timestamp: datetime,
  actorUserId: string,        // 操作人
  actorGithubAccount: string,
  actionType: enum,           // role_change / config_update / projection_rebuild / ...
  targetResourceType: string, // User / Race / Work / Config / ...
  targetResourceId: string,
  detail: object,             // 操作详情（变更前后值、原因等）
  ip: string,
  userAgent: string,
  result: enum                // success / failed / denied
}
```

## 7.5 接口草案

```text
GET    /api/admin/audit-logs                  # 审计日志列表（分页、筛选）
GET    /api/admin/audit-logs/:logId           # 日志详情
```

---

# 8. 与团队其他模块的接口边界

## 8.1 你（管理系统）需要消费的外部接口

这些接口由其他团队成员提供，你的管理系统需要调用它们：

| 接口 | 提供方 | 用途 |
|------|--------|------|
| User 列表/详情查询 | 数据及数据库 | Admin Console 用户管理 |
| User.roles 更新 | 数据及数据库 | 角色管理 |
| Race 列表（全局） | Organizer 端 / 数据及数据库 | Dashboard 赛事状态 |
| Registration 统计 | Organizer 端 / 数据及数据库 | Dashboard + 用户详情 |
| CA 接入状态查询 | Rider 端 / 数据及数据库 | Dashboard + Maintenance |
| Projection 状态 + 重算触发 | 数据及数据库 | Maintenance |
| Report 状态 + 重跑触发 | Organizer 端 / 数据及数据库 | Maintenance |
| Work 可见性修改 | 数据及数据库 | 异常处理 |
| 审计日志存储 | 数据及数据库 | Audit Log |

## 8.2 你需要暴露给外部的接口

| 接口 | 消费方 | 用途 |
|------|--------|------|
| 权限校验中间件/服务 | 整合统一 + 所有端 | 验证当前 User 是否具有 admin role |
| User.roles 查询 | 整合统一 | 前端根据 roles 展示不同入口 |
| 系统配置读取 | 所有端 | 读取全局配置参数 |
| 维护模式状态 | 整合统一 | 前端展示维护页面 |

---

# 9. 权限模型

## 9.1 管理系统自身的权限

来源：`docs/ary-permission-matrix.md`

| 操作 | Admin | Organizer | Rider | Judge | Public |
|------|-------|-----------|-------|-------|--------|
| 查看用户列表 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 查看用户详情（角色+资料） | ✅ | ❌ | ❌ | ❌ | ❌ |
| 修改 User.roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| 查看 Dashboard | ✅ | 受限（仅自己管理的 Race） | ❌ | ❌ | ❌ |
| 手动重算 Projection | ✅ | 仅 managed race | ❌ | ❌ | ❌ |
| 手动重跑 Report | ✅ | 仅 managed race | ❌ | ❌ | ❌ |
| 修改 Work 可见性 | ✅ | 仅 managed race | ❌ | ❌ | ❌ |
| 查看审计日志 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 修改系统配置 | ✅ | ❌ | ❌ | ❌ | ❌ |

## 9.2 权限实现建议

管理系统的每个 API 端点必须：
1. 验证请求者已登录（有效的 GitHub OAuth token / session）
2. 验证请求者具有 `admin` role（对于 admin 专属操作）
3. 对于 `managed race` 范围的操作，验证 Organizer 是否负责该 Race

---

# 10. 技术建议

## 10.1 架构模式

管理系统适合采用**独立后台应用**或**Console Shell 下的管理子应用**：

```text
方案 A：独立 Admin Service
  Admin Service → 读取各模块数据（User DB / Race DB / Projection DB）
  Admin UI → Admin API → Admin Service

方案 B：集成在 Console Shell 中
  Console Shell (整合统一负责)
  └─ /admin/* 路由 → 管理系统负责的页面组件
  API Gateway → Admin 相关端点 → 各模块服务
```

推荐与整合统一的同学讨论确定。

## 10.2 技术选型建议

| 层面 | 建议方向 | 备注 |
|------|---------|------|
| 前端框架 | 与整合统一保持一致 | React/Vue/Next.js 等 |
| 后端语言 | 与团队统一 | Node.js/Python/Go 等 |
| 数据库 | 由数据及数据库同学设计 Schema | 管理系统只消费 |
| 认证 | GitHub OAuth | 与 Rider/Organizer 端共用同一认证服务 |
| 权限中间件 | 独立权限校验层 | 所有端共用 |

## 10.3 关键设计原则

1. **只消费事实数据，不重复存储**：Dashboard 数据从各模块读取，管理系统不建独立的"管理数据库"
2. **操作可追溯**：所有写操作记录审计日志
3. **最小权限**：Admin 只能做管理系统范围内的事，不越权操作赛事（那是 Organizer 的事）
4. **优雅降级**：管理系统自身故障不影响 Public Site 和赛事执行

---

# 11. 开发优先级建议

## 第一轮（支撑首场赛事）

1. **Admin Console 基础版**
   - 用户列表 + 搜索
   - 用户详情查看
   - User.roles 授予/撤销
   - 权限校验中间件

2. **最小 Dashboard**
   - 平台总览卡片（用户数、赛事数、CA 接入率）
   - 赛事状态分布

3. **最小 Maintenance**
   - Projection 状态查看 + 手动重算触发
   - Report 状态查看 + 手动重跑触发

## 第二轮（完善管理能力）

4. **Dashboard 增强**
   - CA 接入全景视图
   - 性能指标面板

5. **Maintenance 增强**
   - CA 接入详情和异常标记
   - 公开展示异常处理

6. **系统配置**
   - CA Connector 注册管理
   - 功能开关

7. **审计日志**
   - 核心操作日志记录
   - 审计日志查看页面

## 第三轮（长期增强，非 MVP）

8. 高级监控告警
9. 审计日志导出
10. 自动化运维脚本集成

---

# 12. 一句话总结

ARY 管理系统是平台的**账号角色中枢、全局健康看板和内部维护工具集**。它不办赛事（那是 Organizer 端的事）、不写代码（那是 Rider 端的事）、不存数据（那是数据库的事），而是确保平台**有人管、看得见、可维护**。
