# DCR + One API — 格式能力继承

## 架构

```
Agent → DCR (:3738) → One API (:3000) → 上游 LLM
         ↑                ↑
    透明代理+记录      格式网关
    链+快照+签名      几十种格式转换
```

DCR 通过 HTTP 指向 One API 作为上游，**自动继承 One API 支持的全部格式**。

One API 升级 → DCR 自动获得新格式支持，零代码改动。

## DCR 自身保留的能力（永远不依赖 One API）

- 透明转发（Authorization 原样透传）
- SHA256 哈希链 + 完整性验证
- 项目文件快照 + 提交验证
- Ed25519 签名
- 多用户/多项目隔离
- Anthropic / OpenAI 格式检测
- 原始请求/响应零修改

## 启动

```bash
# 1. One API
docker run -d --name one-api -p 3000:3000 -v ~/one-api-data:/data justsong/one-api
# 默认账号 root / 123456，打开 http://localhost:3000 配置渠道和 Key

# 2. DCR
cd dcr-proxy
DCR_UPSTREAM_URL=http://localhost:3000 node proxy.js
```

DCR 启动时会检测 One API 是否在线，并在控制台报告当前格式能力范围。

## 上游指向其他端点时

如果 `DCR_UPSTREAM_URL` 指向的不是 One API（比如直接指向 DeepSeek），DCR 使用内置格式检测（Anthropic / OpenAI）。

## 原理

One API 是 MIT 开源的 Go 项目（github.com/songquanpeng/one-api）。它接受 OpenAI 格式请求，通过适配层转换为各供应商原生格式后转发，响应逆向转回。

DCR 不内嵌 One API（语言不同），而是通过 HTTP 协议对接。One API 在本地或同网络内运行即可，对 Agent 和应用完全透明。
