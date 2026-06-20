# B-Admin 当前交付复审（2026-06-20）

审查对象：当前工作树中的 B-Admin 交付（`app/web/admin/`、`deliverables/b-admin/`、当前 `runtime-data/assembled-view.json`）

结论：这轮复审确认，B-Admin 交付相比上一轮已经明显收敛，之前的几个直接阻断演示的问题基本都已修掉：系统配置页在当前会话内可以正确反映开关切换，审计日志页已经补上 `profile_update` 的筛选与中文文案，维护页也补出了 `CA 接入状态详情` 区块。从“能不能演示”看，它已经进入**基本可演示**状态；随后这轮集成侧又继续补齐了 Dashboard 的 CA 异常列表 / Report 风险提醒，以及维护页的批量重算、重算历史、Report 失败原因和“已审核”动作，运行时 `caStatuses` 也已按共享字段字典收敛。现在连 `deliverables/b-admin/ca-status.sample.json` 里的旧口径 `connected` 也已经清掉，因此当前剩余问题已不再是 B-Admin 页面壳或样例契约缺口，而主要只剩常规集成验证与收工动作。

按最初分工 spec 对齐当前完成度，我给 B-Admin 一个大约 **90% 到 95%** 的完成度判断。它已经不再需要大规模返工，也不值得因为现有缺口把整个集成工作停住；更准确的策略是：**由我们继续完成集成与最终回归，B-Admin 本身不再需要新一轮结构性返工。**

## Update After Integration Closure

- Dashboard 的 CA 接入异常列表已补上，当前首屏可以直接看到 `handshaken / failed / flagged anomaly` 的异常对象和风险说明。
- Dashboard 的 Report 区块已补上撤回失败摘要，以及“赛事已结束但 Report 仍未发布”的风险提醒逻辑。
- 维护页已补上 Projection 批量重算入口、重算历史列表、Report 失败原因展示和“已审核”动作入口。
- 运行时 `caStatuses` 已按共享字段字典收敛，live API 与维护页不再展示旧值 `connected`。
- `deliverables/b-admin/ca-status.sample.json` 也已同步把旧值 `connected` 清理为共享契约枚举。
- 因此，下面 Findings 中原先关于 Dashboard / 维护页缺模块与样例枚举漂移的几项，已经在当前运行壳与交付样例中关闭；保留这些记录主要用于说明本轮复审起点。

## Findings

### 1. 中优先级：CA 接入状态仍使用 `connected` 枚举，和共享字段字典不一致

- 共享字段字典把 `CAConnectionHealth` 定义为 `not_configured / registered / handshaken / active / failed / disabled`，见 [todos/10-Shared-Field-Dictionary.md](../todos/10-Shared-Field-Dictionary.md#L33)。
- 但当前 B-Admin 的 CA 状态样例仍然使用 `connected`，见 [deliverables/b-admin/ca-status.sample.json](../deliverables/b-admin/ca-status.sample.json#L62) 和 [deliverables/b-admin/ca-status.sample.json](../deliverables/b-admin/ca-status.sample.json#L148)。
- 页面实现也显式按 `connected` 分支渲染颜色与状态，见 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html#L121)。

影响：这会造成 A、D、E 按共享契约接线时的状态映射分歧。问题不只是展示文案，而是跨组数据语义已经开始漂移。

### 2. 中优先级：Dashboard 的 CA 接入全局健康区块仍缺少“接入异常列表”

- 任务书要求 Dashboard 的 CA 健康区块至少展示总 Registration 数、CA 已配置数、CA active 数、CA failed 数、CA 未配置数，以及接入异常列表，见 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L126)。
- 当前页面已经有 5 个汇总卡片，但没有异常连接列表、失败条目明细或异常对象入口，见 [app/web/admin/dashboard.html](../app/web/admin/dashboard.html#L128)。

影响：管理员只能看到总量异常，不能在 Dashboard 首屏直接定位哪些连接处于失败/异常状态，任务书要求还没完全落地。

### 3. 中优先级：Dashboard 的 Report 状态区块仍缺少失败列表与“未发布但赛事已结束”提醒

- 任务书要求 Report 区块展示生成状态、失败列表、发布状态，以及“未发布但赛事已结束”的提醒，见 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L132)。
- 当前实现只展示 `raceTitle / reportType / publicationStatus / lastModifiedAt`，见 [app/web/admin/dashboard.html](../app/web/admin/dashboard.html#L148)。

影响：当前 Dashboard 只能给出静态列表，无法帮助管理员快速识别真正需要处理的 report 风险项。

### 4. 中优先级：数据维护页的 Projection / Report 管理仍未达到任务书要求的操作范围

- Projection 管理按任务书应支持查看状态、手动重算、批量重算、查看重算历史，见 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L154)。
- Report 管理按任务书应支持查看生成状态、手动重跑、查看失败原因、标记已审核，见 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L160)。
- 当前维护页虽然已经补上 `CA 接入状态详情`，也提供了单条 `重算` / `重跑` 操作，但仍没有批量重算、重算历史、失败原因列或“已审核”动作，见 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html#L104) 和 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html#L141)。

影响：维护页已经不再是“缺模块”，而是“模块存在但功能不闭环”。如果按任务书验收，当前仍有明显缺口。

## What Passed

- 系统配置页已经不再把切换结果立即回滚。当前实现改为更新本地 `configs` 后直接 `renderAll()`，见 [app/web/admin/config.html](../app/web/admin/config.html#L95)。我在浏览器里实际触发了 `maintenance_mode` 切换，状态会从“关闭”变成“开启”。
- 审计日志页已经补上 `profile_update` 的筛选项和中文展示文案，见 [app/web/admin/audit-log.html](../app/web/admin/audit-log.html#L52) 和 [app/web/admin/audit-log.html](../app/web/admin/audit-log.html#L60)。我在浏览器中按 `profile_update` 过滤后，能正确只显示 1 条“资料补全变更”日志。
- 维护页已经补出 `CA 接入状态详情` 区块，能够按 Race 展示连接详情、失败原因和异常标记入口，见 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html#L67) 和 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html#L93)。
- `user_rider_02` 的资料补全状态冲突已经修正：`user-roles.sample.json` 与 `profile-completion.sample.json` 现在都为 `profileCompleted: false`，见 [deliverables/b-admin/user-roles.sample.json](../deliverables/b-admin/user-roles.sample.json#L77) 和 [deliverables/b-admin/profile-completion.sample.json](../deliverables/b-admin/profile-completion.sample.json#L44)。

## Run/Test 结果

我实际执行了以下验证：

1. `node scripts/assemble.js`
   - 结果：成功重建当前运行态 `assembled-view.json` 与 `compatibility-report.json`。
2. HTTP 路由检查
   - `GET /admin/dashboard.html`：`200`
   - `GET /admin/maintenance.html`：`200`
   - `GET /admin/config.html`：`200`
   - `GET /admin/audit-log.html`：`200`
3. 浏览器交互验证
   - 配置页：实际触发 `maintenance_mode` 切换后，卡片文案从“关闭”变成“开启”，并更新 `updatedAt` / `updatedBy`。
   - 审计日志页：实际按 `profile_update` 过滤后，只剩 1 条“资料补全变更”日志，筛选行为正确。
4. 运行态数据核对
   - 当前 `assembled-view.json` 已包含 `caStatuses`，能支撑维护页的 CA 接入详情展示。

## Overall Assessment

- 如果看“当前 B-Admin 交付是否还能被上次那些明显问题卡住”，答案是：**不会，主要阻断项已修复**。
- 如果看“当前交付是否已经完整达到任务书口径”，答案是：**还没有**。
- 更准确的判断是：**B-Admin 当前运行壳与交付样例已经达到可直接集成收口的状态；剩余主要是常规联调与最终验收，而不是页面能力或交付契约缺口。**

## Completion Assessment

- 相对于最初的 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md)，当前完成度约为 **90% 到 95%**。
- 从单机 MVP 集成视角看：**可以继续由我们自己完成集成，不必等待一次大返工后再接线。**
- 从严格按原始 spec 验收视角看：**主要页面能力项和共享枚举对齐都已补齐**。
- 因此，推荐口径是：**允许直接集成收工；剩余只需做最终回归与验收留痕。**

## Direct Integration Judgment

- 当前交付已经足够支撑集成方继续推进 `app/`、`scripts/`、`runtime-data/` 的接线与联调。
- 目前剩余问题大多不影响“页面能打开、数据能渲染、主要管理链路可演示”，因此**没有必要把 B-Admin 退回到重做阶段**。
- 当前已经没有必要再等一轮 B-Admin 页面功能返工；B-Admin 本身可以按“可直接集成收工”口径处理。

## Final Rework Checklist

这份清单现在已经关闭。当前不再存在必须由 B-Admin 单独返工的页面能力或样例枚举残项。

## Recommended Next Steps

1. 继续由集成方推进接线，不必等待 B-Admin 大返工后再开始集成。
2. 重新执行 `node scripts/assemble.js` 与 Dashboard / 维护页回归，作为“可直接集成收工”的最终留痕。
3. 如需对外同步，直接以“B-Admin 运行壳与交付样例已收口，进入最终集成验收”作为当前口径。