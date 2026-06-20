# A-Rider 最新提交复审（2026-06-21）

审查对象：`e942ccb`、`d0364da`，以及当前仓库中的集成面 `deliverables/a-rider/`、`scripts/assemble.js`、`app/web/admin/maintenance.html`。

结论：这轮 A-Rider 新提交的核心增量不是握手 contract，而是把 DCR 的 `proxy-source/`、`one-api-source/` 和 One API 集成说明真正交进来了。上游交付本身可消费，但当前仓库原有集成面仍停留在上一轮，只装配了样例、contract 和旧文档，没有把新的源码包与 One API 说明纳入 handoff / runtime / 管理端可见面。这个缺口已由集成侧在当前仓库补齐，因此当前口径应收敛为：**A-Rider 最新提交已完成复审并重新并入 app，无需等待 A 侧返工。**

## Findings

### 1. 中优先级：最新 A-Rider 增量已经包含 `proxy-source/` 与 `one-api-source/`，但现有 handoff 与 runtime 集成面仍停留在旧交付形态

- 最新提交把 `deliverables/a-rider/proxy-source/`、`deliverables/a-rider/one-api-source/` 和 `deliverables/a-rider/proxy-source/one-api-integration.md` 带进了仓库，A-Rider 的交付边界已经从“骑手端 + contract + 样例”扩展为“骑手端 + 中转站 + 格式网关源码快照”。
- 但当前仓库原有的 [deliverables/a-rider/handoff.manifest.json](../deliverables/a-rider/handoff.manifest.json) 和 [deliverables/a-rider/handoff.manifest.template.json](../deliverables/a-rider/handoff.manifest.template.json) 仍只声明旧交付物，导致最新源码包没有进入正式 handoff 描述。
- 原有 [scripts/assemble.js](../scripts/assemble.js) 也只装配了样例、contract 和三份旧文档，没有把 One API 集成说明与新的源码目录摘要带进 `runtime-data/assembled-view.json`；管理端 [app/web/admin/maintenance.html](../app/web/admin/maintenance.html) 因此也无法体现这轮最新提交的真正增量。

影响：如果不补，A-Rider 这轮新增的中转站 / 格式网关交付虽然已经在仓库里，但对集成侧、验收侧和运行时可见面来说仍像“没交进来”，会让 handoff 与 app 可见事实长期背离。

## 已完成的集成收口

- [deliverables/a-rider/handoff.manifest.json](../deliverables/a-rider/handoff.manifest.json) 现已补入 `proxy-source/` 与 `one-api-source/`，并把 `client-source/` 描述收窄为骑手端源码。
- [deliverables/a-rider/handoff.manifest.template.json](../deliverables/a-rider/handoff.manifest.template.json) 已同步更新，避免后续模板继续回落到旧口径。
- [scripts/assemble.js](../scripts/assemble.js) 现已装配 `proxy-source/one-api-integration.md`，并在 `assembledView.aRider.summary.sourceBundles` 中输出 `client-source / proxy-source / one-api-source` 的目录摘要。
- [app/web/admin/maintenance.html](../app/web/admin/maintenance.html) 的 A-Rider 区块现已显示 `Source Bundles` 摘要卡，并新增 `One API Integration` 行，能把这轮新增源码包显式展示给管理端验收面。
- [app/server/index.js](../app/server/index.js) 现已补齐缺失的 A-Rider runtime 切片：`/api/runtime/a-rider/ca-status`、`/api/runtime/a-rider/docs`、`/api/runtime/a-rider/source-bundles`，使 `ca-status.sample.json`、`error-codes.md`、`protocol-summary.md`、`replay-readme.md` 和源码包摘要都能被 app 直接访问。
- [app/web/index.html](../app/web/index.html) 已同步列出这些新增 endpoint；[app/web/admin/maintenance.html](../app/web/admin/maintenance.html) 的 A-Rider 区块也已新增状态样例表、文档表和源码包表，至此任务包中要求的 A-Rider 交付物已全部具备 app 内可访问集成面。

## What Passed

- 最新 A-Rider 提交中的 `proxy-source/`、`one-api-source/` 和 One API 集成说明本身在仓库中完整存在，没有发现结构性缺件。
- 运行时装配已经成功把 One API 说明和源码目录摘要写入 `runtime-data/assembled-view.json`。
- 管理端维护页已经能展示 `Source Bundles`、A-Rider 状态样例、文档摘要和 `One API Integration`，说明新增交付不再只是 deliverables 目录里的静态文件，而是已经进入 app 内可见集成面。
- A 组任务包要求的核心交付物现在都已被 app 侧消费：`riding-events.sample.json`、`ca-status.sample.json`、`signature-samples.json`、`error-codes.md`、`replay-readme.md`、`protocol-summary.md`、`client-source/`、`session-fetch.contract.json`、`register-handshake.contract.json`，以及本轮新增的 `proxy-source/` / `one-api-source/`。

## Run/Test 结果

我实际执行并确认了以下结果：

1. `node c:\sandbox\sinba\ARY\scripts\assemble.js`
   - 结果：成功重建 `runtime-data/assembled-view.json` 与 `runtime-data/compatibility-report.json`，无 warnings。
2. 运行时字段检查
   - 结果：`assembled-view.json` 中 `aRider.summary.hasOneApiIntegrationDoc = true`，`aRider.summary.sourceBundles.proxySource.fileCount = 13`，`aRider.summary.sourceBundles.oneApiSource.fileCount = 570`，且 `aRider.docs.oneApiIntegration` 已存在。
3. 新增 runtime endpoint 检查
   - `GET /api/runtime/a-rider/ca-status`：返回 `200`，包含 `statuses`。
   - `GET /api/runtime/a-rider/docs`：返回 `200`，包含 `protocolSummary / replayReadme / errorCodes / oneApiIntegration`。
   - `GET /api/runtime/a-rider/source-bundles`：返回 `200`，包含 `clientSource / proxySource / oneApiSource`。
4. 管理端页面检查
   - 路由：`GET /admin/maintenance.html?ts=...#a-rider-replay`
   - 结果：页面已出现 `Source Bundles` 与 `One API Integration`；A-Rider 摘要卡数量为 `5`，contract/说明表行数为 `3`，状态样例表行为 `5`，文档表行为 `4`，源码包表行为 `3`。

## Overall Assessment

- 如果看“这轮 A-Rider 最新提交本身是否有必须退回上游返工的结构性问题”，答案是：**没有发现新的上游 blocker**。
- 如果看“当前 app 是否已经真实吸收了这轮最新交付”，答案在补丁前是：**还没有完全吸收**；现在这一步已经由集成侧补齐。
- 当前最准确的结论是：**A-Rider 最新提交已完成复审并重新并入 app，且 A 组任务包要求的交付物已经全部进入 app 的可访问集成面，现阶段不再需要等待 A 侧返工。**