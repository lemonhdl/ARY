# 原始任务覆盖映射

本文用于回答一个问题：`todos/` 是否覆盖了 `tasks/` 下原始四份分工文档的职责，并且是否保留了原始文档本身的详细价值。

## 1. 结论

经过本轮重构后，`todos/` 的目标是：

1. 保留原始四份任务的完整职责范围和关键细节。
2. 不再用“执行摘要”替代原始正文，而是把原始详细内容并入对应 `todos/01-04` 的主体。
3. 仅把共享契约、交付格式和自动集成约束作为追加层。
4. 让只拿到 `todos/` 的人也能读到足够详细的原始任务语义。

## 2. 覆盖映射

### A Rider 客户端

原始范围：

1. 登记与握手
2. 实时 push
3. Session 快照 fetch
4. 幂等与防重放
5. 失败上报
6. 身份字段
7. 数据边界
8. 赛后防伪造
9. 消息签名

`todos/01-A-Rider-Client.md` 覆盖方式：

1. 保留原始 9 项工作、签名防伪决策、系统边界、14 项不做事项、9 项依赖和审查清单。
2. 追加 handoff、样例文件、回放和自动集成要求。

### B 管理系统

原始范围：

1. 账号与角色管理
2. 资料补全总览
3. System Dashboard
4. Internal Maintenance
5. System Config
6. Audit Log

`todos/02-B-Admin-Publishing.md` 覆盖方式：

1. 保留原始 Admin Console、Dashboard、Maintenance、Config、Audit、权限模型和接口草案。
2. 追加发布治理、读取模型样例和 handoff 要求。

### C 前端展示

原始范围：

1. Home / Race Gallery
2. Race Page
3. Live Hall
4. Works / Work Page
5. Results
6. Review
7. Rider Profile
8. Cooperation
9. Screen Display

`todos/03-C-Frontend-Shell.md` 覆盖方式：

1. 保留原始页面范围、功能清单、对接说明、模块边界、独立推进方式和推进记录。
2. 追加 adapter、fallback、route 和 handoff 规范。

### D 数据层

原始范围：

1. 确定性全量数据生成
2. PostgreSQL 生命周期管理
3. schema / seed / export 产物
4. 前端兼容导出
5. 验证与不变量检查

`todos/04-D-Authority-Mock-Data.md` 覆盖方式：

1. 保留原始数据层的数据库、生成器、产物、命令、不变量和对接细节。
2. 追加 authority mock 主文件和 handoff 规范。

## 3. 约束

约束不再是“用摘要替代原始正文”，而是：

1. `todos/01-04` 的主体必须保留原始任务的详细语义。
2. 集成友好要求只能作为附加层，不能反向删减原任务。
3. 第一轮实现可以分阶段，但任务文档本身不能降格成提纲。