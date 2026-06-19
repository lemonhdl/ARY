# DCR Rider 客户端 — 错误码定义

本文定义 DCR Desktop App 可能产生的错误码，供 ARY 服务端、E 组集成校验和 QA 参考。

## 错误码表

| 错误码 | 名称 | 来源 | 说明 |
|--------|------|------|------|
| `DCR-001` | HANDSHAKE_FAILED | W1 握手 | CAConnection 登记或握手请求失败。可能原因：ARY 服务端不可达、网络超时、`registrationId` 无效 |
| `DCR-002` | HANDSHAKE_REJECTED | W1 握手 | ARY 服务端拒绝握手。可能原因：Registration 未批准、赛事时间窗口已关闭、CA 类型不被允许 |
| `DCR-003` | SIGNATURE_FAILED | W9 签名 | 消息签名失败。私钥不存在或已过期。客户端应重新登录获取新密钥 |
| `DCR-004` | VERIFICATION_FAILED | W9 验签 | ARY 服务端验签失败。消息可能被篡改、签名与公钥不匹配、或被重放攻击 |
| `DCR-005` | REPLAY_REJECTED | W4 防重放 | 服务端检测到重放攻击。`idempotencyKey` 或 `messageId` 已存在 |
| `DCR-006` | SEQUENCE_ANOMALY | W4 防重放 | 消息 `sequence` 不连续或有倒退。可能跳过了某些消息或存在并发发送问题 |
| `DCR-007` | NO_CONNECTION_PERMISSION | W1/W6 权限 | CAConnection 未被登记、未完成握手、归属错误或被禁用，无权限上报数据 |
| `DCR-008` | SNAPSHOT_FETCH_FAILED | W3 fetch | ARY 服务端请求 Session 快照时，DCR 客户端无法生成或返回快照。可能原因：本地 Session 文件损坏、Claude Code 进程异常退出 |
| `DCR-009` | CA_SESSION_PERMISSION_DENIED | W5 接入失败 | CA 会话权限被拒绝。可能原因：Claude Code API key 失效、上游认证失败、上游限流 |
| `DCR-010` | CHAIN_BROKEN | W8 防伪造 | 哈希链断裂。检测到对话历史被增删、篡改，或文件快照与对话记录不匹配 |
| `DCR-011` | PROJECT_DIR_NOT_FOUND | 文件快照 | DCR_PROJECT_DIR 指定的项目目录不存在或无法访问 |
| `DCR-012` | UPSTREAM_UNAVAILABLE | 中转代理 | 上游 API 不可达。可能原因：网络故障、上游服务宕机、API key 失效 |

## 错误消息格式

当 DCR 产生错误时，除正常 `RidingSignalMessage` 字段外，附带 `ingestion` 对象：

```json
{
  "schemaVersion": "ary.ca.riding_signal.v0.1",
  "messageId": "msg_xxx",
  "signal": {
    "kind": "event",
    "type": "risk_detected",
    "phase": "paused",
    "taskStatus": "blocked"
  },
  "ingestion": {
    "status": "failed",
    "statusReason": "DCR-003",
    "statusMessage": "Signature failed: private key not found. Please re-login to obtain a new key.",
    "lastSyncedAt": "2026-06-20T12:00:00Z",
    "scope": "ca_connection"
  }
}
```

## E 组集成要求

- 收到 `signal.type = "risk_detected"` 且 `ingestion.status = "failed"` 的消息时，应进入异常处理路径
- `ingestion.statusReason` 字段携带本表定义的错误码，可用于自动分类和统计
- 验签失败（DCR-004）的消息不得进入有效比赛事实
