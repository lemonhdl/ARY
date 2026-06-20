# B-Admin 当前交付复审（2026-06-20）

审查对象：当前工作树中的 B-Admin 交付（`app/web/admin/`、`deliverables/b-admin/`、当前 `runtime-data/assembled-view.json`）

结论：这轮复审确认，B-Admin 交付相比上一轮已经明显收敛，之前的几个直接阻断演示的问题基本都已修掉：系统配置页在当前会话内可以正确反映开关切换，审计日志页已经补上 `profile_update` 的筛选与中文文案，维护页也补出了 `CA 接入状态详情` 区块。从“能不能演示”看，它已经进入**基本可演示**状态；但从“是否完整满足任务书”看，仍有若干**规格未闭环**的问题，主要集中在 Dashboard 信息完整度、维护页操作闭环，以及 CA 状态枚举与共享契约的漂移。

按最初分工 spec 对齐当前完成度，我给 B-Admin 一个大约 **75% 到 80%** 的完成度判断。它已经不再需要大规模返工，也不值得因为现有缺口把整个集成工作停住；更合适的策略是：**由我们继续完成集成，同时要求 B-Admin 或集成负责人按下面的残项做最后一轮小步补齐。只要这轮补齐完成，就可以直接集成收工，不需要再开一轮结构性返工。**

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
- 更准确的判断是：**B-Admin 已进入基本可演示状态，但仍存在任务书覆盖不全和共享契约漂移问题，适合继续小步补齐，而不是宣称已完全收口。**

## Completion Assessment

- 相对于最初的 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md)，当前完成度约为 **75% 到 80%**。
- 从单机 MVP 集成视角看：**可以继续由我们自己完成集成，不必等待一次大返工后再接线。**
- 从严格按原始 spec 验收视角看：**还不能判定 fully done**，因为当前剩余问题里包含真实的规格缺口，而不只是“E 侧还没接上”。
- 因此，推荐口径是：**允许继续集成，不阻塞；但将下述残项明确记为 B-Admin 最后一轮必须补齐的收口清单。**

## Direct Integration Judgment

- 当前交付已经足够支撑集成方继续推进 `app/`、`scripts/`、`runtime-data/` 的接线与联调。
- 目前剩余问题大多不影响“页面能打开、数据能渲染、主要管理链路可演示”，因此**没有必要把 B-Admin 退回到重做阶段**。
- 但如果希望“最后一次返工后能直接集成收工”，则必须把下方 checklist 里的项一次性补完；否则集成方只能带着已知规格缺口收尾，后面仍会留下二次返工风险。

## Final Rework Checklist

这份清单是“最后一次返工后可直接集成收工”的最小完整集。完成以下各项后，我认为 B-Admin 就可以不再单独返工，只保留集成侧接线工作。

1. 把 `deliverables/b-admin/ca-status.sample.json` 里的 `connected` 全部统一到共享字段字典的权威枚举，至少不能继续产出 [todos/10-Shared-Field-Dictionary.md](../todos/10-Shared-Field-Dictionary.md#L33) 未定义的状态值。
2. 同步更新 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html) 中按 `connected` 分支渲染样式/语义的逻辑，确保页面与共享契约一致，而不是只改样例数据不改页面。
3. 在 [app/web/admin/dashboard.html](../app/web/admin/dashboard.html) 的 CA 健康区块补上“接入异常列表”或明确的失败连接摘要入口，满足 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L126) 的要求。
4. 在 [app/web/admin/dashboard.html](../app/web/admin/dashboard.html) 的 Report 区块补上失败列表或失败摘要。
5. 在 [app/web/admin/dashboard.html](../app/web/admin/dashboard.html) 的 Report 区块补上“赛事已结束但 Report 仍未发布”的提醒逻辑。
6. 在 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html) 的 Projection 管理区块补上“批量重算”能力，哪怕仍是 demo stub，也要在页面结构上存在。
7. 在 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html) 的 Projection 管理区块补上“重算历史”入口或历史列表占位，满足任务书的管理闭环要求。
8. 在 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html) 的 Report 管理区块补上失败原因展示，而不只是状态与最近修改时间。
9. 在 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html) 的 Report 管理区块补上“已审核”动作或等价状态入口，满足 [todos/02-B-Admin-Publishing.md](../todos/02-B-Admin-Publishing.md#L160) 的要求。
10. 回归验证 [app/web/admin/config.html](../app/web/admin/config.html)、[app/web/admin/audit-log.html](../app/web/admin/users.html)、[app/web/admin/dashboard.html](../app/web/admin/dashboard.html)、[app/web/admin/maintenance.html](../app/web/admin/maintenance.html) 在当前 `assembled-view.json` 下都能正常渲染，避免最后一轮补齐时把已修好的项带回去。

如果以上 10 项完成，我的判断会从“75% 到 80%，可继续集成但未 fully done”提升到“可以直接集成收工，只剩集成方接线问题”。

## Recommended Next Steps

1. 继续由集成方推进接线，不必等待 B-Admin 大返工后再开始集成。
2. 把上面的 Final Rework Checklist 作为 B-Admin 最后一轮补齐清单，一次性关闭，而不是再拆成多轮 review。
3. 最后一轮补齐完成后，重新执行 `node scripts/assemble.js`、4 个 admin 路由 `200` 检查，以及配置页开关 / 审计日志筛选 / 维护页 CA 状态展示的浏览器回归，即可作为“可直接集成收工”的最终口径。