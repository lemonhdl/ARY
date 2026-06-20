# B-Admin 最新提交评审

审查对象：`HEAD` (`cb21403`, commit message: `GRS-003-b-admin`)

结论：B 组交付物里的文档、manifest 和大部分样例数据基础是齐的，JSON 语法和公开可见性规则也能通过基础校验；但它**还没有完成与当前程序壳的可运行集成**，而且 admin-shell 自身仍有几个会阻断演示和下游消费的缺口。因此，这个提交**不能算完全满足相关 program spec，也不能说已经可直接集成到当前 program shell**。

## Findings

### 1. 高优先级：当前程序壳并没有接入这套 admin-shell，运行中的 `/admin` 仍是占位页，子页面路由直接 404

- 服务器只托管 [app/server/index.js](../app/server/index.js#L7) 下的 `app/web` 目录。
- 当前程序壳里的管理端入口仍是占位内容，明确写着“后续由 B 组读模型和 C 组页面壳接入”，见 [app/web/admin/index.html](../app/web/admin/index.html#L13)。
- 最新提交把真正的管理端页面放在 `deliverables/b-admin/admin-shell/`，而且 manifest 里把它声明成可选产物，不是必需集成入口，见 [deliverables/b-admin/handoff.manifest.json](../deliverables/b-admin/handoff.manifest.json#L62) 和 [deliverables/b-admin/handoff.manifest.json](../deliverables/b-admin/handoff.manifest.json#L64)。
- 实测：`http://127.0.0.1:3000/admin/` 返回的是占位页；`http://127.0.0.1:3000/admin/users.html` 返回 404。

影响：从“当前仓库可运行产品壳”的角度，这个提交还不能被用户实际访问到，也不能视为已经接入 program shell。

### 2. 高优先级：装配脚本没有把 B 组读模型样例装进 `assembled-view`，即使页面被挂上去，也会大量空数据

- 当前装配脚本只把 `authority-mock.json` 里的基础字段和 manifest 列表写入 `assembled-view`，没有读取 `deliverables/b-admin/*.sample.json` 去生成 `projectionStatuses`、`publishedArtifacts`、`auditLogs`、`systemConfigs`、`userRoles` 等管理端数据，见 [scripts/assemble.js](../scripts/assemble.js#L36) 和 [scripts/assemble.js](../scripts/assemble.js#L45)。
- 当前权威 mock 里这些字段本身还是空数组，见 [runtime-data/authority-mock.json](../runtime-data/authority-mock.json#L31), [runtime-data/authority-mock.json](../runtime-data/authority-mock.json#L32), [runtime-data/authority-mock.json](../runtime-data/authority-mock.json#L33)。
- 但管理端页面已经依赖这些字段：维护页读 `projectionStatuses` 和 `publishedArtifacts`，见 [deliverables/b-admin/admin-shell/maintenance.html](../deliverables/b-admin/admin-shell/maintenance.html#L93), [deliverables/b-admin/admin-shell/maintenance.html](../deliverables/b-admin/admin-shell/maintenance.html#L106), [deliverables/b-admin/admin-shell/maintenance.html](../deliverables/b-admin/admin-shell/maintenance.html#L122)；审计页读 `auditLogs`，见 [deliverables/b-admin/admin-shell/audit-log.html](../deliverables/b-admin/admin-shell/audit-log.html#L67)；配置页读 `systemConfigs`，见 [deliverables/b-admin/admin-shell/config.html](../deliverables/b-admin/admin-shell/config.html#L89)。
- 实测：运行中的 `/api/runtime/assembled-view` 只有 `dashboard` 和 `manifests`，没有上述 B 组管理端数据字段。

影响：即使把 HTML 路由接进去，页面也只能停在空态或提示态，不构成可演示的管理系统集成。

### 3. 高优先级：`users.html` 自身把用户数据硬编码成空数组，用户与角色页在独立预览下也不可用

- 在加载逻辑里，只要发现 `b-admin` manifest 存在，就直接执行 `users = []`，见 [deliverables/b-admin/admin-shell/users.html](../deliverables/b-admin/admin-shell/users.html#L107)。
- 这意味着用户列表、搜索、筛选、角色编辑弹窗都不会拿到任何样例用户，即使后续有人把 `assembled-view` 补齐，也仍然是空表。

影响：这会直接阻断 `M1` 用户与角色管理页的演示，属于页面实现 bug，不只是“尚未接线”。

### 4. 中优先级：`published-artifacts.sample.json` 的 Report 状态枚举和文档约定不一致，且未覆盖 Report 撤回态

- 任务要求写得很清楚：`published-artifacts.sample.json` 必须覆盖 Results、Review、Report 的发布态和撤回态，见 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L242)。
- 读模型文档也把 `publicationStatus` 约束为 `draft` / `published` / `withdrawn`，见 [deliverables/b-admin/admin-read-models.md](../deliverables/b-admin/admin-read-models.md#L117)。
- 但实际 Report 条目里出现了 `generated` 状态，见 [deliverables/b-admin/published-artifacts.sample.json](../deliverables/b-admin/published-artifacts.sample.json#L170)，而我没有在 Report 条目里看到 `withdrawn` 覆盖；现有 `withdrawn` 出现在更前面的非 Report 条目，见 [deliverables/b-admin/published-artifacts.sample.json](../deliverables/b-admin/published-artifacts.sample.json#L58)。

影响：如果 C/E 严格按文档枚举做校验，这里会产生契约漂移；而且“Report 发布态和撤回态”这一验收点目前没有被样例完整证明。

### 5. 中优先级：Dashboard 页面实现没有覆盖任务书要求的状态维度，也缺少 Projection / Report 状态区块

- 任务书要求 Dashboard 包含 `Projection 状态` 和 `Report 状态` 区块，见 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L104) 和 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L105)。
- 同一任务书要求赛事状态分布至少按 `draft`、`published`、`registration`、`running`、`judging`、`completed`、`archived` 展示，见 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L115)。
- 样例数据里确实提供了 `draft` 和 `published` 计数，见 [deliverables/b-admin/dashboard-overview.sample.json](../deliverables/b-admin/dashboard-overview.sample.json#L17) 和 [deliverables/b-admin/dashboard-overview.sample.json](../deliverables/b-admin/dashboard-overview.sample.json#L18)。
- 但页面代码只渲染 `registration/running/judging/completed/archived/upcoming`，没有 `draft/published`，见 [deliverables/b-admin/admin-shell/dashboard.html](../deliverables/b-admin/admin-shell/dashboard.html#L83)。页面里也没有 Projection 状态或 Report 状态区块。

影响：即使页面接入成功，Dashboard 也还没达到任务书描述的展示范围。

### 6. 中优先级：审计日志契约存在规格漂移，`资料补全状态变更` 没有被当前样例覆盖

- 任务书要求审计日志覆盖“资料补全状态变更”，见 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L187)。
- 读模型文档把动作类型写成 `profile_update`，见 [deliverables/b-admin/admin-read-models.md](../deliverables/b-admin/admin-read-models.md#L162)。
- 但样例文件宣称覆盖的是 `profile_visibility_change`，并且对应条目也是这个动作，见 [deliverables/b-admin/audit-log.sample.json](../deliverables/b-admin/audit-log.sample.json#L7) 和 [deliverables/b-admin/audit-log.sample.json](../deliverables/b-admin/audit-log.sample.json#L123)。

影响：这里不只是命名问题。下游如果按一种动作名做过滤、审计统计或自动校验，当前文档和样例会得出不同结果。

## What Passed

- `deliverables/b-admin/handoff.manifest.json` 存在，`node scripts/validate-handoffs.js` 能发现 `b-admin` 交付。
- B 组 8 个 JSON 产物全部能通过 `JSON.parse` 语法校验。
- `published-artifacts.sample.json` 里的 `isPubliclyVisible` 与当前共享公开规则判定是一致的。
- 样例覆盖面整体不错：Projection 健康四态、Work 四种 visibility、核心 artifact types、主要角色组合、配置分类都已经覆盖到。

## Run/Test 结果

我实际执行了以下验证：

1. `node scripts/validate-handoffs.js`
   - 结果：`b-admin` manifest 被发现，其他组当前缺失。
2. `node scripts/assemble.js`
   - 结果：成功生成运行态数据，但只装入基础 bootstrap 数据和 manifest，没有把 B 组样例装配到 admin 所需字段。
3. `node app/server/index.js`
   - 结果：服务可在 `http://127.0.0.1:3000` 启动。
4. HTTP 路由检查
   - `GET /admin/`：返回占位页。
   - `GET /admin/users.html`：404。
   - `GET /api/runtime/assembled-view`：没有 `projectionStatuses`、`publishedArtifacts`、`auditLogs`、`systemConfigs`、`userRoles` 等管理端集成字段。

补充：`npm run dev` 在这台 Windows 机器上被 PowerShell execution policy 拦截；我改用直接执行 `node scripts/assemble.js; node app/server/index.js` 完成了同等启动验证。这不影响上面的产品结论。

## Overall Assessment

- 如果只看“B 组是否按目录交出了文档 + 样例 + manifest”，答案是：**基本是**。
- 如果看“是否满足相关 program spec 的可运行管理端交付”，答案是：**还没有**。
- 如果看“能否集成到当前 program shell”，答案是：**当前不能直接集成落地，需要至少补完路由接入、装配注入和用户页 bug**。

## Recommended Next Steps

1. 由 E 或当前集成负责人把 `deliverables/b-admin/admin-shell/` 明确接到 `app/web/admin/`，或建立一条正式装配/复制链路，而不是停留在 deliverable 目录。
2. 扩展 [scripts/assemble.js](../scripts/assemble.js) 读取 B 组样例文件，至少装出 `projectionStatuses`、`publishedArtifacts`、`auditLogs`、`systemConfigs`、`userRoles`、`profileCompletion` 这些管理端字段。
3. 修复 [deliverables/b-admin/admin-shell/users.html](../deliverables/b-admin/admin-shell/users.html#L107) 的空数组逻辑。
4. 统一 Report 状态枚举和审计动作类型，消除文档与样例的契约漂移，再让 C/E 按同一份字段约定接线。