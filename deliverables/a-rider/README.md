# DCR Desktop App — Rider 客户端 + 中转站

## 架构

ARY 通过**客户端-中转站两级机制**实现对 Agent 开发过程的完整记录和防伪验证。

```
                         Rider 本机
                    ┌──────────────────────────────────────────────┐
                    │                                              │
  Coding Agent ──→ DCR Proxy (:3738) ──→ One API ──→ 上游 LLM      │
  (Claude Code)      │     ↑                ↑                      │
                     │     │                │                      │
                     │   哈希链 + 快照    格式统一转换              │
                     │   签名 + 隔离      (任意→OpenAI)             │
                     │     │                                       │
                     │     └── 持久化存储 ──→ data/sessions/        │
                     │                                              │
  DCR UI (:3737) ←── 读链条目                                       │
   骑手面板                                              │
                    └──────────────────────────────────────────────┘
```

### 两级机制

| 层级 | 组件 | 端口 | 职责 |
|------|------|------|------|
| **中转站** | DCR Proxy + One API | 3738 / 3000 | 透明转发、记录对话、计算哈希链、格式统一转换 |
| **客户端** | DCR UI | 3737 | 展示骑行数据、项目配置、提交验证、链完整性检查 |

### 数据流

```
Agent 发出请求
  │
  ├─→ DCR 原样转发到上游 LLM（对 Agent 完全透明）
  │
  └─→ DCR 调用 One API /v1/convert 转为 OpenAI 格式 → 存入链条目
        │
        ├─ SHA256 哈希链（增删改任一条全链断裂）
        ├─ 项目文件快照（每轮对话后立刻计算）
        ├─ Ed25519 签名（每条消息可验）
        └─ 多用户 / 多项目隔离
```

## 防伪机制

**立刻计算，不留时间窗口。**

每轮 Agent 对话结束后，DCR 立刻对项目文件做 SHA256 快照，与对话记录一起写入哈希链。增、删、改任何一条记录，后续所有哈希全部断裂。用户无法在对话结束后替换文件或修改记录——哈希链已经咬合，任何改动立即可检测。

**提交验证：**

项目提交时，DCR 对全部文件重新计算快照，与链条目中记录的快照对账：
- 匹配 → 文件未被偷换，接受提交
- 不匹配 → 哈希链断裂，拒绝提交

## 格式兼容性

### One API 集成

DCR 集成了 [One API](https://github.com/songquanpeng/one-api)（MIT 开源），作为格式统一转换引擎：

- 任意 Agent 格式 → OpenAI Chat Completions 格式统一存储
- 内置 Anthropic / OpenAI 双向转换能力
- One API 在线时，继承其全部格式能力（40+ 供应商适配器）
- One API 离线时，内置 format-adapter 保证核心格式可用

### 未来拓展性

未来国产大模型厂商自研 Agent 和 Coding 工具出现时，只要 One API 社区适配了相应格式，DCR 自动获得支持能力。**One API 不死，DCR 的兼容性就持续增长。**

### 保底机制

| 场景 | 处理 |
|------|------|
| One API 在线 + 已知格式 | One API /v1/convert 转换 → OpenAI 存储 |
| One API 离线 + 已知格式 | 内置 format-adapter 转换 |
| 未知格式 | 原始数据存储，标记异常原因 |

## 项目结构

```
deliverables/a-rider/
├── client-source/              ← 骑手端源码 (Node.js)
│   ├── server.js               ← UI 服务 (:3737)
│   ├── message-builder.js      ← 消息构造
│   ├── signing.js              ← Ed25519 签名
│   └── public/                 ← 前端界面
│
├── proxy-source/               ← 中转站源码 (Node.js)
│   ├── proxy.js                ← 透明代理 (:3738)
│   ├── format-adapter.js       ← 格式转换
│   ├── chain-store.js          ← 哈希链存储
│   ├── file-hash.js            ← 文件快照 + 提交
│   ├── one-api-launcher.js     ← One API 自动启动
│   ├── one-api-integration.md  ← One API 集成说明
│   └── RESTRICTIONS.md         ← 使用限制
│
├── one-api-source/             ← One API 源码 (Go, MIT)
│   ├── main.go                 ← 入口（含 /v1/convert 端点）
│   ├── controller/convert.go   ← 格式转换端点
│   └── relay/adaptor/          ← 40+ 供应商适配器
│
├── register-handshake.contract.json
├── session-fetch.contract.json
├── riding-events.sample.json
├── ca-status.sample.json
├── signature-samples.json
├── error-codes.md
├── protocol-summary.md
├── replay-readme.md
└── handoff.manifest.json
```

## 使用

### 前置依赖

- Node.js 24+
- Go 1.24+（编译 One API）
- Git（项目文件追踪）

### 启动

```bash
# 1. 编译 One API（首次）
cd one-api-source
go build -o one-api.exe .
cp one-api.exe ../proxy-source/vendor/

# 2. 启动中转站（自动拉起 One API）
cd ../proxy-source
DCR_UPSTREAM_URL=https://api.deepseek.com/anthropic node proxy.js

# 3. 启动骑手端
cd ../client-source
node server.js

# 4. 配置 Claude Code
# 在 Claude Code 的 settings.json 中：
# "ANTHROPIC_BASE_URL": "http://localhost:3738"
```

### 面板

| 面板 | 地址 | 用途 |
|------|------|------|
| 骑手端 | `http://localhost:3737` | 查看骑行数据、提交项目、配置 |
| 中转站 | `http://localhost:3738` | 监控请求、链完整性、多用户状态 |
| One API | `http://localhost:3000` | 渠道管理、Key 配置（root/123456） |

### 多项目 / 多用户

- 每场比赛设置独立 `DCR_PROJECT_DIR`
- 中转站按 `用户哈希 + 项目路径哈希` 隔离链条
- **禁止嵌套监测**（A 套 B 同时监测 → 文件快照冲突），详见 `proxy-source/RESTRICTIONS.md`

### 提交项目

1. 在骑手端左侧配置项目目录
2. 点「提交验证」
3. 中转站对全项目文件做快照，与哈希链对账
4. 匹配则接受，文件存储在 `data/submissions/`

## 当前限制

| 项目 | 状态 |
|------|------|
| W1/W2/W3 服务端通信 | 契约已定，等 ARY 服务端 API 就绪 |
| 身份字段 | `__MOCK__` 占位，等服务端分配 |
| Ed25519 密钥 | 本地演示密钥，服务端就绪后替换 |
| One API 渠道 | 需用户自行配置 LLM API Key |
