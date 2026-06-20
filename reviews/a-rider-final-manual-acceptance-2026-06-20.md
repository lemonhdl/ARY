# A-Rider 最终人工验收记录（2026-06-20）

验收目标：补一轮基于运行中 app 的人工验收留痕，确认 A-Rider 不仅已完成 review 和代码接线，而且已形成可访问、可联调、可作为收工证据的集成面。

验收环境：

- 本机单机应用：`http://127.0.0.1:3000`
- 验收方式：运行中 app 的 HTTP/API 实测 + 管理端渲染实测
- 验收范围：A-Rider runtime summary、contract 切片、Admin 维护页接线区块

## 验收结论

本轮人工验收通过。A-Rider 当前已具备完整的 app 内集成面：运行时摘要、事件样例、contract 切片、快照信息和管理端联调入口均可从运行中单机应用访问。当前可将 A-Rider 作为“已集成且已具备人工收工证据”的交付看待。

## 实测记录

### 1. Admin 维护页 A-Rider 区块可见

- 路由：`/admin/maintenance.html#a-rider-replay`
- 观察结果：页面标题为 `ARY Admin · 数据维护`；页面中存在标题为 `A-Rider 回放与接入验收` 的区块；摘要卡正常显示：
  - `Sample Events = 6`
  - `normal 5 / failure 1`
  - `CA Status Samples = 5`
  - `Snapshot Progress = 95% / in_progress`
  - `Signing = Ed25519`
- 结论：通过。

### 2. Admin 区块 contract 摘要已渲染

- 路由：`/admin/maintenance.html#a-rider-replay`
- 观察结果：A-Rider 区块中已渲染 2 行 contract 摘要，分别对应：
  - `Register / Handshake`
  - `Session Snapshot Fetch`
- 结论：通过。

### 3. Admin 区块事件样例表已渲染

- 路由：`/admin/maintenance.html#a-rider-replay`
- 观察结果：A-Rider 区块中事件样例表已渲染 `6` 行样例事件，可作为集成侧回放和联调入口。
- 结论：通过。

### 4. A-Rider runtime summary API 可访问

- 路由：`/api/runtime/a-rider`
- 观察结果：返回 `200`；可读到：
  - `eventSampleCount = 6`
  - `normalEventCount = 5`
  - `failureEventCount = 1`
  - `signingAlgorithm = Ed25519`
  - `handshakePath = /ary/ca/register`
  - `fetchPath = /ary/ca/connections/{caConnectionId}/sessions/{caSessionId}/snapshot`
  - `snapshotProgressPercent = 95`
- 结论：通过。

### 5. A-Rider contracts API 可访问且边界正确

- 路由：`/api/runtime/a-rider/contracts`
- 观察结果：返回 `200`；register-handshake 与 session-fetch 两套 contract 均可读取；其中：
  - `registerHandshake.endpoint.method = POST`
  - `registerHandshake.endpoint.path = /ary/ca/register`
  - `sessionFetch.endpoint.method = GET`
  - `sessionFetch.endpoint.path = /ary/ca/connections/{caConnectionId}/sessions/{caSessionId}/snapshot`
  - `sessionFetch.response.schema.ca.caType = enum: claude_code`
  - `registerHandshake.keyManagement.keyGeneration = ARY 服务端在握手时生成密钥对`
- 结论：通过。

## 最终判断

- A-Rider 已完成本轮最终人工验收留痕。
- 当前可将其作为“已完成 review、已接入 app、且已具备人工收工证据”的交付处理。
- 后续如果还要继续处理，已经不是主阻塞，只剩增量演进或可选的补充留痕。