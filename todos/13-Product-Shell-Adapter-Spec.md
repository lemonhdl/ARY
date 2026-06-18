# 产品壳与 Adapter 规范

## 1. 目标

让 C 和 E 围绕同一个产品壳与 adapter 接口工作，避免页面直接绑定底层数据文件。

## 2. 产品壳原则

第一轮继续基于当前 `design-prototype/` 的页面结构与视觉资产实现产品壳。

## 3. Adapter 原则

页面层只读 adapter 输出，不直接读取任意来源的原始 JSON。

## 4. Adapter 最低输入

1. `RaceSummary[]`
2. `LiveProjectionView[]`
3. `PublishedWorkView[]`
4. `PublishedResultView[]`
5. `PublishedReviewView[]`
6. `PublicRiderProfileView[]`
7. `DashboardOverview`

## 5. Adapter 最低输出能力

1. 能为首页提供 featured race 和 live race 数据。
2. 能为 Race Page 关联 race、works、results、review。
3. 能为 Live Hall 提供 projection 和 riders / event stream。
4. 能为 Works / Results / Review / Profile 做公开过滤。
5. 能让 E 在不改页面结构的前提下切换数据源。

## 6. 执行要求

1. C 必须交 `adapter-contract.md`。
2. E 必须按 C 的 adapter contract 自动装配数据。
3. 页面 fallback 必须文档化，不得隐式硬编码。