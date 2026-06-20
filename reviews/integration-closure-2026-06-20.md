# B-Admin / D-Data 最终集成收工说明（2026-06-20）

审查对象：当前工作树中的 `app/`、`scripts/`、`runtime-data/`、`deliverables/b-admin/`、`deliverables/d-data/`

结论：截至本轮集成收口，**D-Data 已完成运行时主数据源接入，B-Admin 已完成运行壳末尾残项与样例枚举清理，二者都已达到“可直接进入最终集成验收 / 收工”状态**。当前仓库不再存在必须等待 B-Admin 或 D-Data 新提交后才能继续推进的阻塞项；剩余工作主要是集成方常规留痕、最终回归和必要的对外同步。

## Final Judgment

- `d-data`：完成度可按 **85% 到 90%** 口径看待，且当前关键结论不是“仍需返工”，而是**已被当前运行时主链路消费**。
- `b-admin`：完成度可按 **90% 到 95%** 口径看待，且当前关键结论不是“等下一版提交”，而是**运行壳与交付样例都已收口**。
- 当前最合适的项目口径是：**继续由我们自己完成最终集成验收与收工，不再以等待 B / D 新提交作为前置条件。**

## What Closed

### D-Data

- `scripts/assemble.js` 现已优先消费 `deliverables/d-data/authority-mock.json` 作为运行时主 authority mock。
- `scripts/setup-runtime.js` 已与上述主源策略保持一致。
- live `/api/runtime/assembled-view` 当前返回 `authorityMockSource = deliverables/d-data/authority-mock.json`，说明运行态主源切换已生效。
- `assembled-view` 已带出 D-data 的 richer payload，而不再停留在 bootstrap 两场赛事占位数据。

### B-Admin

- Dashboard 已补上 CA 接入异常列表。
- Dashboard 已补上 Report 撤回失败摘要，以及“赛事已结束但 Report 仍未发布”的提醒逻辑。
- 维护页已补上 Projection 批量重算入口、重算历史列表、Report 失败原因展示与“已审核”动作。
- 运行时 `caStatuses` 已按共享字段字典收敛，维护页与 live API 均不再展示旧值 `connected`。
- `deliverables/b-admin/ca-status.sample.json` 中残留的旧枚举 `connected` 也已清理为共享契约枚举 `handshaken`。

## Final Validation Evidence

我实际执行并确认了以下结果：

1. `node scripts/assemble.js`
   - 结果：成功重建 `runtime-data/assembled-view.json` 与 `runtime-data/compatibility-report.json`，且无 warnings。
2. `node scripts/validate-handoffs.js`
   - 结果：`a-rider`、`b-admin`、`c-frontend`、`d-data` 的 `handoff.manifest.json` 全部被成功发现。
3. HTTP 关键路由检查
   - `GET /admin/dashboard.html`：`200`
   - `GET /admin/maintenance.html`：`200`
   - `GET /admin/config.html`：`200`
   - `GET /admin/audit-log.html`：`200`
   - `GET /admin/users.html`：`200`
   - `GET /api/runtime/assembled-view`：`200`
4. live runtime payload 摘要
   - `authorityMockSource = deliverables/d-data/authority-mock.json`
   - `raceCount = 8`
   - `workCount = 13`
   - `resultCount = 2`
   - `caStatuses = active, failed, handshaken, not_configured`
5. 浏览器回归
   - Dashboard 已实际渲染 CA 异常列表与 Report 风险提醒。
   - 维护页已实际渲染批量重算按钮、重算历史区块、Report 失败原因与“已审核”动作。
   - 配置页、审计日志页、用户页在 richer runtime data 下继续正常渲染。

## Remaining Work

- 当前剩余工作不再属于 B-Admin / D-Data 的结构性交付缺口。
- 合理的剩余项主要是：
  - 最终集成验收留痕
  - 如需要，对外同步最新完成度与收工口径
  - 后续若 C 组公开端真实页面壳接入运行时，再补一轮 Public / Live / Screen 的业务页回归

## Recommended Close-Out Position

- 对内口径：**B-Admin 与 D-Data 已达到可直接集成收工状态。**
- 对外口径：**不再等待新的 B-Admin / D-Data 提交；如后续有新增提交，只按增量吸收，不作为当前集成阻塞项。**
