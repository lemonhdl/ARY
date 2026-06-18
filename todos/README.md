# ARY 五人分工任务包

本文档包用于把 ARY 当前的文档基线、原型资产和前期复核结论，重组为一套可以直接分发给 5 个人分别落地实现的任务说明。

目标不是继续讨论职责，而是让每个人都能按统一输入、统一输出、统一交付路径独立实现，且第 5 人可以基于公共契约自动集成前 4 人的交付。

## 1. 使用方式

1. 先阅读本文。
2. 每位同学只读自己的分工文档和公共文档。
3. 所有人严格遵守公共文档中的字段、发布态、交付路径和 handoff 规范。
4. 第 5 人不直接改 1 到 4 人模块内部实现，只读取他们按规范输出的产物完成集成。
5. 默认采用“各改各目录”的 ownership 规则，避免多人在 `app/`、`scripts/`、`runtime-data/` 同时改同一批文件。

补充：本任务包已按“只分发 `todos/` 目录也能执行”的目标重写。原始 `tasks/` 文档中的详细有效内容，不再被当成摘要压缩，而是被完整保留并搬运进对应 `todos/01-04` 的主体；公共文档只额外补充共享契约、集成约束和交付规范。

## 2. 文件清单

### 2.1 五份个人分工文档

1. `01-A-Rider-Client.md`
2. `02-B-Admin-Publishing.md`
3. `03-C-Frontend-Shell.md`
4. `04-D-Authority-Mock-Data.md`
5. `05-E-Auto-Integration.md`

### 2.2 公共文档

1. `10-Shared-Field-Dictionary.md`
2. `11-Publication-Visibility-Rules.md`
3. `12-Authority-Mock-Data-Spec.md`
4. `13-Product-Shell-Adapter-Spec.md`
5. `14-Handoff-Manifest-Spec.md`
6. `15-Auto-Integration-Skeleton.md`
7. `16-Project-Baseline-Requirements.md`
8. `17-Original-Task-Coverage-Map.md`
9. `18-Architecture-Component-Diagram.md`
10. `19-Monorepo-Single-Machine-Web-Decision.md`
11. `20-Monorepo-Scaffold-And-Startup-Contract.md`

## 3. 总体分工原则

### 3.1 A 负责 Rider 客户端完整任务 + 统一交付

保留原始 Rider 客户端详细职责、边界、不做事项、防伪要求和依赖项，并额外交付可回放样例与 handoff。

### 3.2 B 负责管理系统完整任务 + 统一交付

保留原始管理系统的模块、页面、接口、权限和边界设计，并额外交付可被 C、D、E 消费的读取模型与治理样例。

### 3.3 C 负责前端展示完整任务 + 产品壳接线

保留原始前端展示模块的页面、数据需求、对接方式、推进记录和边界说明，并额外交付适配统一数据面的产品壳约束。

### 3.4 D 负责数据层完整任务 + 权威 mock 数据包

保留原始数据层文档中的生成器、数据库、产物、命令、不变量和对接说明，并额外交付第一轮统一权威 mock 与 handoff。

### 3.5 E 负责自动集成

E 不手工拼凑字段，不重写别人模块逻辑，而是严格按照公共契约读取 A、B、C、D 的 handoff 产物，完成自动校验、自动装配、自动回退和验收。

## 4. 统一交付路径

每位同学的实现最终都应向以下路径交付产物：

```text
deliverables/
├─ a-rider/
├─ b-admin/
├─ c-frontend/
├─ d-data/
└─ e-integration/
```

每个目录内必须包含 `handoff.manifest.json`，格式见 `14-Handoff-Manifest-Spec.md`。

目录 ownership 默认规则：

1. A 只改 `deliverables/a-rider/`。
2. B 只改 `deliverables/b-admin/`。
3. C 只改 `deliverables/c-frontend/`。
4. D 只改 `deliverables/d-data/`。
5. E 只改 `deliverables/e-integration/`，并负责 `app/`、`scripts/`、`runtime-data/` 的接线。
6. 1 到 4 人默认不直接改集成壳目录；如需新增共享规则，先改公共契约文档，不直接跨组改实现目录。

## 5. 当前推荐实施顺序

1. A、B、D 先产出最小 handoff 样例。
2. C 先把产品壳和 adapter 接口搭出来。
3. E 再读取 `deliverables/` 下各自产物自动装配。

## 6. 当前统一入口文档

如果实现过程中遇到边界冲突，以以下公共文档为准：

1. `10-Shared-Field-Dictionary.md`
2. `11-Publication-Visibility-Rules.md`
3. `12-Authority-Mock-Data-Spec.md`
4. `13-Product-Shell-Adapter-Spec.md`
5. `14-Handoff-Manifest-Spec.md`
6. `16-Project-Baseline-Requirements.md`
7. `18-Architecture-Component-Diagram.md`
8. `19-Monorepo-Single-Machine-Web-Decision.md`
9. `20-Monorepo-Scaffold-And-Startup-Contract.md`

如果需要确认 `todos/` 是否覆盖了原始 `tasks/` 分工，直接看 `17-Original-Task-Coverage-Map.md`。
如果需要快速给组员讲清组件关系、数据流和集成边界，直接看 `18-Architecture-Component-Diagram.md`。
如果需要统一实现和部署路线，直接看 `19-Monorepo-Single-Machine-Web-Decision.md`。
如果需要开始实际搭工程目录和启动命令，直接看 `20-Monorepo-Scaffold-And-Startup-Contract.md`。