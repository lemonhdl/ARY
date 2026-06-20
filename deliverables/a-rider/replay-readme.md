# E 组本地回放与集成测试指南

本文说明如何使用 A 组交付的样例数据完成本地回放和集成测试，无需连接真实 Claude Code 或上游 API。

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
