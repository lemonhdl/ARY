# ARY Rider 客户端（DCR Desktop App）— 工作范围 & 不做事项

版本：v0.3
状态：待审查
读者：产品、架构、研发、QA（用于审查工作拆解是否完整、是否有遗漏）

---

# 1. 我做的是什么

DCR Desktop App——运行在骑手本地的**桌面客户端**。它是 Claude Code 与 ARY 赛事平台之间的唯一数据上报通道，负责从用户本地的 Claude Code 提取骑行信息、签名、上报到 ARY 服务端。

只支持 Claude Code。

# 2. 我做什么（9 项）

| # | 工作项 | 一句话说明 |
|---|--------|-----------|
| W1 | **CAConnection 登记与握手** | Rider 在参赛过程中将 Claude Code 会话登记到 ARY，完成身份握手，拿到 `caConnectionId` |
| W2 | **骑行信号实时 push** | 将 Claude Code 骑行过程中的关键事件推送到 ARY 服务端 |
| W3 | **Session 快照 HTTP fetch 接口** | 暴露 HTTP 端点，供 ARY 服务端按需拉取完整 Session 数据 |
| W4 | **消息幂等与防重放** | 每条 push 消息携带 `messageId`、`idempotencyKey`、递增 `sequence` |
| W5 | **接入失败上报** | CAConnection 接入异常时主动 push 失败消息（含 `statusReason`），不隐瞒 |
| W6 | **身份字段携带** | 每条消息带齐 `registrationId`、`raceProjectId`、`caConnectionId` 等身份字段 |
| W7 | **数据边界控制** | 不把 GitHub Repo 伪装成骑行数据，不在公开端暴露原始 Session |
| W8 | **赛后防伪造** | 不接受赛后手动上传 Session Summary 充当实时骑行证据 |
| W9 | **消息防伪与防篡改** | 每条 push 消息做完整性签名，确保 ARY 收到的消息来自真实 CA 且未被篡改 |

# 3. 防伪 & 防篡改机制

用户新增要求：**消息必须来自真实 CA（通过 DCR Desktop App），未被伪造、未被篡改。**

## 3.1 设计决策

| 决策点 | 结论 | 状态 |
|--------|------|------|
| 签名机制 | 待定（Ed25519 / ECDSA / HMAC 等方案待讨论） | **需讨论** |
| 密钥生成位置 | ARY 服务端生成。用户每次登录，服务端生成当次密钥 | ✅ 已定 |
| 密钥下发与保管 | 登录后由服务端下发至 DCR Desktop App；客户端负责本次会话期间的保管 | ✅ 已定 |
| 签名范围 | 整个消息体（签名覆盖 JSON 全文，任一字段被修改都会导致验签失败） | ✅ 已定 |
| 签名执行者 | DCR Desktop App（即我们做的客户端本身） | ✅ 已定 |
| 验签执行者 | ARY 服务端 | ✅ 已定 |

## 3.2 流程

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

## 3.3 待讨论

| # | 问题 |
|---|------|
| Q1 | 签名算法选哪个？（Ed25519 性能好体量小；ECDSA 生态兼容广；HMAC 需共享密钥但更快） |
| Q2 | 签名放在消息的哪个字段？JSON 内嵌（如 `signature` 字段）还是 HTTP Header？ |
| Q3 | 私钥在客户端存储的安全策略：仅内存？加密落盘？本次会话结束后是否销毁？ |
| Q4 | 若 DCR Desktop App 被关闭重启，是否需要重新登录拿新密钥？ |
| Q5 | fetch 返回的 Session 快照是否也需要签名？还是仅 push 消息需要？ |
| Q6 | 签名失败或验签失败时的降级策略：消息丢弃？重试？告警？进入隔离审计？ |

# 4. 系统边界

```text
┌────────────────────────────────────────────────────────────────┐
│                      DCR Desktop App（我做）                     │
│                                                                │
│  Claude Code                    ARY 服务端（别人做）             │
│      │                              │                          │
│      ▼                              │                          │
│  ┌─────────┐   ①登录(GitHub)        │                          │
│  │ 采集    │ ─────────────────────► │                          │
│  │ 骑行数据 │   ②下发私钥 ◄───────── │ 生成密钥对                │
│  │         │                        │                          │
│  │ 构造    │   ③登记/握手            │                          │
│  │ JSON    │ ◄────────────────────► │                          │
│  │         │                        │                          │
│  │ 签名    │   ④push 签名后消息       │                          │
│  │ (私钥)  │ ─────────────────────► │ 验签(公钥)                │
│  │         │                        │ → 验签通过：进入后续链路    │
│  │         │   ⑤HTTP fetch ◄──────── │ → 验签失败：拒收/告警      │
│  │         │   拉取快照               │                          │
│  └─────────┘                        │                          │
│                                      │                          │
│  我做的事：                          别人做的事：                 │
│  · 登录认证                           · 生成/保管密钥对            │
│  · 接收并保管私钥                      · 验签每一条消息             │
│  · 采集骑行信号                        · 验签失败处理              │
│  · 构造 push 消息                      · 接收 & 校验消息            │
│  · 对整个消息体签名                     · 幂等去重                  │
│  · 暴露 fetch 端点                     · 归属校验                  │
│  · 生成幂等键/序列号                    · Projection 生成            │
│  · 上报失败状态                         · Evidence 生成              │
│  · 保证数据真实                         · 评审前风险提示              │
│                                       · Award / Report 生成        │
│                                       · 权限校验                   │
└────────────────────────────────────────────────────────────────┘
```

# 5. 我不做什么（14 项）

| # | 不做事项 | 来源 |
|---|---------|------|
| N1 | **不支持 Codex** | 用户决策：只做 Claude Code |
| N2 | **不支持其他 CA（`other`）** | 用户决策：`other` 枚举预留，本次不实现 |
| N3 | **不做 Session 完整数据的定期 push** | `ary-ca-integration-spec.md` §5.1：完整快照走 HTTP fetch |
| N4 | **不做定时进度推送** | `ary-ca-integration-spec.md` §5.3：`task_progress` 不用于定期进度推送 |
| N5 | **不接收赛后上传的 Session Summary** | `ary-mvp.prd.md` §7.4 |
| N6 | **不把 GitHub Repo 当作 CA 数据源** | `ary-ca-integration-spec.md` §1 |
| N7 | **不写 ARY 业务对象** | `ary-ca-integration-spec.md` §2：CA 只提供原始信号 |
| N8 | **不暴露原始 CA Session 给公开端** | `ary-permission-matrix.md` §3.3 |
| N9 | **不处理 CA 接入失败导致的参赛资格变更** | `registration-ca-rules-alignment.taskbook.md` §3.3 |
| N10 | **不在赛事冻结窗口放宽数据校验** | `ary-release-ops-plan.md` §6 |
| N11 | **不做多 CA 标准化协议** | `ary.plan.md` DEV-5 |
| N12 | **不做反作弊系统** | `registration-ca-rules-alignment.taskbook.md` §5 |
| N13 | **不做 Team 参赛** | `ary-mvp.prd.md` §4 |
| N14 | **不做组织/学校租户** | `ary-domain-analysis.v0.3.md` §2.2 |

> N1、N2 来源为用户决策，其余 12 条来源均为文档原文。

# 6. 对上/下游的依赖

| # | 依赖方 | 我需要对方提供 | 状态 |
|---|--------|--------------|------|
| D1 | ARY 服务端 | CAConnection 登记与握手 API（返回 `caConnectionId`） | 待确认 |
| D2 | ARY 服务端 | push 消息接收端点 | 待确认 |
| D3 | ARY 服务端 | 选手的 `registrationId`、`raceProjectId` | 待确认 |
| D4 | ARY 服务端 | fetch 触发时机和端点约定 | 待确认 |
| D5 | ARY 服务端 | 消息格式确认（`RidingSignalMessage` schema） | 已草案 |
| D6 | 产品/赛事 | `raceId`、`taskId` 分配规则 | 待确认 |
| D7 | 产品/赛事 | CAConnection 新增窗口截止规则 | 已定义待落地 |
| D8 | ARY 服务端 | **登录后下发签名私钥的接口** | **新增，需讨论** |
| D9 | ARY 服务端 | **消息签名方案确认（算法、签名格式、验签端点约定）** | **新增，需讨论** |

# 7. 审查检查清单

- [ ] 上述 **9 项工作**是否覆盖了 Rider 客户端全部职责？
- [ ] 14 项不做事项中，有没有**不应列入**的？有没有**遗漏**的？
- [ ] 边界划分是否正确？
- [ ] 只支持 Claude Code 是否可行？
- [ ] **防伪防篡改（W9 + §3）的设计决策是否认可？待讨论的 6 个问题（Q1-Q6）是否覆盖了所有待定项？**
- [ ] 9 项依赖是否完整？D8、D9 涉及服务端配合，是否与服务端对齐？
- [ ] 有没有其他角色或模块的工作与我重叠或冲突？
- [ ] 现有文档基线未覆盖防伪防篡改要求（`ary-ca-integration-spec.md` 等文档中无签名/验签内容），是否需要同步更新这些文档？
