# ARY Manage System 分工复核与补充建议

## 1. 结论

这份分工总体合理，核心边界基本清楚：它聚焦平台级 `Admin Console`、系统健康和内部维护，不直接接管单场赛事执行流程。作为小组拆分任务，它适合独立推进。

但从“后续要被整合成可运行产品”的角度看，当前文档还缺 4 类关键信息：

1. 和 `Organizer / Judge / Screen Console` 的最终边界还不够硬。
2. 发布态、可见性、人工重算这几类跨模块动作的权威归属没有封口。
3. 交付件偏“功能设计”，缺少集成时可直接接线的契约与最小可运行范围。
4. 页面、接口、权限、审计之间还没有形成统一的 DoD。

## 2. 合理之处

1. 平台级与赛事级操作分离得较清楚，符合 `docs/ary-mvp.prd.md` 和 `docs/ary-permission-matrix.md` 的方向。
2. 把 `Dashboard`、`Maintenance`、`Audit Log` 拆开是对的，便于逐步落地。
3. 对 `Projection` 和 `Report` 使用“查看 + 手动重算/重跑”的方式，和“Projection 不是事实源”的总口径一致。
4. 对 `Work.visibility`、`Profile visibility`、审计日志的强调是必要的，后续公开端能否安全上线取决于这里。

## 3. 主要缺口

### 3.1 角色边界仍有重叠

文档中多次出现 `Organizer`、`Admin`、`Screen Console` 的交叉描述，但没有形成最终裁定表。至少以下动作需要明确唯一 owner：

1. `Results` 的发布是谁点的。
2. `Review Summary` 的发布是谁点的。
3. `Work.visibility=hidden` 是仅 `Admin` 可做，还是 `Organizer` 也可做。
4. `Screen Display` 的模式切换由 `Admin Console`、`Screen Console` 还是外部 demo shell 控制。

### 3.2 缺少“集成可交付”定义

当前更像产品设计说明，不像工程交付约定。至少还缺：

1. 页面路由约定。
2. 最小接口 contract。
3. Mock data contract。
4. 每个模块交付给整合人的文件清单。

### 3.3 缺少最小闭环优先级

`M1` 到 `M5` 都写了，但没有说第一轮可运行产品只接哪一部分。若不收敛，管理系统很容易膨胀成“半个平台”。

### 3.4 缺少失败与降级口径

例如：

1. `Projection` 重算失败时前端看什么。
2. `Report` 未发布时公开端如何表现。
3. `CA` 健康异常时 Dashboard 如何标色、是否阻断操作。

## 4. 建议补充

### 4.1 新增一个边界裁定表

建议在后续正式版本中补一张表：

| 动作 | 唯一 owner | 可见方 | 备注 |
| --- | --- | --- | --- |
| 发布 Results | Organizer 或 Admin 二选一 | Public Site | 需要冻结 |
| 发布 Review | Organizer 或 Admin 二选一 | Public Site | 需要冻结 |
| 切换 Screen 模式 | Screen Console | Screen Display | 不建议放在 Public Site |
| 隐藏作品 | Admin | Public Site / Works | 必须记审计 |
| 手动重算 Projection | Admin | Live Hall / Screen | 不改事实数据 |

### 4.2 收敛第一轮交付范围

建议把第一轮管理系统实际交付压缩为：

1. 用户列表 / 角色变更。
2. Dashboard 只读总览。
3. Projection 状态查看。
4. Work 可见性切换。
5. 审计日志列表。

先不要把“完整配置中心”和“大量人工维护操作”作为第一轮必须项。

### 4.3 明确对外 contract

建议补充这些共享 contract：

1. `AdminUserSummary`
2. `DashboardOverview`
3. `ProjectionStatus`
4. `PublishedArtifactStatus`
5. `AuditLogEntry`

这样整合时可以先做页面和 mock，再替换真实数据源。

### 4.4 增加非功能要求

至少明确：

1. 敏感写操作都必须审计。
2. 所有列表接口要支持分页和筛选。
3. 人工操作必须返回可展示的 `reason` 与 `operator`。
4. 管理端错误态要能区分“无权限”“数据缺失”“下游失败”。

## 5. 对整合的直接影响

如果不先补足上面这些内容，整合阶段最容易卡在两处：

1. 前端展示端不知道什么内容已经“可公开”。
2. 控制台不知道哪些动作有权限做、做完由谁承担结果。

因此，这份分工可以继续保留，但建议把它视为“管理域功能草案”，不是“可直接接线的交付契约”。