# E 组本地回放与集成测试指南

本文说明如何使用 A 组交付的样例数据完成本地回放和集成测试，无需连接真实 Claude Code 或上游 API。

> 本文只适用于直接运行 `deliverables/a-rider/client-source/` 的源码回放原型。若排查已经安装到 Windows 的 `DCR Desktop App` 桌面壳，请改查 `http://127.0.0.1:4302`，不要再用 `3737` 作为桌面壳是否启动成功的判据。

## 前提

- Node.js 24+
- 已获取 `deliverables/a-rider/` 下的全部文件

## 快速开始

```bash
# 1. 进入 client-source
cd deliverables/a-rider/client-source

# 2. 启动用户端（端口 3737）
node server.js

# 3. 打开 http://localhost:3737 查看骑行数据展示
```

## 样例文件说明

| 文件 | 内容 | 用途 |
|------|------|------|
| `riding-events.sample.json` | 正常事件流、乱序重放、失败事件 | 验证事件渲染、Projection 输入 |
| `ca-status.sample.json` | 5 种 CAConnection 状态 | 验证连接状态展示和聚合逻辑 |
| `signature-samples.json` | Ed25519 签名/验签/篡改样例 | 验证验签逻辑和防篡改检测 |

## 回放测试场景

### 场景 1: 正常消息渲染

```bash
# 生成新的样例消息（从本地 Claude Code 数据）
node generate-samples.js

# 查看输出
cat samples/riding-events.sample.json | head -50
```

E 组验证：消息结构符合 `ary-ca-integration-spec.md` §5.2，字段完整。

### 场景 2: CA 状态流转

读取 `ca-status.sample.json`，验证：
- 5 种状态均有样例
- `ingestionStatus` 枚举值与 spec 一致
- `registeredAt`/`handshakenAt`/`failedAt` 时间戳逻辑正确

### 场景 3: 签名验证

```bash
# 运行签名样例生成
node generate-signature-samples.js
cat samples/signature-samples.json
```

验证：
- Ed25519 签名可被公钥验证通过
- 篡改消息后验签失败
- 不同公钥验签失败

### 场景 4: 哈希链完整性

```bash
# 运行攻防演示
node test-attack.js
```

验证：
- 正常骑行链完整（valid: true）
- 篡改记录后链断裂（valid: false）
- 删除中间轮次后文件演进路径异常

## 集成检查清单

- [ ] `handoff.manifest.json` 可被 E 组脚本自动发现
- [ ] manifest 中所有 `required: true` 的产物均存在
- [ ] 消息 JSON 可通过 JSON Schema 校验
- [ ] 签名验签逻辑与样例行一致
- [ ] 哈希链验证逻辑与样例行一致
- [ ] 错误码定义覆盖所有失败路径
- [ ] `identity-config.json` 中 `__MOCK__` 字段标识清晰，替换路径明确

## Fixture 占位与真实字段对照

以下字段在样例和 identity-config.json 中使用 `__MOCK__` 前缀占位，接入真实 ARY 服务端后必须替换：

| 占位值 | 真实来源 | 替换时机 |
|--------|---------|---------|
| `__MOCK__race_2026_demo` | ARY 服务端分配的 raceId | W1 握手成功后 |
| `__MOCK__reg_008` | ARY 服务端分配的 registrationId | 同上 |
| `__MOCK__rp_008` | ARY 服务端分配的 raceProjectId | 同上 |
| `__MOCK__conn_claude_code_001` | ARY 服务端返回的 caConnectionId | W1 握手响应 |
| `__MOCK__dcr_desktop_v0.1` | 固定值，无需替换 | — |
| `__MOCK__sample_project` | 骑手实际项目路径 | 配置文件 `projectDir` |
| `__MOCK__sample_session_001` | Claude Code 实际 sessionId | 运行时自动获取 |
| `__MOCK__DEV-12` | ARY 服务端分配的 taskId | W1 握手成功后 |

**E 组注意**：做 fixture 比对时，上述字段不要做精确匹配，使用通配或跳过比对。
