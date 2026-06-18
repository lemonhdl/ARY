# 项目基线要求

本文是给 A、B、C、D、E 五组的自包含项目基线摘要。即使不再翻 `tasks/` 或 `docs/`，也应至少遵守本文。

## 1. 产品与页面基线

第一轮产品必须围绕以下页面和体验闭环组织：

1. Home / Race Gallery
2. Race Page
3. Live Hall
4. Works / Work Page
5. Results
6. Review
7. Rider Profile
8. Cooperation
9. Admin / Race Console 基础入口
10. Screen Display

## 2. 关键业务基线

### 2.1 公开端基线

1. 必须保持 Gallery-first。
2. Public 只能看已公开、已发布资源。
3. 未发布 Results / Review / Report 不进入 Public Site。
4. 原始 CA Session 默认永不公开。

### 2.2 账号与角色基线

1. MVP 需要 GitHub 登录。
2. 需要资料补全。
3. 需要 `User.roles` 维护。
4. 不同角色要能看到不同入口。

### 2.3 作品与评审基线

1. 必须支持 Work 创建、提交和可见性控制。
2. 必须支持 Results 与 Review 的发布态区分。
3. 必须支持 Rider Profile 的公开档案与隐藏控制。

### 2.4 CA 与 Projection 基线

1. 只接受已登记、已握手且归属正确的 CAConnection 数据。
2. CA failed / not_configured 不直接阻断参赛，但要形成风险提示。
3. Projection 只用于过程展示，不是最终事实源。
4. Projection 失败不污染事实数据。

## 3. 第一轮必须能 demo 的路径

1. 首页看到赛事。
2. 进入 Race Page。
3. 进入 Live Hall。
4. 查看公开 Works。
5. 查看已发布 Results。
6. 查看已发布 Review。
7. 查看公开 Rider Profile。
8. 管理端看到 dashboard 摘要、用户角色、作品可见性和 Projection 状态。

## 4. 第一轮允许收缩但不能丢失的范围

以下能力允许按 P0 / P1 分阶段实现，但不得从任务里消失：

1. Rider 客户端的握手、push、fetch、签名、防重放。
2. 管理端的用户角色、资料补全、Dashboard、Maintenance、Audit、最小配置。
3. 数据层的权威 mock、前端导出、确定性生成、生命周期管理。
4. 前端展示的 Cooperation、Work Page、Screen 多模式与可见性过滤。

## 5. 统一执行原则

1. A、B、C、D 都必须交给 E 可自动读取的 handoff。
2. D 的权威 mock 是第一轮主数据源。
3. C 的页面层只能读 adapter 输出。
4. E 不得手工拼字段，不得偷放未发布内容进公开端。

## 6. 实现与部署基线

为了让第一轮实现、集成和部署尽量简单，默认采用以下技术路线：

1. 整体采用 monorepo。
2. 部署形态优先收口为单机 Web 应用，而不是多服务系统。
3. 前端优先使用原生 HTML、CSS、JavaScript ES Modules。
4. 后端优先使用 Node.js 原生能力，不默认引入重型框架。
5. 第一轮运行态优先读 D 的 `authority-mock.json` 或简单文件存储，不把数据库作为部署前置条件。
6. E 的自动集成优先实现为仓库内脚本或同进程模块，而不是独立部署服务。
7. 除非确有必要，不要引入额外第三方依赖。