# DCR Desktop App — Rider 客户端

DCR（Desktop Claude Code Relay）是运行在骑手本地的桌面应用，也是 Claude Code 与 ARY 赛事平台之间唯一的数上报通道。它负责实时采集骑行数据、构造标准消息、签名、建立防伪哈希链，并最终交付可被自动集成系统消费的产物。

## 核心问题

一场 Agent 骑行比赛中，骑手用 Claude Code 完成赛题。组织者需要确认：**提交的作品确实是 Claude Code 在比赛期间一步步产生的，没有被删减、替换、或借助其他工具作弊。**

传统的"事后读文件 + 上传"方案无法防伪——文件系统谁都能写。DCR 解决这个问题的方式是：挡在 Claude Code 前面，实时拦截一切。

## 架构思路

```
Rider 本机
    │
    ├─ Claude Code ──→ DCR Proxy (:3738) ──→ 上游 LLM API
    │                       │
    │                       ├── 透明转发（不改请求/响应内容）
    │                       ├── 记录每轮对话元数据
    │                       ├── 每轮后对项目文件做 SHA256 快照
    │                       ├── 链式哈希咬合前后轮次
    │                       └── 写入 ~/.dcr/sessions/
    │
    └─ DCR UI (:3737) ←── 读 ~/.claude/ + ~/.dcr/sessions/
                            │
                            └── 骑手看对话流、骑行统计、哈希链
```

关键设计决策：**不事后读盘，而是在 API 流量层拦截**。Claude Code 把 API 端点指向 DCR 代理后，每一个请求和响应都经过 DCR，记录在第一现场。绕过 DCR 的任何 Agent 都不会产生链记录。

## 三层防伪体系

### 第一层：链式哈希

```
消息1                          消息2                          消息3
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│ prevHash: 0...0  │    ┌───→│ prevHash: H(msg1) │    ┌───→│ prevHash: H(msg2) │
│ content: ...     │    │    │ content: ...      │    │    │ content: ...      │
│ hash: H1         │────┘    │ hash: H2          │────┘    │ hash: H3          │
└──────────────────┘          └──────────────────┘          └──────────────────┘
```

每条记录 `hash = SHA256(prevHash + 本条 canonical JSON)`。增、删、改任何一条，后续所有 hash 全部对不上。

### 第二层：项目文件快照

每轮对话结束后，对项目目录所有 Git 追踪文件做 SHA256 快照，和对话哈希绑在一起。如果一个回合只消耗了 500 token，文件却多了三个模块、登录页重写了两百行——用能-产出比异常，有外援嫌疑。

### 第三层：Ed25519 签名

```
DCR 持有私钥 → 签名消息 → ARY 服务端公钥验签
```

算法 Ed25519，签名覆盖整个消息体的 canonical JSON（RFC 8785 JCS）。改一个字段验签失败。

## 模块结构

```
rider-client/
├── proxy.js              ← 中转代理，端口 3738
├── server.js             ← 用户端 Web UI，端口 3737
├── message-builder.js    ← Claude Code 事件 → ARY RidingSignalMessage
├── signing.js            ← Ed25519 密钥生成/签名/验签/篡改检测
├── chain-store.js        ← SHA256 哈希链读写/追加/完整性验证
├── file-hash.js          ← 项目目录文件快照哈希
├── identity-config.json  ← 身份字段假数据占位（等 ARY 服务端替换）
├── generate-samples.js   ← 用本地 Claude Code 数据生成标准样例
├── generate-signature-samples.js ← 生成签名样例集
├── public/               ← 前端界面（对话流/骑行统计/哈希链）
├── samples/              ← 生成的样例文件
└── deliverables/         ← 交付产物（见 handoff.manifest.json）
```

## 启动

```bash
# 安装（零外部依赖）
cd rider-client
npm install   # 实际上不需要，纯 Node.js 原生模块

# 启动中转代理（必须先启）
node proxy.js
# 或指定上游和项目目录：
# DCR_UPSTREAM_URL=https://api.deepseek.com/anthropic DCR_PROJECT_DIR=/path/to/project node proxy.js

# 启动用户端 UI
node server.js

# 然后：
# - 中转站面板: http://localhost:3738
# - 用户端界面: http://localhost:3737
# - Claude Code 配置: ANTHROPIC_BASE_URL=http://localhost:3738
```

## 数据流

```
Claude Code 发起请求
        │
        ▼
DCR Proxy 接收 (localhost:3738)
        │
        ├──→ 透明转发至上游 LLM API（Authorization 原样透传）
        │         │
        │         ▼
        │    上游返回响应
        │         │
        │         ▼
        ├──→ 提取元数据（模型/token/耗时/tool_calls）
        ├──→ 项目文件 SHA256 快照
        ├──→ 追加哈希链条目（prevHash + 本条 canonical JSON）
        │
        └──→ 响应返回给 Claude Code（骑手无感知）
```

## 交付产物

参见 `deliverables/a-rider/handoff.manifest.json`。10 项产物已全部就绪。

## 当前限制

| 项目 | 状态 | 说明 |
|------|------|------|
| 身份字段 | `__MOCK__` | `raceId`/`registrationId`/`caConnectionId` 等 ARY 服务端就绪后替换 |
| 上游格式 | Anthropic Messages API | 当前默认 DeepSeek Anthropic 兼容端点，改 `DCR_UPSTREAM_URL` 可切换 |
| 文件快照 | 依赖 Git 仓库 | 非 Git 目录退化为全目录扫描，性能略差 |
| 部署位置 | 骑手本机 | 后续中转站可迁移至云端，仅需改 Claude Code 的 `ANTHROPIC_BASE_URL` |
