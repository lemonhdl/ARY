# DCR 协议摘要

本文描述 DCR Desktop App 与 ARY 服务端之间的通信协议，供 E 组集成、QA 测试和架构评审使用。

## 1. 系统架构

```
Rider 本机:
  Claude Code ──→ DCR Proxy (localhost:3738) ──→ 上游 LLM API
                       │
                       ├── 记录每轮对话 + 文件快照
                       ├── SHA256 哈希链
                       └── Ed25519 签名
                            │
  DCR UI (localhost:3737) ←── 读取 ~/.claude/ + ~/.dcr/sessions/
                            │
                            └── 骑手查看骑行数据、对话流、哈希链
```

## 2. 消息格式

### 2.1 RidingSignalMessage

对齐 `ary-ca-integration-spec.md` §5.2。核心字段：

```
schemaVersion           string   "ary.ca.riding_signal.v0.1"
messageId               string   UUID
idempotencyKey          string   幂等键（caType:raceId:regId:connectorId:sessionId:seq_N）
sequence                number   递增序号
timestamp               datetime ISO 8601
race.raceId / taskId    string   赛事/任务 ID（当前 __MOCK__）
rider.registrationId    string   报名 ID（当前 __MOCK__）
rider.raceProjectId     string   参赛项目 ID（当前 __MOCK__）
ca.caType               enum     "claude_code"
ca.caConnectionId       string   CA 连接 ID（当前 __MOCK__）
signal.kind             enum     "event" | "note"
signal.type             enum     14 种信号类型
signal.phase            enum     riding | paused | finished
counters                object   累计 tokens / toolCalls / messages
technicalActions        array    工具调用统计
summary                 object   当前目标 / 风险等级
```

### 2.2 签名格式

```
算法:    Ed25519
范围:    整个消息体（不含 signature 字段）
序列化:  RFC 8785 JSON Canonicalization Scheme (JCS)
位置:    消息内嵌 signature 字段

{
  ...消息字段...,
  "signature": {
    "algorithm": "Ed25519",
    "value": "<base64>",
    "canonicalLength": N,
    "signedAt": "<ISO 8601>"
  }
}
```

### 2.3 哈希链格式

```
每条消息:
  prevHash: SHA256(上一条消息的 hash)
  hash:     SHA256(prevHash + canonicalJSON(本条消息内容))
  文件快照: SHA256(项目目录所有 git 追踪文件)

提交校验:
  链完整 ∧ prevHash 首尾咬合 ∧ 文件哈希演进与对话记录一致
  → 无伪造
```

## 3. 通信流程

### 3.1 CAConnection 登记与握手 (W1)

```
DCR Desktop App                          ARY 服务端
  │                                         │
  ├─ POST /ary/ca/register                  │
  │   { registrationId, caType, ... }       │
  │                                         ├─ 验证 Registration
  │                                         ├─ 生成 caConnectionId
  │   ← { caConnectionId, status: "handshaken" }
  │                                         │
```

### 3.2 Push 骑行信号 (W2)

```
DCR Desktop App                          ARY 服务端
  │                                         │
  ├─ POST /ary/ca/push                      │
  │   RidingSignalMessage (已签名)          │
  │                                         ├─ 验签
  │                                         ├─ 幂等去重
  │                                         ├─ sequence 校验
  │   ← 200 OK / 409 Duplicate / 400 Reject │
```

### 3.3 Session 快照 Fetch (W3)

```
ARY 服务端                              DCR Desktop App
  │                                         │
  ├─ GET /ary/ca/connections/{id}/          │
  │   sessions/{sessionId}/snapshot         │
  │                                         ├─ 读取本地 Session 数据
  │                                         ├─ 构造快照
  │   ← SessionSnapshot                     │
```

## 4. Signal Type 映射

Claude Code 原始事件 → ARY signal.type：

| Claude Code 事件 | signal.type |
|-----------------|-------------|
| 首次用户 prompt | `session_started` |
| 用户 prompt | `task_progress` |
| 含阻塞关键词的 prompt | `task_blocked` |
| assistant 文本响应 | `task_progress` |
| 测试/构建类 tool_use | `validation_run` |
| tool_result 包含 error | `risk_detected` |
| 上游 API 连接失败 | `risk_detected` |

## 5. 防伪体系

```
三层防线:
  Ed25519 签名         → 防篡改：改一个字段验签失败
  SHA256 哈希链        → 防删改：删除/插入/跳段全链断裂
  项目文件快照         → 防替换：代码演进路径必须对应对话记录
```
