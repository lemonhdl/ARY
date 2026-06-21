# 2026-06-20 Session 02 — One API 集成 + 复审修复 + 架构完善

## Prompt

**时间**：2026-06-20 ~ 2026-06-21

1. "去把 Ary 的 GitHub 仓库里的新内容拉取下来，然后看一下这个文档C:\Users\ROG\Desktop\se\a-rider-review-2026-06-20.md,这是我同事发给我的，他想表达什么？他自己好像也说不清"
2. "他也是拿 Agent 看的，不一定靠谱。你去检查一下实际的实现是不是这回事"
3. "样例数据不脱敏有什么关系吗？反正实际部署的时候用的是真实的数据"
4. "关于 Coding Agent 的问题,我们现在套用的是 One API 吧,我们完全可以支持 oneAPI 支持的所有格式吧"
5. "我们全部对接这个格式可以吗?"
6. "我们应该在 DCR 的中转站源码中加一个第三方库，把 oneAPI 下载下来"
7. "我们现在要做一个面向未来的平台...我们做成依赖 oneAPI 的形式，并且自己保有主要的能力"
8. "将 OneAPI 放入中转站的第三方库中，在中转站启动时自动启动这个 OneAPI"
9. "它就相当于一个单文件程序，跟 DCR 的 proxy.js 一样——本地跑就行"
10. "那你去装一个 Go，你试一下"
11. "为我们 DCR 中转站做一个保底，如果 one API不在线且请求不是本地支持的格式就直接保存所有的信息"
12. "我现在明确要求你立刻将中转站和骑手客户端的代码分离"
13. "简单点说，客户端的缓存可以写在当前项目内，但是中转站的文件应该完全放在中转站的文件夹内"
14. "我们现在来确认一下：用户如何在一个指定的路径下启动我们的客户端...我们应该区分好两场比赛的哈希链"
15. "对，提交框不应该让人随便填路径。项目是配置里写死的"
16. "怎么只有 agent 信息，没有 rider 信息"
17. "我要的就是储存对话...rider 一句，agent 一句的回复"
18. "把我们本地的源码集成到 deliverable 内"
19. "写一下 README，介绍架构"
20. 多次重启、调试、验证

## Agent Answer

### 阶段一：复审报告核实

同事复审指出 3 个问题，逐条对账：
- register-handshake.contract.json 密钥模型矛盾 → ✅ 真实，clientPublicKey + serverPublicKey + signingPrivateKey 三字段分属两套模型
- session-fetch.contract.json caType 范围过大 → ✅ 铁证
- 样例数据未脱敏 → ✅ 真实

### 阶段二：格式架构设计

调研 One API（songquanpeng/one-api，Go 编写，MIT 开源）：
- 40+ 供应商适配器，均转换到 OpenAI Chat Completions 格式
- Anthropic adapter 内含 Anthropic↔OpenAI 双向转换

用户决策架构：
```
Agent → DCR (透明转发) → 上游 LLM
         │
         └→ One API /v1/convert → OpenAI 格式 → 存储
```

### 阶段三：One API 编译与修改

- 安装 Go 1.24.5（golang.google.cn 镜像）
- 编译 One API，发现两个问题：
  1. tiktoken 下载被墙 → 改 `FatalLog` 为 `SysLog` + 近似计数降级
  2. Go HTTP Client 无超时 → 加 `http.DefaultClient.Timeout = 10s`
- 新增 `/v1/convert` 端点（`controller/convert.go`）——自动检测 Anthropic/OpenAI 格式，转换为 OpenAI 返回
- Go embed `web/build/default` 前端目录 → 修复空页面问题

### 阶段四：代码分离

将中转站和骑手端彻底分离：

**dcr-proxy/**（中转站）：
- proxy.js — 透明转发 + 格式检测 + 多用户隔离
- format-adapter.js — Anthropic↔OpenAI
- one-api-launcher.js — 自动启动 One API，等待就绪，生命周期管理
- vendor/one-api.exe — 本地编译的 One API 二进制
- data/ — 自包含数据目录（sessions/submissions/config）

**rider-client/**（骑手端）：
- server.js — UI 服务，查询中转站状态
- public/ — 前端界面
- message-builder.js — 链消息构建（骑手+Agent双条目）

### 阶段五：多用户多项目隔离

- 链键 = SHA256(Auth) + SHA256(projectDir)
- 不同用户/不同项目 → 不同链
- 禁止嵌套监测 → RESTRICTIONS.md

### 阶段六：三层保底

| 场景 | 处理 |
|------|------|
| One API 在线 + 已知格式 | /v1/convert 转换 |
| One API 离线 + 已知格式 | format-adapter 本地转换 |
| 未知格式 | 原始数据 + _rawReason 存储 |

### 阶段七：复审修复

1. register-handshake.contract.json — 移除 clientPublicKey，统一为服务端生成密钥
2. session-fetch.contract.json — caType 收窄为 claude_code | codex
3. 样例脱敏 — 全部路径/Prompt/SessionID 替换为 __MOCK__
4. replay-readme.md — 补 fixture 占位对照表

### 阶段八：UI 修复

- 左边栏加骑手信息卡（项目/记录链/总Token）
- 对话显示同时展示骑手 Prompt 和 Agent 回复
- 提交按钮锁定项目路径（不可随便填）
- 在线/离线检测：直连中转站状态

### 阶段九：README + 源码交付

- 完整 README：架构 → 防伪 → 格式兼容性 → 使用
- One API 源码进入 deliverables/a-rider/one-api-source/
- 所有最新源码同步到 deliverables/a-rider/

### 关键文件

| 文件 | 位置 |
|------|------|
| 中转站 | `se/dcr-proxy/` + `deliverables/a-rider/proxy-source/` |
| 骑手端 | `se/rider-client/` + `deliverables/a-rider/client-source/` |
| One API 源码 | `se/one-api/` + `deliverables/a-rider/one-api-source/` |
| One API 二进制 | `se/dcr-proxy/vendor/one-api.exe` |
| Go 编译器 | `/c/tools/go/` |
| README | `deliverables/a-rider/README.md` |

### 架构总结

```
Agent → DCR (:3738) → 上游 LLM         转发层：原样透传
         │
         ├─ One API /v1/convert         转换层：任意→OpenAI
         ├─ SHA256 哈希链               防伪层：增删改即断
         ├─ 文件快照                    提交层：对账验证
         └─ data/sessions/              存储层：持久化对话

DCR UI (:3737) ← 读链条目               展示层：骑行数据
```

## Steering

- 用户明确：转发层不做任何修改，Agent 完全无感
- 用户要求：中转站数据全部在自包含目录，不依赖 home 目录
- 用户决策：集成 One API 作为格式转换引擎，DCR 保有核心能力
- 用户强调：未来国模厂商自研 Agent → One API 不死则兼容性持续增长
- 用户要求：代码分离，中转站和骑手端独立部署
