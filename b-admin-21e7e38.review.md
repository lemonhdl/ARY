# B-Admin 提交 21e7e38 复审

审查对象：`21e7e38` (`GRS-003-b-admin-v1`)

结论：这次提交已经修复了上一轮 review 里的几项高优先级集成问题，包括 admin 页面已接入当前程序壳、`scripts/assemble.js` 已装配 B 组样例数据、`users.html` 不再把用户数据强制清空。因此，B 组交付已经从“未接入、不可演示”推进到“基本可运行”。但本次提交仍有几个会影响演示完整性和下游接线一致性的缺口，暂时还不能算完全满足任务书里的管理端交付要求。

## Findings

### 1. 高优先级：系统配置页的开关交互实际无效，用户看不到切换结果

- 页面加载时把服务端数据写入本地 `configs`，见 [app/web/admin/config.html](../app/web/admin/config.html#L89)。
- 但 `toggleConfig()` 在更新本地对象后，立刻再次调用 `load()`，见 [app/web/admin/config.html](../app/web/admin/config.html#L98) 和 [app/web/admin/config.html](../app/web/admin/config.html#L107)。
- 当前 `load()` 重新从 `/api/runtime/assembled-view` 读取静态 runtime 数据，因此刚才的本地修改会马上被旧值覆盖。
- 我本地打开 `/admin/config.html` 后实际触发了 `maintenance_mode` 切换；切换前后页面都仍显示“关闭”，说明这不是代码风格问题，而是当前演示路径本身失效。

影响：M4 系统配置管理的核心主路径目前不可演示。用户会收到“已更新”的提示，但界面状态不会变化，容易误导验收和后续联调。

### 2. 中优先级：审计日志页没有完整支持 `profile_update`，必需操作类型无法筛选且展示降级

- 任务书要求审计日志覆盖“资料补全状态变更”，见 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L187)。
- 样例数据现在已经正确提供了 `profile_update`，见 [deliverables/b-admin/audit-log.sample.json](../deliverables/b-admin/audit-log.sample.json#L7) 和 [deliverables/b-admin/audit-log.sample.json](../deliverables/b-admin/audit-log.sample.json#L140)。
- 但审计页的筛选下拉没有 `profile_update` 选项，见 [app/web/admin/audit-log.html](../app/web/admin/audit-log.html#L52)。
- 动作名称映射里也没有 `profile_update`，见 [app/web/admin/audit-log.html](../app/web/admin/audit-log.html#L60)。
- 结果是这类日志只能以原始枚举值 `profile_update` 直接显示，且管理员无法按该类型筛选。

影响：这会削弱 M5 审计日志页的可用性，而且“资料补全状态变更”虽然在数据层已经补齐，但在 UI 层仍然没有真正被支持到位。

### 3. 中优先级：数据维护页仍缺少任务书要求的“CA 接入状态详情”区块

- 任务书明确要求 `/console/admin/maintenance` 包含 `CA 接入状态详情`、`Projection 管理`、`Report 管理`、`公开展示异常处理`，见 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L142) 和 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L148)。
- 当前实现只有 `Projection 状态与重算`、`公开展示异常处理`、`Report 重跑` 三部分，见 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html#L67)、[app/web/admin/maintenance.html](../app/web/admin/maintenance.html#L69)、[app/web/admin/maintenance.html](../app/web/admin/maintenance.html#L73)、[app/web/admin/maintenance.html](../app/web/admin/maintenance.html#L77)。
- 页面里没有 Race / User 维度的 CAConnection 详情、失败原因列表、RaceProject 聚合接入健康度，也没有“标记已知异常连接”的入口。

影响：M3 仍未闭环。当前页面能演示 Projection 和 Report 的部分维护动作，但还不能覆盖管理端对 CA 接入异常的核心排查场景。

### 4. 中优先级：两份管理端样例数据对同一用户的资料补全状态给出了冲突值

- `user_rider_02` 在 [deliverables/b-admin/user-roles.sample.json](../deliverables/b-admin/user-roles.sample.json#L77) 和 [deliverables/b-admin/user-roles.sample.json](../deliverables/b-admin/user-roles.sample.json#L81) 中是 `profileCompleted: true`。
- 但同一个用户在 [deliverables/b-admin/profile-completion.sample.json](../deliverables/b-admin/profile-completion.sample.json#L44) 和 [deliverables/b-admin/profile-completion.sample.json](../deliverables/b-admin/profile-completion.sample.json#L49) 中却是 `profileCompleted: false`。

影响：D/E 在装配统一 mock 或后续接 API 时，无法判断哪份视图才是权威值。这种交付内部自相矛盾会把问题推给下游，而不是提供稳定输入。

## What Passed

- `/admin/dashboard.html`、`/admin/config.html`、`/admin/audit-log.html` 现在都能通过当前程序壳直接访问，不再停留在 `deliverables/b-admin/admin-shell/` 目录里。
- [scripts/assemble.js](../scripts/assemble.js) 现在已经装配 `projectionStatuses`、`publishedArtifacts`、`auditLogs`、`systemConfigs`、`userRoles`、`profileCompletion` 等 B 组运行态字段。
- Dashboard 已补上 `draft/published` 赛事状态维度，以及 `Projection 状态` / `Report 状态` 区块，方向上符合上一轮 review 建议。
- `published-artifacts.sample.json` 现在已经改回 `draft/published/withdrawn` 三态，并补了 Report 的撤回态覆盖，见 [deliverables/b-admin/published-artifacts.sample.json](../deliverables/b-admin/published-artifacts.sample.json#L8) 和 [deliverables/b-admin/published-artifacts.sample.json](../deliverables/b-admin/published-artifacts.sample.json#L177)。
- `audit-log.sample.json` 也已经补上 `profile_update`，契约层比上一轮一致得多，见 [deliverables/b-admin/audit-log.sample.json](../deliverables/b-admin/audit-log.sample.json#L7) 和 [deliverables/b-admin/audit-log.sample.json](../deliverables/b-admin/audit-log.sample.json#L140)。

## Run/Test 结果

我实际执行了以下验证：

1. `node scripts/assemble.js`
   - 结果：成功生成新的 `runtime-data/assembled-view.json`，包含 B 组管理端所需字段。
2. `node app/server/index.js`
   - 结果：服务可在 `http://127.0.0.1:3000` 启动。
3. HTTP 路由检查
   - `GET /admin/dashboard.html`：返回 `200`。
   - `GET /admin/audit-log.html`：返回 `200`。
4. 页面行为检查
   - `/admin/config.html`：`maintenance_mode` 切换后页面仍显示旧状态，确认存在交互失效问题。
   - `/admin/audit-log.html`：存在 `profile_update` 日志，但 UI 仍直接显示原始枚举值，且无对应筛选项。

## Overall Assessment

- 如果看“是否已经接入当前程序壳并具备基础可运行性”，答案是：**是，较上一轮有明显进展**。
- 如果看“是否已经满足任务书里的完整管理端交付”，答案是：**还没有**。
- 当前更准确的判断是：**B 组管理端已从不可集成状态进入可运行原型状态，但仍需补齐配置页交互、维护页 CA 接入区块，以及样例 / UI 的一致性问题**。

## Recommended Next Steps

1. 修复 [app/web/admin/config.html](../app/web/admin/config.html#L98) 的本地状态覆盖问题。即使仍是 demo 模式，也至少要让 UI 在当前会话里反映切换结果，而不是立刻被 `load()` 回滚。
2. 在 [app/web/admin/audit-log.html](../app/web/admin/audit-log.html#L52) 和 [app/web/admin/audit-log.html](../app/web/admin/audit-log.html#L60) 补上 `profile_update` 的筛选项和展示文案，使其真正覆盖“资料补全状态变更”。
3. 按 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L148) 为 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html) 补齐 `CA 接入状态详情` 区块，而不是只覆盖 Projection / Report / 可见性处理。
4. 统一 [deliverables/b-admin/user-roles.sample.json](../deliverables/b-admin/user-roles.sample.json#L77) 与 [deliverables/b-admin/profile-completion.sample.json](../deliverables/b-admin/profile-completion.sample.json#L44) 对 `user_rider_02` 的 `profileCompleted` 取值，避免把相互冲突的样例继续交给下游消费。