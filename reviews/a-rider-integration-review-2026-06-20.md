# A-Rider 最新提交复审与集成收口（2026-06-20）

审查对象：`deliverables/a-rider/` 最新提交（`0f0a1e5` + `0c93afd`）及其在当前仓库内的集成结果

结论：A-Rider 本轮最新提交已经实质性关闭了上轮最核心的握手 / 密钥归属矛盾，交付形态也从“可参考的原型”推进到了“可被当前单机 app 接入并联调”的状态。当前仓库内我已继续完成剩余收口工作并直接集成到 app，因此 **A-Rider 现在不再作为待返工前置项，而是可以按已集成、可继续收工的状态对待。**

## 本轮复审结论

### 上轮主问题已关闭

- `register-handshake.contract.json` 现已明确为：ARY 服务端在握手时生成 Ed25519 密钥对，私钥下发给 DCR Desktop App，公钥由服务端持有并用于验签。
- `clientPublicKey` 不再作为握手请求字段出现，之前“服务端生成密钥”与“客户端上送公钥”两套模型并存的问题已关闭。
- `proxy-source/` 已从 `client-source/` 内部移到 `deliverables/a-rider/proxy-source/` 平级目录，部署边界比上版更清晰。

### 本轮仍存在但已由集成侧本地收口的问题

1. `session-fetch.contract.json` 仍把 `caType` 写成包含 `codex` 的扩展范围，和 A 组任务边界“只支持 Claude Code”不一致。
2. `signature-samples.json` 仍残留少量过于真实化的示例文本与项目路径表达，不适合作为最终对外交付样例冻结。

上述两点我已在当前仓库直接修正：

- `deliverables/a-rider/session-fetch.contract.json` 已收窄回 `claude_code`。
- `deliverables/a-rider/signature-samples.json` 已把 `caProjectId`、`caSessionId` 与示例回复文本统一替换为稳定占位，不再把路径和具体实现语句带进最终集成面。

## 已完成的集成工作

### 1. 运行时装配

`scripts/assemble.js` 现已不只发现 A 的 manifest，而是会把以下 A-Rider 交付真实装配进 `runtime-data/assembled-view.json`：

- `riding-events.sample.json`
- `ca-status.sample.json`
- `session-snapshot.sample.json`
- `signature-samples.json`
- `register-handshake.contract.json`
- `session-fetch.contract.json`
- `protocol-summary.md`
- `replay-readme.md`
- `error-codes.md`

同时新增 `assembledView.aRider.summary`，便于 app 直接消费事件数、签名算法、握手路径、fetch 路径和快照进度摘要。

### 2. App API 接线

`app/server/index.js` 现已暴露以下 A-Rider 运行时 API：

- `/api/runtime/a-rider`
- `/api/runtime/a-rider/riding-events`
- `/api/runtime/a-rider/session-snapshot`
- `/api/runtime/a-rider/signature-samples`
- `/api/runtime/a-rider/contracts`

这使 A-Rider 不再只是 deliverables 目录里的静态交付，而是已经进入 app 的可消费运行态切面。

### 3. 管理端可见接线面

`app/web/admin/maintenance.html` 已新增 “A-Rider 回放与接入验收” 区块，当前会展示：

- Sample Events / CA Status Samples / Snapshot Progress / Signing 摘要卡
- Register / Handshake 与 Session Snapshot Fetch contract 摘要
- A-Rider 事件样例表

根入口页 `app/web/index.html` 也新增了 A-Rider Replay 入口卡与相关 runtime endpoint 链接。

## 验证结果

我实际执行并确认了以下结果：

1. `node .\scripts\assemble.js`
   - 结果：成功生成最新 `runtime-data/assembled-view.json`，无 warnings。
2. `node .\scripts\validate-handoffs.js`
   - 结果：`a-rider` manifest 继续可被自动发现。
3. `GET /api/runtime/a-rider`
   - 结果：返回 `200`，并能读到 `summary.eventSampleCount=6`、`summary.signingAlgorithm=Ed25519`、`/ary/ca/register` 与 snapshot fetch 路径。
4. `GET /api/runtime/a-rider/contracts`
   - 结果：返回 register-handshake / session-fetch 两套 contract，且 session-fetch 已收窄为 `claude_code`。
5. `GET /admin/maintenance.html`
   - 结果：运行中 app 返回的 HTML 已包含 `A-Rider 回放与接入验收`、`a-rider-summary`、`a-rider-events-table`、`Register / Handshake` 等标记，说明管理端已接入 A 的联调界面。

## 当前口径

- **A-Rider 已完成最新提交复审。**
- **A-Rider 剩余必须收口的集成工作已在当前仓库完成。**
- **A-Rider 当前可按“已集成、可继续最终验收与收工”的状态处理。**

后续若还要继续优化，已经不是主阻塞项，只剩：

- 如有需要，再补一轮针对 A-Rider 区块的最终人工浏览器验收留痕
- 如果 A 组后续继续演进 `proxy-source/` 或桌面端 UI，再按增量吸收