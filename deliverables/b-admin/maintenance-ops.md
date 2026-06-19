# B 组内部维护操作说明

版本：v0.2
上游：`todos/02-B-Admin-Publishing.md`、`todos/11-Publication-Visibility-Rules.md`

本文说明管理系统中的四类核心维护操作：Work 可见性变更、Rider Profile 可见性变更、Projection 手动重算、Report 手动重跑。D 的权威 mock 和 E 的集成校验应以本文的操作约束为准。

---

# 1. Work 可见性变更

## 1.1 操作入口

Admin Console → Internal Maintenance → 公开展示异常处理

## 1.2 允许的可见性切换

| 当前 visibility | 可切换到 | 说明 |
|----------------|---------|------|
| private | review, public | Rider 提交后可进入评审可见或直接公开 |
| review | public, hidden, private | 评审完成后公开，或发现问题后隐藏 |
| public | hidden | 发现问题后从公开端移除 |
| hidden | public, private | 问题处理后恢复公开，或退回草稿 |

## 1.3 操作约束

1. 隐藏（visibility = hidden）**不删除数据**，仅控制公开端可见性。
2. 每次 visibility 变更必须记录操作原因（reason）。
3. 变更操作写入审计日志（AuditLogEntry，actionType = work_visibility_change）。
4. 仅 Admin 可执行变更；managed race 范围内的 Organizer 也可对自己负责的 Race 下 Work 执行变更。
5. 变更后需通知相关 Rider（后续版本）。

## 1.4 对应公开规则

遵守 `todos/11-Publication-Visibility-Rules.md`：
- 只有 `visibility = public` 的 Work 才能进入 Public Site
- C 的 Works 列表、Work Page 必须过滤非 public Work
- E 的装配脚本必须校验公开端不包含 private/review/hidden Work

## 1.5 样例数据映射

参见 `published-artifacts.sample.json` 中 `artifactType = work` 的条目，覆盖 private / review / public / hidden 四种可见性状态。

---

# 2. Rider Profile 可见性变更

## 2.1 操作入口

Admin Console → Internal Maintenance → 公开展示异常处理

## 2.2 允许的可见性切换

| 当前 visibility | 可切换到 | 说明 |
|----------------|---------|------|
| private | public | 档案完成，允许公开 |
| public | hidden | 发现问题后隐藏 |
| hidden | public | 问题处理后恢复公开 |

## 2.3 操作约束

1. Rider Profile 隐藏**不删除数据**，仅控制公开端可见性。
2. Profile 中**不得包含原始 CA Session 或原始 RidingRecord**，只能包含公开摘要和 Evidence。
3. 每次 visibility 变更必须记录操作原因。
4. 变更操作写入审计日志（AuditLogEntry，actionType = profile_visibility_change）。
5. 仅 Admin 可执行变更。

## 2.4 对应公开规则

遵守 `todos/11-Publication-Visibility-Rules.md`：
- 只有公开档案才能进入 Public Site
- Profile 内容不得包含原始 RidingRecord / 原始 CA Session
- C 的 Rider Profile 页面必须过滤非 public Profile

## 2.5 样例数据映射

参见 `published-artifacts.sample.json` 中 `artifactType = rider_profile` 的条目。

---

# 3. Projection 手动重算

## 3.1 操作入口

Admin Console → Internal Maintenance → Projection 管理

## 3.2 可执行操作

| 操作 | 说明 | 权限 |
|------|------|------|
| 查看 Projection 状态 | 各 Race 各 Projection 类型的 health 和最近更新时间 | Admin + Organizer(managed race) |
| 手动重算单个 Projection | 对指定 Race 的指定 ProjectionType 触发重建 | Admin + Organizer(managed race) |
| 批量重算 | 对指定 Race 的所有 Projection 触发全量重建 | Admin + Organizer(managed race) |
| 查看重算历史 | 该 Race 的 Projection 重建记录 | Admin + Organizer(managed race) |

## 3.3 重算流程

```
1. Admin 选择 Race 和 Projection 类型
2. 系统标记当前 Projection 为 stale（health = stale）
3. Live Hall / Screen Console 回退到上一稳定版本
4. 系统重新从核心事实数据计算 Projection
5. 计算成功 → health = healthy, lastRebuiltAt = 当前时间
6. 计算失败 → health = failed, lastFailedAt = 当前时间, failureReason 记录错误
7. 写入审计日志（actionType = projection_rebuild）
```

## 3.4 约束

1. Projection 重算**不影响核心事实数据**（Race、Registration、Work、Award 等）。
2. 重算期间 Live Hall 和 Screen Console 可回退到最近一次 stable Projection。
3. 重算操作必须记录：
   - 操作人
   - 目标 Race
   - 重算的 Projection 类型
   - 触发原因
   - 结果（成功/失败）
4. 不得频繁重算（建议单 Race 单类型至少间隔 60 秒）。

## 3.5 样例数据映射

参见 `projection-status.sample.json`，覆盖 healthy / degraded / failed / stale 四种健康状态。

---

# 4. Report 手动重跑

## 4.1 操作入口

Admin Console → Internal Maintenance → Report 管理

## 4.2 可执行操作

| 操作 | 说明 | 权限 |
|------|------|------|
| 查看 Report 生成状态 | 各 Race 各 Report 类型的生成状态 | Admin + Organizer(managed race) |
| 手动重跑 Report 生成 | 对指定 Report 触发重新生成 | Admin + Organizer(managed race) |
| 查看生成失败原因 | 最近一次生成失败的错误详情 | Admin + Organizer(managed race) |
| 标记 Report 为已审核 | 辅助发布流程 | Admin + Organizer(managed race) |

## 4.3 重跑流程

```
1. Admin 选择需要重跑的 Report
2. 系统重新从核心事实数据（Work、JudgingRecord、Award、Evidence）生成 Report
3. 生成成功 → report.status = generated, 更新 generatedAt
4. 生成失败 → report.status = draft, 记录 failureReason
5. 写入审计日志（actionType = report_regenerate）
6. 未发布的 Report（status != published）不出现在 Public Site
```

## 4.4 约束

1. Report 重跑**不自动发布**。生成后需要 Organizer 或 Admin 审核发布。
2. `rider_report` 重跑后必须仍然关联正确的 `subjectRegistrationId`。
3. `race_report` / `review_summary` 的 `subjectRegistrationId` 必须为空。
4. 重跑失败时允许人工编辑后手动发布（MVP 降级路径）。
5. 重跑操作写入审计日志。

## 4.5 样例数据映射

参见 `published-artifacts.sample.json` 中 `artifactType = report` 的条目，覆盖 draft / published / withdrawn 状态。

---

# 5. 操作权限汇总

| 操作 | Admin | Organizer(managed race) | Rider | Public |
|------|-------|------------------------|-------|--------|
| Work 可见性变更 | ✅ | ✅ | ❌ | ❌ |
| Rider Profile 可见性变更 | ✅ | ❌ | ❌ | ❌ |
| Projection 状态查看 | ✅ | ✅ | ❌ | ❌ |
| Projection 手动重算 | ✅ | ✅ | ❌ | ❌ |
| Report 状态查看 | ✅ | ✅ | ❌ | ❌ |
| Report 手动重跑 | ✅ | ✅ | ❌ | ❌ |
| Report 标记已审核 | ✅ | ✅ | ❌ | ❌ |

所有操作必须验证登录态和角色权限，变更操作写入审计日志。

---

# 6. 与 C 和 E 的接口边界

1. **C（前端壳）**：admin maintenance 页面读取 `ProjectionStatus` 展示重算入口，读取 `PublishedArtifactStatus` 展示可见性管理入口。非 public 内容绝不出现在公开端页面中。
2. **D（权威 mock）**：`authority-mock.json` 中需提供 `projectionStatuses` 和 `publishedArtifacts` 的初始样例数据。
3. **E（自动集成）**：assembly 时必须校验：
   - 所有 `isPubliclyVisible = false` 的资源未出现在公开端数据中
   - 公开端不包含原始 CA Session
   - Projection 数据不混入 Results / Review
