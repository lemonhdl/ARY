# ARY 四组交付的集成建议

## 1. 当前判断

四份分工文档方向上基本成立，但还没有到“拿来直接拼接就能跑”的程度。当前最大的集成风险不是功能缺失，而是共享契约和交付形态没有冻结。

结合仓库现状，建议把整合目标拆成两层：

1. 第一层：做出一个可运行、可演示、可替换数据源的产品壳。
2. 第二层：逐步把各组真实交付替换进这个壳里。

这比等所有人都“各自做完”后再集中拼接更可靠。

## 2. 最方便可靠的集成原则

建议采用 `contract-first + mock-first + adapter-first` 的方式。

### 2.1 contract-first

先冻结共享对象，不先冻结页面或数据库实现。第一轮至少冻结这些对象：

1. `RaceSummary`
2. `LiveProjectionView`
3. `PublishedWorkView`
4. `PublishedResultView`
5. `PublishedReviewView`
6. `PublicRiderProfileView`
7. `CAConnectionStatusView`
8. `DashboardOverview`

### 2.2 mock-first

在没有完整后端之前，所有页面都先消费一份统一 mock 数据，不允许每个模块各自维护一套字段近似但不兼容的数据。

### 2.3 adapter-first

展示层永远只读 adapter 输出；真实数据库、原型 JSON、回放数据都通过 adapter 转成统一 view model。这样后续替换数据源时不会把页面打碎。

## 3. 建议的集成交付形态

在当前仓库条件下，建议先形成以下 5 类共享交付：

### 3.1 一份统一运行壳

第一轮不追求完整技术栈，先有一个能跑的产品壳即可。当前最稳妥的做法是继续基于 `design-prototype/` 做产品壳，把它当作：

1. 公开展示端入口。
2. Live Hall 和 Screen Display 的演示壳。
3. 后续接入真实数据 adapter 的容器。

### 3.2 一份统一 mock 数据

建议在整合阶段只认一份权威 mock 数据，至少覆盖：

1. races
2. live projections
3. works
4. awards/results
5. reviews
6. profiles
7. admin dashboard summary
8. ca connection health

### 3.3 一份共享字段字典

不要只在长文里描述，应该有一个独立表明确：

1. 字段名
2. 类型
3. 来源方
4. 是否 P0 必需
5. 是否允许为空
6. 是否可公开

### 3.4 一份发布态与可见性规则

至少冻结：

1. 什么叫 published result。
2. 什么叫 published review。
3. 什么 Work 可以进公开端。
4. 什么 Rider 信息可以公开。
5. 什么数据只能进管理端，不能进展示端。

### 3.5 一份联调样例包

建议每组至少交给整合人：

1. 3 到 5 条真实或仿真的输入样例。
2. 1 份期望输出样例。
3. 1 份失败样例。
4. 1 份字段解释。

## 4. 推荐集成顺序

### 第 1 步：冻结共享 contract

先不开大规模代码集成，先把共享 view model 和状态枚举定稿。这里如果不先定，后面所有接线都不稳。

### 第 2 步：统一 mock 数据源

由整合人先建立一份权威 mock 数据，把当前 `design-prototype/data/sample-races.json` 作为起点，但扩出管理端和 CA 健康所需字段。

### 第 3 步：搭可运行产品壳

先跑通一条完整 demo 主路径：

1. 首页看到赛事。
2. 进入 Race。
3. 进入 Live Hall。
4. 查看 Works。
5. 查看 Results。
6. 查看一个简化的 Admin Dashboard。

这一步即使全部还是 mock，也必须能运行。

### 第 4 步：逐个替换真实交付

替换顺序建议是：

1. 先替换数据层导出。
2. 再替换管理端读模型。
3. 最后替换 Rider 侧实时信号或回放数据。

原因是前两者是结构稳定输入，实时数据最容易拖慢联调。

### 第 5 步：补权限、发布态和异常流

最后再补：

1. 未发布数据不可见。
2. Projection 异常 fallback。
3. CA failed 但赛事仍继续的提示。
4. Work hidden / profile hidden 的显示处理。

## 5. 每组应补交给整合人的东西

### A Rider 客户端

1. 事件 schema。
2. 签名样例。
3. 回放样例。
4. 失败码表。

### B 管理系统

1. Dashboard view model。
2. 公开发布态规则。
3. Visibility 管理规则。
4. 审计事件列表。

### C 前端展示

1. 页面入口表。
2. 页面依赖字段表。
3. 数据 adapter 需求。
4. fallback 行为说明。

### D 数据层

1. 可直接提交的 mock 数据产物。
2. schema 字段说明。
3. 读取模型说明。
4. 当前真实交付状态清单。

## 6. 需要先裁定的 8 个共享问题

1. 统一运行壳到底是继续用原型壳，还是新建正式前端工程。
2. 公开端唯一权威数据源是什么。
3. `Results` 的发布 owner 是谁。
4. `Review` 的发布 owner 是谁。
5. `Screen Display` 的模式切换 owner 是谁。
6. `Work hidden` 和 `Profile hidden` 的 owner 是谁。
7. Rider 客户端登录和平台登录的边界怎么切。
8. 数据层当前有哪些产物是真实存在、已提交、可消费的。

## 7. 第一轮可运行产品的建议完成定义

达到下面标准，就可以算“已集成成一个可运行产品原型”：

1. 仓库内存在唯一启动入口。
2. 首页到赛事、Live、作品、赛果至少一条主路径可跑通。
3. 管理端至少能看到 dashboard 摘要和可见性状态。
4. 所有页面消费同一份权威 mock 或统一 adapter 输出。
5. 未发布和不可公开的数据不会误显示。
6. 缺少实时数据时，系统能 fallback 到静态或回放数据，不直接报废。

## 8. 建议的下一步

最优先不是继续扩写四份分工文档，而是尽快补 3 份短文或表：

1. 共享字段字典。
2. 发布态/可见性规则。
3. 当前真实交付状态清单。

这三件事定下来之后，整合工作才会真正变得方便和可靠。