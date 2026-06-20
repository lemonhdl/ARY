# C-Frontend 返工复审（2026-06-20）

审查对象：`deliverables/c-frontend/` 当前交付，以及本轮由 E / 集成侧完成的产品壳接线结果

结论：**现在应暂停继续替 C-Frontend 收口，并把返工要求回传给 C 同学。**

原因不是“这份交付完全不能用”。相反，C-Frontend 已经提供了可运行原型、文档和足够的页面资产，E 也已经完成了首轮和第二轮产品壳接线，把 `/public`、`/live`、`/screen`、`/race/:raceId`、`/works/:workId`、`/results/:raceId`、`/review/:raceId`、`/riders/:riderId`、`/cooperation` 全部挂进了单机产品壳，并且完成了运行时 bridge、服务端 route 和关键 Back/Forward 同步。这些属于正常集成工作。

但继续往下做时，问题性质已经从“集成接线”变成了“C 原型本身没有提供稳定的产品化边界”。E 现在如果继续推进，就不是在接线，而是在替 C 组把原型内部状态机、轮播逻辑、CTA 语义和 URL policy 一并重构。这不该再由集成侧继续兜底。

按当前状态判断，C-Frontend 仍然适合作为**可集成起点**，但**还不适合直接集成收工**。如果按“可开始集成”口径看，完成度仍可维持在 **70% 到 75%**；如果按“无需 E 继续修原型内部行为、C 自己已交出稳定产品壳边界”的口径看，当前还没有达到收工标准。

## Findings

### 1. 高优先级：首页 Live Race 切换仍然受原型内部状态与自动轮播控制，产品壳无法稳定接管 URL

- 本轮集成已经把产品壳 route 扩展到关键站内导航，并在 [app/web/shared/c-frontend-loader.js](../app/web/shared/c-frontend-loader.js) 中为 Public / Race / Works / Results / Review / Riders / Cooperation 增加了路径同步。
- 但继续验证首页 `data-live-race` 交互时，发现页面内容虽然会切换到目标赛事，`page.url()` 仍停留在 `/public/#home`，没有稳定写成 query-aware 的产品壳路径，例如 `/public/?raceId=smart-investment-analyst#home`。
- 为了验证这不是集成层的小疏漏，E 侧已经额外尝试过：
  - 在 loader 中补首页 race 切换的 URL 同步。
  - 将同步时序延后到下一帧。
  - 为首页 race 增加 pinned state，阻止自动轮播改回。
  - 包装原型内部 `renderHomeRace` / `renderPublicRaceContext` 控制点。
- 即使如此，最终浏览器自动化验证仍显示：切到“智能投研助理”后，URL 仍然保留 `/public/#home`。
- 根因不是 E 没把路由接上，而是 C 原型自己的首页状态机、事件顺序和自动轮播逻辑仍在主导交互语义。参见 [deliverables/c-frontend/app-shell/prototype/script.js](../deliverables/c-frontend/app-shell/prototype/script.js#L272) 与 [deliverables/c-frontend/app-shell/prototype/script.js](../deliverables/c-frontend/app-shell/prototype/script.js#L1108)。

影响：这说明首页 Featured Race / Live Race 切换还不是一个可被产品壳稳定接管的交互边界。E 如果继续兜，会变成持续 monkey patch 原型内部机制，而不是消费稳定交付。

### 2. 高优先级：关键 CTA 仍依赖原型当前可见状态，缺少明确的外部驱动 contract

- 在 Riders / Works / Results / Review 路由接入后，E 侧还不得不继续补：
  - Works filter query 状态。
  - Rider CTA 的 riderId 推导与 unavailable 兜底。
  - 同页 `pushState` 后强制再应用 route state。
- 这些工作已经超出“换数据源、挂产品壳”的正常范围，说明当前原型并没有把关键 CTA 的数据依赖和跳转 contract 显式交出来，而是把它们埋在当前页面可见状态、面板状态和 demo 数据结构里。

影响：只要继续沿这个方向推进，E 就会不断依赖 DOM 结构和运行时 patch 去猜测当前上下文，维护成本很高，也会模糊 C / E 的责任边界。

### 3. 中优先级：当前交付仍偏“可演示原型壳”，不是“可被产品壳稳定接入的正式壳”

- 当前原型脚本仍直接消费 `window.ARY_SAMPLE_DATA`，adapter 边界主要还在文档里，没有完全变成稳定、可执行的产品化接缝，见 [deliverables/c-frontend/app-shell/prototype/script.js](../deliverables/c-frontend/app-shell/prototype/script.js#L1)。
- `route-map.json` 虽然定义了多条产品路径，但原型本体仍主要是单入口、多面板、内部状态切换壳。
- 这也是为什么一旦产品壳开始尝试严格收口 URL policy，就会不断撞上原型内部的 hash / panel / carousel 语义。

影响：当前交付可以被 E 接进来开始联调，但还不能要求 E 在不改原型内部行为的前提下直接收工。

## What Passed

- C-Frontend 不是空交付。它已经提供了可运行原型、文档、route 说明和复用资产。
- E 侧已完成首轮产品壳接线：`/public`、`/live`、`/screen` 可打开并接入运行时 view。
- E 侧已完成第二批公开 route 接线：`/race/:raceId`、`/works/:workId`、`/results/:raceId`、`/review/:raceId`、`/riders/:riderId`、`/cooperation` 已支持直达。
- 关键站内导航同步已有一部分通过验证：
  - Public 首页点入 Race。
  - Race 点入 Live。
  - Results 切到 Review。
  - 浏览器 Back 回退。
- Works filter 已验证可以稳定写回产品壳 URL，例如 `/works?raceId=genesis-dogfood-race&filter=awarded`。

## Run/Test 结果

本轮额外验证了以下行为：

1. `get_errors` 检查 [app/web/shared/c-frontend-loader.js](../app/web/shared/c-frontend-loader.js)
   - 结果：无静态错误。
2. 浏览器验证 `Works` 筛选
   - 操作：点击 `已获奖`
   - 结果：URL 稳定变为 `/works?raceId=genesis-dogfood-race&filter=awarded`，页面内容同步切到获奖作品。
3. 浏览器验证首页 Live Race 切换
   - 操作：点击“切换到智能投研助理”
   - 结果：页面标题和内容会切换，但 `page.url()` 仍停留在 `/public/#home`，没有稳定写回 `raceId` query。

## Boundary Judgment

以下内容属于 E / 集成侧已经完成或本应完成的工作：

1. 运行时 bridge。
2. 服务端静态挂载与 route fallback。
3. 产品壳入口页创建。
4. 公开 route 直达包装。
5. 首轮站内 pathname / Back/Forward 同步。

以下内容已经开始越界到 C 应返工的范围：

1. 首页 Live Race 切换的正式 URL contract。
2. 自动轮播与外部 route state 的优先级关系。
3. 关键 CTA 的稳定输入 contract，而不是依赖当前可见 DOM 状态。
4. 把原型内部 hash / panel 语义进一步收口为可被产品壳稳定接管的页面行为。

## Required Rework For C-Frontend

1. 明确首页 Live Race 切换 contract：当外部指定 `raceId` 时，原型必须稳定服从外部状态，不允许自动轮播或内部状态机覆盖产品壳 URL。
2. 给关键 CTA 提供稳定、显式的输入 contract：Works filter、Rider CTA、Live CTA、Results / Review 切换都不能再依赖“当前 DOM 正显示什么”来推导页面行为。
3. 把 route-map 的关键路径真正落实为可被产品壳接管的行为模型，而不只是单页原型里的内部 panel 切换。
4. 收口 adapter 边界：E 不应继续通过 monkey patch 和 DOM 推断去控制原型页面状态。
5. 如保留首页自动轮播，必须提供可关闭或被外部状态 pin 住的机制。

## Overall Assessment

- **不建议 E 继续深挖 C 原型内部行为。**
- **建议暂停当前这条继续产品化 C 壳的工作流，把本 review 回传给 C 同学返工。**
- 当前产品壳已足够证明“可以集成、可以联调、主要页面资产可消费”；但还不足以证明“C 交付已经稳定到可以由 E 单方面继续补到收工”。

## Recommended Next Steps

1. 将本 review 发给 C-Frontend，同步返工边界和验收口径。
2. E 侧暂停继续修首页 live switcher / carousel / CTA 内部时序问题，不再扩大 monkey patch 面积。
3. 等 C 提交一轮面向产品壳接入的返工后，再做一次 focused rereview，重点只看 route contract、CTA contract 和外部 state 接管是否稳定。