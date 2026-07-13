# 前端展示模块分工复核与补充建议

## 1. 结论

这份分工总体是合理的，而且和当前仓库里真实存在的 `design-prototype/` 原型资源结合得最好，落地性比另外几份更强。它把公开展示端和大屏输出面单独拎出来，是正确拆法。

不过它当前更像“展示模块工作说明”，还不是“可被整合的前端交付约定”。最大缺口有 3 个：

1. 运行形态没有定死，是保留单页原型还是进入正式 app shell。
2. 页面完成定义主要是视觉和内容，没有补上路由、数据适配层、发布态判定。
3. 与 `Results / Review / Screen / Live Hall` 相关的共享字段还没有冻结为统一 contract。

## 2. 合理之处

1. 页面范围和 `docs/ary-mvp.ia.md` 基本一致，尤其是 `Home`、`Race`、`Live Hall`、`Works`、`Results`、`Review`、`Rider Profile`、`Screen Display` 的划分。
2. 明确强调“公开端不展示原始 CA Session”“过程榜单不是最终赛果”，方向是对的。
3. 已考虑 `fallback` 数据，这对当前仍以原型和文档为主的仓库状态很重要。
4. 与其他模块的对接章节写得较清楚，说明作者已经在考虑集成问题。

## 3. 主要缺口

### 3.1 缺少统一运行壳约定

文档同时提到“保留原型单页方式”和“后续接入 app shell”，但没有说第一轮整合到底采用哪一种。对整合人来说，这会直接影响目录结构、路由和状态管理方式。

### 3.2 缺少稳定的数据适配层

当前文档多次写“字段尽量贴近 `sample-races.json`”，这在前期是对的，但整合时还差一步：

1. 明确哪些字段是页面真正依赖的稳定字段。
2. 其余展示性字段是否允许缺省。
3. 如何把正式数据 contract 适配到现有原型渲染函数。

### 3.3 缺少发布态与可见性判定规则

公开端是否可见，不能只靠页面自己猜。至少要冻结这些规则：

1. `Results` 何时可公开。
2. `Review` 何时可公开。
3. `Work` 的 `public / review / private / hidden` 如何影响页面。
4. `Rider Profile` 何时允许公开。

### 3.4 Screen 相关边界仍有歧义

文档中已经意识到 `Screen Display` 和控制面要分离，但还缺正式裁定：

1. 展示模块是否只负责输出页。
2. 模式切换是本地 demo 状态，还是接收外部控制输入。
3. 投屏故障的 fallback 优先级是什么。

## 4. 建议补充

### 4.1 第一轮先固定“原型壳 + 适配层”方案

在当前仓库条件下，最稳的方案不是立刻重做前端，而是：

1. 继续以 `design-prototype/` 为展示壳。
2. 增加一层数据适配器，把正式数据 contract 映射到现有页面。
3. 等整体闭环跑通后，再决定是否迁入正式前端工程。

### 4.2 为页面冻结最小字段 contract

建议至少单独列出这些对象：

1. `PublicRaceCard`
2. `LiveProjectionView`
3. `PublicWorkCard`
4. `PublishedAwardView`
5. `PublishedReviewView`
6. `PublicRiderProfileView`
7. `ScreenDisplayFeed`

### 4.3 明确页面 DoD

除了“看起来完成”，建议每个页面都满足：

1. 有固定入口。
2. 有空态。
3. 有错误态或 fallback。
4. 对公开/未公开数据有一致处理。
5. 可用同一份 mock 数据跑通。

### 4.4 收敛第一轮范围

建议第一轮只要求：

1. `Home`
2. `Race Page`
3. `Live Hall`
4. `Works`
5. `Results`
6. `Screen Display`

`Review`、`Rider Profile`、`Work Page` 可以作为第二轮增强，只要文档先把字段 contract 定清楚即可。

## 5. 对整合的直接影响

前端展示模块是最适合率先被整合起来做 demo 的模块，但前提是它不要直接绑定某一份易变 mock 数据，而是绑定一层可替换的 adapter。这样后面数据层、管理端发布态、Rider 侧实时数据接进来时，页面结构不需要推倒重来。