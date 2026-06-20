# A-Rider 当前交付复审（2026-06-20）

审查对象：`deliverables/a-rider/` 当前交付（文档、样例、contract、`client-source/`）

结论：A-Rider 这次交付**不是空壳**，而且明显比单纯文档稿更进一步。它已经交出了完整 handoff 文件、可执行的 `client-source/`、签名样例生成器、哈希链攻防演示，以及一组可被 D / E 消费的事件与状态样例。从“能不能开始参考它做集成”看，答案是：**可以**。但从“这份交付是否已经把核心握手/签名 contract 定到足以直接对接收工”看，答案是：**还不够**。

我给 A-Rider 当前完成度一个大约 **75% 到 80%** 的判断。样例、源码骨架和 replay 说明都已经有了，说明 A 组不是只交了 PPT；但最核心的签名密钥归属、握手请求字段和支持范围仍然存在实质不一致，继续往下会直接影响 D / E 的正式接线。

## Findings

### 1. 高优先级：握手 contract 与签名密钥归属模型自相矛盾，D / E 无法据此稳定实现验签链路

- A 组任务包已经把设计决策写得很明确：**ARY 服务端生成密钥对，登录后把私钥下发给 DCR Desktop App，服务端保留公钥做后续验签**，见 `todos/01-A-Rider-Client.md` 第 3 节。
- 但当前 `register-handshake.contract.json` 要求请求体必须带 `clientPublicKey`，同时响应体又返回 `serverPublicKey` 和 `signingPrivateKey`。这相当于把“谁生成密钥、谁持有公钥、谁提供验签材料”混成了两套模型，见 `deliverables/a-rider/register-handshake.contract.json`。
- `protocol-summary.md` 也沿用了同一套混杂描述：一方面强调“ARY 服务端生成密钥对”，另一方面 handshake 响应里仍返回 `serverPublicKey` 供“后续签名验证”，语义不清，见 `deliverables/a-rider/protocol-summary.md`。
- `client-source/signing.js` 虽然注释里承认生产环境应由服务端下发私钥，但当前公开实现仍暴露本地生成密钥对 `generateKeyPair()` / `generateKeyPairDER()`，会继续强化“客户端自己生成密钥”这套另一种模型，见 `deliverables/a-rider/client-source/signing.js`。

影响：这不是文案小问题，而是核心 contract 不稳定。D 组和 E 组现在没法确定：

1. 登记接口是否必须接收客户端公钥。
2. 服务端是否真的负责生成整套签名密钥。
3. 验签时到底绑定哪一把公钥。

如果这个点不先收口，后续正式接线极容易出现“样例能跑、真实握手不兼容”的情况。

### 2. 中优先级：`session-fetch.contract.json` 扩大了 `caType` 支持范围，和 A 组“只支持 Claude Code”的任务边界不一致

- 任务包明确写了“只支持 Claude Code”，并在“不做什么”里写明不支持 Codex 和 `other`，见 `todos/01-A-Rider-Client.md`。
- 但 `session-fetch.contract.json` 里的响应 schema 仍把 `ca.caType` 写成 `codex | claude_code | other`，见 `deliverables/a-rider/session-fetch.contract.json`。

影响：这会把一个本轮并未支持的扩展面提前泄露给下游。D / E 如果照 contract 实现，就会被迫处理 A 组并未真正交付的 `codex` / `other` 分支；而如果只按 Claude Code 实现，又会和 contract 文本不一致。

### 3. 中优先级：样例数据未充分脱敏，仍暴露本机路径和真实操作文案，降低了交付的可移植性与脱敏质量

- `ca-status.sample.json`、`riding-events.sample.json`、`session-snapshot.sample.json` 都直接带出本机绝对路径 `C:\Users\ROG\Desktop\se\ARY` 作为 `caProjectId`。
- `riding-events.sample.json` 还直接保留了真实用户提示语句，例如 `你去把 GitHub 仓库上的 003 分支拷过来`。
- `client-source/generate-samples.js`、`server.js` 里也显式写入了同一路径的处理逻辑注释。

影响：

1. 这和交付目标里“脱敏事件样例供 C / D / E 消费”的口径不完全一致。
2. 样例会把某个开发者本机环境痕迹直接扩散到交付物里。
3. E 组后续做自动回放或 fixture 比对时，也更容易把不该稳定的本机路径当成事实字段。

## What Passed

- `handoff.manifest.json`、`riding-events.sample.json`、`ca-status.sample.json`、`signature-samples.json`、`error-codes.md`、`replay-readme.md`、`protocol-summary.md`、`session-fetch.contract.json`、`register-handshake.contract.json` 和 `client-source/` 都已交齐。
- `client-source/` 不是空目录，包含签名、消息构造、哈希链、文件快照、代理、UI、样例生成等代码文件，不是只有文档说明。
- `signature-samples.json` 生成脚本可以实际运行成功。
- `test-attack.js` 攻防演示可以实际跑通，并能展示哈希链断裂、删除中间轮次和外部改写三类被识别的场景。
- 仓库根级 `scripts/validate-handoffs.js` 校验已通过，A 组 manifest 可被自动发现。

## Run/Test 结果

我实际执行了以下验证：

1. 根级 handoff 校验
   - 命令：`node .\scripts\validate-handoffs.js`
   - 结果：`a-rider` manifest 存在并被自动发现。
2. 签名样例生成
   - 命令：`node .\deliverables\a-rider\client-source\generate-signature-samples.js`（在 `client-source/` 下执行）
   - 结果：成功生成 `samples/signature-samples.json`。
3. 哈希链攻防演示
   - 命令：`node .\deliverables\a-rider\client-source\test-attack.js`（在 `client-source/` 下执行）
   - 结果：正常链可通过；篡改和删除轮次场景可被识别。
4. 静态检查
   - `get_errors` 检查 `deliverables/a-rider/client-source/`
   - 结果：无静态错误。

## Overall Assessment

- 如果看“有没有真正交付可消费东西”，A-Rider 这次是**有的**。
- 如果看“是否已经达到 D / E 可以照着当前 contract 直接做正式握手与验签实现”，答案是：**还没有**。
- 当前更准确的定位是：**A-Rider 已经交出了一套很像最小可运行原型的客户端交付，但还需要先把签名/握手 contract 收口一致，才能进入稳定集成。**

## Direct Integration Judgment

- **可以开始参考其样例、源码和 replay 流程做集成准备。**
- 但**不建议直接按当前 handshake/signing contract 收工接线**。
- 最合理的策略是：先让 A 组补一轮返工，把密钥归属模型、握手字段和支持范围统一，再由 D / E 继续按定稿接入。

## Continue Improving

1. 统一握手与签名模型：如果服务端生成密钥对并下发私钥，那 `clientPublicKey` 不应再是必填请求字段；如果是客户端生成密钥对，则必须整体改写任务文档、protocol summary 和验签责任说明，二者只能保留一套。
2. 把 `session-fetch.contract.json` 中的 `caType` 收窄到 `claude_code`，不要提前暴露未支持的 `codex | other`。
3. 对样例重新脱敏：移除本机绝对路径、真实项目目录和原始操作文案，至少替换成稳定的占位或伪数据。
4. 在 `replay-readme.md` 里明确说明哪些字段是 fixture 占位、哪些字段在接入真实 ARY 服务端后必须由服务端回填。

## Recommended Next Steps

1. 先让 A-Rider 按本 review 返工一轮，不建议现在就把 handshake/signature contract 当成最终稿冻结。
2. D / E 可以继续消费现有样例做 Projection / replay 准备，但要把当前 handshake/signing 契约视为暂定版。
3. 等 A 组补齐后，再做一次 focused rereview，重点只看密钥归属、握手字段、`caType` 支持范围和样例脱敏质量。