# E 组任务：自动集成、自动校验与统一验收

## 1. 角色定位

你负责把前 4 人的交付自动集成成一个可运行产品原型。你的重点不是补写别人模块内部实现，而是建立一条稳定的自动装配链路：读取标准 handoff、校验契约、挂接产品壳、输出统一运行结果。

## 2. 你的输入

必须先读：

1. `todos/10-Shared-Field-Dictionary.md`
2. `todos/11-Publication-Visibility-Rules.md`
3. `todos/12-Authority-Mock-Data-Spec.md`
4. `todos/13-Product-Shell-Adapter-Spec.md`
5. `todos/14-Handoff-Manifest-Spec.md`
6. `tasks/ARY-delivery-reality-checklist.md`

执行骨架补充：`todos/15-Auto-Integration-Skeleton.md`

## 3. 自动集成原则

### 3.1 不手工拼字段

你不能在集成时重新发明字段；只能读公共契约和别人按契约输出的 handoff。

### 3.2 不直接改别人模块内部实现

如果某组交付不合规，你的职责是：

1. 在校验中报错
2. 输出缺口清单
3. 使用 fallback 继续构建第一轮产品

而不是直接侵入式重写对方内部逻辑。

### 3.3 自动优先，手工兜底最少化

你必须让集成依赖：

1. `deliverables/*/handoff.manifest.json`
2. 公共字段字典
3. 公共发布态与可见性规则
4. 权威 mock 数据规范

## 4. 你的输出

你必须在 `deliverables/e-integration/` 下交出以下产物：

1. `handoff.manifest.json`
2. `integration-readme.md`
3. `assembly-plan.md`
4. `compatibility-report.md`
5. `fallback-report.md`
6. `acceptance-checklist.md`

如果你实现了脚本或集成工程，放在：

`deliverables/e-integration/assembly/`

## 5. 自动集成必须支持的输入

### 5.1 从 A 读取

1. `riding-events.sample.json`
2. `ca-status.sample.json`
3. `signature-samples.json`

### 5.2 从 B 读取

1. `dashboard-overview.sample.json`
2. `projection-status.sample.json`
3. `published-artifacts.sample.json`
4. `audit-log.sample.json`

### 5.3 从 C 读取

1. `route-map.json`
2. `page-dependencies.json`
3. `adapter-contract.md`

### 5.4 从 D 读取

1. `authority-mock.json`
2. `authority-mock.schema.md`

## 6. 自动集成必须完成的动作

具体阶段划分、目录树、失败分级和伪代码骨架，以 `todos/15-Auto-Integration-Skeleton.md` 为执行补充。

### 6.1 自动发现

扫描 `deliverables/` 下 A 到 D 的 `handoff.manifest.json`。

### 6.2 自动校验

检查：

1. 文件是否存在
2. 版本是否匹配
3. 是否符合公共字段字典
4. 是否违反发布态与可见性规则

### 6.3 自动装配

按以下顺序装配：

1. 读 D 的 `authority-mock.json` 作为主数据面
2. 用 B 的发布与管理端样例补充管理侧和公开判断
3. 用 A 的事件样例补充 Live Hall / CA 状态回放输入
4. 按 C 的 adapter contract 把数据挂到产品壳

### 6.4 自动回退

如果某一组输入缺失：

1. 优先使用 D 的主 mock
2. 保留缺口说明
3. 不允许直接让产品壳崩溃

## 7. 必做范围

1. 自动发现 handoff
2. 自动校验契约
3. 自动装配统一数据
4. 自动生成兼容性报告
5. 自动生成 fallback 报告

## 8. 不做范围

1. 不手工维护第二份权威 mock
2. 不在集成层发明新的页面字段
3. 不在集成层重写发布规则

## 9. 验收标准

满足以下条件即算完成：

1. 只要 A 到 D 按文档交付，E 能自动发现并读取。
2. 任意一组缺少部分输入时，E 能给出明确兼容性和 fallback 报告。
3. 最终能产出一套可运行产品原型的装配说明。
4. 不需要 E 手工逐页改字段映射。

## 10. 你必须产出的报告

### 10.1 `compatibility-report.md`

逐项说明 A 到 D 哪些输入：

1. 完全兼容
2. 部分兼容
3. 不兼容

### 10.2 `fallback-report.md`

逐项说明：

1. 哪些地方使用了主 mock 兜底
2. 哪些地方缺少上游样例
3. 是否影响最终演示路径

### 10.3 `acceptance-checklist.md`

至少覆盖：

1. 首页能看到赛事
2. 进入 Race Page
3. 进入 Live Hall
4. 看到公开 Works
5. 看到已发布 Results
6. 看到已发布 Review
7. 看到公开 Rider Profile
8. 管理端能看到 dashboard 摘要

## 11. handoff 特别要求

你的 manifest 必须声明：

1. 支持读取的上游 handoff 版本
2. 自动装配顺序
3. fallback 策略
4. 产出的兼容性报告和验收报告路径