# A 组任务：Rider 客户端完整任务与统一交付

本文不是对原始 Rider 分工的摘要版，而是把原始详细任务正文直接保留到 `todos/` 中，并在末尾追加统一交付与自动集成要求。

## 1. 我做的是什么

DCR Desktop App，运行在骑手本地的桌面客户端。它是 Claude Code 与 ARY 赛事平台之间的唯一数据上报通道，负责从用户本地的 Claude Code 提取骑行信息、签名、上报到 ARY 服务端。

只支持 Claude Code。

## 2. 我做什么（9 项）

| # | 工作项 | 一句话说明 |
|---|--------|-----------|
| W1 | CAConnection 登记与握手 | Rider 在参赛过程中将 Claude Code 会话登记到 ARY，完成身份握手，拿到 `caConnectionId` |
| W2 | 骑行信号实时 push | 将 Claude Code 骑行过程中的关键事件推送到 ARY 服务端 |
| W3 | Session 快照 HTTP fetch 接口 | 暴露 HTTP 端点，供 ARY 服务端按需拉取完整 Session 数据 |
| W4 | 消息幂等与防重放 | 每条 push 消息携带 `messageId`、`idempotencyKey`、递增 `sequence` |
| W5 | 接入失败上报 | CAConnection 接入异常时主动 push 失败消息，不隐瞒 |
| W6 | 身份字段携带 | 每条消息带齐 `registrationId`、`raceProjectId`、`caConnectionId` 等身份字段 |
| W7 | 数据边界控制 | 不把 GitHub Repo 伪装成骑行数据，不在公开端暴露原始 Session |
| W8 | 赛后防伪造 | 不接受赛后手动上传 Session Summary 充当实时骑行证据 |
| W9 | 消息防伪与防篡改 | 每条 push 消息做完整性签名，确保消息来自真实 CA 且未被篡改 |

## 3. 防伪与防篡改机制

用户新增要求：消息必须来自真实 CA，通过 DCR Desktop App 产生，未被伪造、未被篡改。

### 3.1 设计决策

| 决策点 | 结论 | 状态 |
|--------|------|------|
| 签名机制 | 待定（Ed25519 / ECDSA / HMAC 等方案待讨论） | 需讨论 |
| 密钥生成位置 | ARY 服务端生成。用户每次登录，服务端生成当次密钥 | 已定 |
| 密钥下发与保管 | 登录后由服务端下发至 DCR Desktop App；客户端负责本次会话期间保管 | 已定 |
| 签名范围 | 整个消息体（签名覆盖 JSON 全文） | 已定 |
| 签名执行者 | DCR Desktop App | 已定 |
| 验签执行者 | ARY 服务端 | 已定 |

### 3.2 流程

```text
Rider 启动 DCR Desktop App
	  │
	  ▼
  GitHub 登录
	  │
	  ▼
  ARY 服务端生成密钥对
  → 私钥下发至 DCR Desktop App
  → 公钥保留在服务端，绑定该次登录会话
	  │
	  ▼
  DCR Desktop App 开始采集 Claude Code 骑行数据
	  │
	  ▼
  每条 push 消息：构造 JSON → 用私钥签名 → 发送签名+原文
	  │
	  ▼
  ARY 服务端：用对应公钥验签 → 验签通过才进入后续链路
				 → 验签失败则拒收/告警
```

### 3.3 待讨论

1. 签名算法选哪个。
2. 签名放在 JSON 字段还是 HTTP Header。
3. 私钥仅内存还是加密落盘。
4. 客户端重启后是否重新登录拿新密钥。
5. fetch 返回的 Session 快照是否也需要签名。
6. 签名失败或验签失败时的降级策略。

## 4. 系统边界

我做的事：

1. 登录认证。
2. 接收并保管私钥。
3. 采集骑行信号。
4. 构造 push 消息。
5. 对整个消息体签名。
6. 暴露 fetch 端点。
7. 生成幂等键和序列号。
8. 上报失败状态。
9. 保证数据真实。

别人做的事：

1. 生成与保管密钥对。
2. 验签每一条消息。
3. 验签失败处理。
4. 接收与校验消息。
5. 幂等去重、归属校验、Projection 生成、Evidence 生成、评审前风险提示、Award / Report 生成、权限校验。

## 5. 我不做什么（14 项）

1. 不支持 Codex。
2. 不支持其他 CA（`other`）。
3. 不做 Session 完整数据的定期 push。
4. 不做定时进度推送。
5. 不接收赛后上传的 Session Summary。
6. 不把 GitHub Repo 当作 CA 数据源。
7. 不写 ARY 业务对象。
8. 不暴露原始 CA Session 给公开端。
9. 不处理 CA 接入失败导致的参赛资格变更。
10. 不在赛事冻结窗口放宽数据校验。
11. 不做多 CA 标准化协议。
12. 不做反作弊系统。
13. 不做 Team 参赛。
14. 不做组织或学校租户。

## 6. 对上游与下游的依赖

| # | 依赖方 | 我需要对方提供 | 状态 |
|---|--------|--------------|------|
| D1 | ARY 服务端 | CAConnection 登记与握手 API | 待确认 |
| D2 | ARY 服务端 | push 消息接收端点 | 待确认 |
| D3 | ARY 服务端 | `registrationId`、`raceProjectId` | 待确认 |
| D4 | ARY 服务端 | fetch 触发时机和端点约定 | 待确认 |
| D5 | ARY 服务端 | `RidingSignalMessage` schema | 已草案 |
| D6 | 产品或赛事 | `raceId`、`taskId` 分配规则 | 待确认 |
| D7 | 产品或赛事 | CAConnection 新增窗口截止规则 | 已定义待落地 |
| D8 | ARY 服务端 | 登录后下发签名私钥的接口 | 需讨论 |
| D9 | ARY 服务端 | 消息签名方案确认 | 需讨论 |

## 7. 审查检查清单

1. 9 项工作是否覆盖 Rider 客户端全部职责。
2. 14 项不做事项有没有误列或遗漏。
3. 边界划分是否正确。
4. 只支持 Claude Code 是否可行。
5. 防伪防篡改设计是否认可。
6. 9 项依赖是否完整。
7. 是否与其他角色或模块重叠冲突。
8. 是否需要同步更新其他基线文档以纳入签名与验签要求。

## 8. 统一执行输入

必须先读：

1. `todos/10-Shared-Field-Dictionary.md`
2. `todos/11-Publication-Visibility-Rules.md`
3. `todos/16-Project-Baseline-Requirements.md`
4. 本文

## 9. 统一交付输出

你必须在 `deliverables/a-rider/` 下交出以下产物：

1. `handoff.manifest.json`
2. `riding-events.sample.json`
3. `ca-status.sample.json`
4. `signature-samples.json`
5. `error-codes.md`
6. `replay-readme.md`
7. `protocol-summary.md`
8. `client-source/` 或 `connector-simulator/`
9. `session-fetch.contract.json`
10. `register-handshake.contract.json`

## 10. 交付附加要求

### 10.1 `riding-events.sample.json`

至少提供 3 条正常事件流样例、1 条乱序或重放样例、1 条失败事件样例，并能映射到 `LiveEventEntry`、`CAConnectionStatusView` 与 `LiveHeadlineMetricsView` 上游输入。

### 10.2 `ca-status.sample.json`

至少覆盖 `registered`、`handshaken`、`active`、`failed`、`not_configured`。

### 10.3 `signature-samples.json`

必须提供待签名原文、canonicalization 说明、签名值样例、验签失败样例。第一轮建议采用 `Ed25519`、固定 canonical JSON、签名放 Header。

### 10.4 `error-codes.md`

至少定义握手失败、签名失败、重放拒绝、sequence 异常、无权限连接、快照拉取失败。

### 10.5 `replay-readme.md`

说明如何让 E 使用你的样例完成本地回放和集成测试。

## 11. 验收标准

1. D 能用你的样例生成统一权威 mock。
2. E 能读取你的 manifest 和样例自动集成到回放链路。
3. C 能根据你的脱敏事件样例在 Live Hall 中展示 event stream，而不读取原始 CA Session。
4. 交付内容不能回避原始 Rider 任务的详细边界和待讨论项。