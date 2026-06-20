# B-Admin 最新提交复审（2026-06-20）

审查对象：`5ffac20`（`GRS-003-b-admin-v2`）、`dc98f31`（`GRS-003-B-admin`），以及当前程序壳中的集成面 `app/web/admin/dashboard.html`、`app/web/admin/maintenance.html`。

结论：这两次最新 B-Admin 提交本身没有再暴露新的上游交付缺口；相反，它们补强了 `ca-status.sample.json`、Dashboard 的 CA 风险呈现，以及维护页的批量重算 / 审计历史 / Report 审核动作。当前真正的风险出在集成面：`app/web/admin/dashboard.html` 和 `app/web/admin/maintenance.html` 在吸收这些增量时残留了冲突标记，导致页面处于“代码文本已合流、实际运行版本不可信”的状态。这个问题已由集成侧在当前仓库就地解决并完成回归，因此当前口径应收敛为：**B-Admin 最新提交可直接并入 app，无需再等待 B 侧返工。**

## Findings

### 1. 中优先级：最新 B-Admin 增量与现有 app 管理页的合流过程中残留了冲突标记，导致 Dashboard / 维护页一度处于不可交付状态

- 冲突集中在 [app/web/admin/dashboard.html](../app/web/admin/dashboard.html) 和 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html)，覆盖 CA 风险表、Projection 历史、Report 审核动作，以及维护页中已接入的 A-Rider 区块周边。
- 上游 B 组交付位于 [deliverables/b-admin/admin-shell/dashboard.html](../deliverables/b-admin/admin-shell/dashboard.html)、[deliverables/b-admin/admin-shell/maintenance.html](../deliverables/b-admin/admin-shell/maintenance.html) 和 [deliverables/b-admin/ca-status.sample.json](../deliverables/b-admin/ca-status.sample.json)，内容本身是可消费的；真正出问题的是 E 侧当前程序壳中的合并结果，而不是 B 组最新样例或 admin-shell 结构本身。
- 当前已在程序壳中完成收口：Dashboard 统一为可展示 `failed / handshaken / registered / flagged anomaly` 的 CA 风险表；维护页保留了 A-Rider 接入验收区块，同时吸收了最新 B 的批量 Projection 操作、审计日志优先的历史表，以及更宽松的 Report “已审核”入口。

影响：如果不修，最新 B 的管理端增量无法被当前 app 可信消费；修完后，这个问题不再构成 B 侧 blocker。

## What Passed

- 最新 B 提交新增的 [deliverables/b-admin/ca-status.sample.json](../deliverables/b-admin/ca-status.sample.json) 已可被当前装配链路继续消费，没有新的 JSON / handoff 结构问题。
- 最新 B 提交中的 Dashboard / 维护页增量需求已经在程序壳中完成吸收，并与既有 A-Rider 验收区块共存。
- 当前程序壳中的 Dashboard 与维护页已经去除冲突标记，且保留了此前已接入的 Dashboard 风险提醒、维护页 CA 状态详情与 A-Rider 区块。

## Run/Test 结果

我实际执行了以下验证：

1. `node .\scripts\assemble.js`
   - 结果：成功重建 `runtime-data/assembled-view.json` 与 `runtime-data/compatibility-report.json`，无 warnings。
2. `node .\scripts\validate-handoffs.js`
   - 结果：`ok: true`，`a-rider / b-admin / c-frontend / d-data` 的正式 manifest 均被发现。
3. HTTP 路由检查
   - `GET /admin/dashboard.html`：`200`
   - `GET /admin/maintenance.html`：`200`
4. 页面文本检查
   - Dashboard 返回内容包含 `ca-anomaly-table`，且不再包含 `<<<<<<< / ======= / >>>>>>>`。
   - Maintenance 返回内容包含 `a-rider-summary` 与 `projection-history-table`，且不再包含冲突标记。

## Overall Assessment

- 如果看“B 组最新两次提交本身是否仍有必须退回上游返工的结构性缺口”，答案是：**没有发现新的上游 blocker**。
- 如果看“当前 app 能否直接吸收这些增量”，答案是：**可以，但需要由集成侧先解决已有程序壳合并残留**。
- 现在这一步已经做完，因此当前最准确的结论是：**B-Admin 最新提交已完成复审并重新并入 app，当前再次回到可直接收工状态。**

## Recommended Next Steps

1. 维持当前程序壳中的合流版本，后续若 B 再有增量，优先从 `app/web/admin/dashboard.html` 和 `app/web/admin/maintenance.html` 这两个已验证入口继续小步集成。
2. 如需最终对外同步，直接以“最新 B-Admin 增量已并入程序壳，剩余不再是 B 侧返工，而是常规总体验收整理”作为当前口径。