# C-Frontend 最新提交复审（7685d6b）

审查对象：`deliverables/c-frontend/` 最新提交 `7685d6b Fix C frontend route contract handoff`

结论：这次返工**有效关闭了上轮阻塞集成的主问题**。C 组已经把显式 route / CTA contract 收回到自己的原型脚本里，不再要求 E 继续通过 monkey patch 原型内部函数、轮播状态机或 DOM 推断来驱动页面行为。当前完成度可从上一轮的 70% 到 75% 上调到大约 **88% 到 90%**。

是否可以开始集成：**可以，而且现在应该恢复集成。**

更准确地说，C-Frontend 现在已经达到“E 可以基于公开 API 完成接线和收口”的状态，不需要再因为 C 自身 route/state contract 不稳定而暂停。后续产品壳回归曾确认过两个尾项：

1. 一个**非阻塞的 history 回放缺口**，即原型自身还没有订阅浏览器 `popstate`，Back / Forward 的状态重放仍需 E 用它公开出来的 API 接一下。
2. 一个**曾经暴露出的高优先级 Results / Review 路由问题**，即 `/results/:raceId` 与 `/review/:raceId` 在 `archived` 但已发布结果的赛事上会被错误排除；由于当前时间不足以再返给 C 返工，E 已在本仓库直接修复这条逻辑，使 `archived` 且已发布 award/review 的赛事也进入 published results 集合。

## Findings

### 1. 已关闭：Results / Review 对 archived 已发布赛事的错误排除

- 在当前运行时样例里，`genesis-dogfood-race` 的 `race.status` 是 `archived`，但它已经同时具备 published award 和 published review。
- 原型此前把 published results 候选赛事硬编码为 `status === "completed"`，导致 genesis 被错误排除，进而出现“URL / state 指向 genesis，但页面回退到另一场已发布赛事”的问题。
- 由于当前没有时间再返给 C 返工，这条逻辑已由 E 直接在 [deliverables/c-frontend/app-shell/prototype/script.js](deliverables/c-frontend/app-shell/prototype/script.js) 修复：`archived` 且已发布 award/review 的赛事现已被视为可展示 Results / Review 的 published race。

当前结果：`/results/genesis-dogfood-race` 与 `/review/genesis-dogfood-race` 已能稳定渲染“创世骑行挑战赛”。

### 2. 中优先级：原型公开了 route API，但自身还没有处理浏览器 `popstate`

- 最新 `script.js` 已实现 `window.ARY_C_FRONTEND.applyRouteState / applyPath / parsePath / getRouteState / getUrlForState`，并能主动调用 `history.pushState` / `replaceState` 写出产品壳 URL。
- 但当前脚本里仍未看到 `window.addEventListener("popstate", ...)` 之类的回放逻辑；也就是说，原型能够**主动写 URL**，却还不能在用户点浏览器 Back / Forward 时**被动按 URL 重新渲染状态**。
- 我直接在浏览器里验证过：先切到 `/screen/bay-area-happy-trip?mode=leaderboard`，再用浏览器 Back 回到 `/works?raceId=genesis-dogfood-race&filter=awarded`。URL 的确变回了 Works，但 `window.ARY_C_FRONTEND.getRouteState()` 仍停在 `page: "screen"`，当前激活 panel 也还是 `screen`。
- `shell-readme.md` 目前写成“原型会 dispatch route-change 供 Back/Forward 和 shell sync 使用”，这句话偏乐观。当前实现只覆盖了主动状态切换后的事件派发，还没有把浏览器历史回放本身接进来。

影响：这已经不是上次那种“必须退回 C 重做的 blocker”。E 现在完全可以在产品壳层通过公开 API 补上：监听 `popstate`，再调用 `window.ARY_C_FRONTEND.applyPath(window.location.href, { syncUrl: false })`。这属于正常消费公开 contract，而不是继续 monkey patch 原型内部行为。

## What Passed

- `deliverables/c-frontend/app-shell/prototype/script.js` 不再只硬绑 `window.ARY_SAMPLE_DATA`，而是优先消费 `window.ARY_C_FRONTEND_ADAPTER`，同时兼容 E 侧已有的 `window.ARY_ASSEMBLED_VIEW` / `window.ARY_RUNTIME_VIEW`。
- 原型已显式暴露 `window.ARY_C_FRONTEND`，把 page、raceId、workId、riderId、resultsRaceId、workFilter、screenMode、homeRacePinned 都拉成可执行 state contract。
- Home 页 live race 切换这次已经真正写回 URL。浏览器点击“切换到智能投研助理”后，地址会稳定变成 `/public/?raceId=smart-investment-analyst#home`，不再像上一轮那样只切内容、不改 URL。
- `applyPath('/works?raceId=genesis-dogfood-race&filter=awarded')` 已能正确切到 Works，并派发 `ary:c-frontend-route-change`，事件 detail 里的 state / url 与页面表现一致。
- Works 卡片 CTA 已带明确 `data-work-id`，实际点击后会把 URL 写成真实 `/works/:workId`，并打开对应详情面板，而不是只停留在内部 panel 切换。
- Screen mode 已纳入显式 route state；通过 `applyRouteState({ page: 'screen', raceId, screenMode: 'leaderboard' })` 可以稳定进入 `/screen/:raceId?mode=leaderboard`。
- `route-map.json`、`adapter-contract.md`、`shell-readme.md` 三份 handoff 文档这次也和原型代码基本对齐了，不再只是文档先行、实现缺位。
- `node .\scripts\validate-handoffs.js` 已通过，`deliverables/c-frontend/handoff.manifest.json` 仍可被统一校验发现。

## Run/Test 结果

我本轮实际做了以下检查：

1. 提交面核对
   - `git show --stat 7685d6b -- deliverables/c-frontend`
   - 结果：本次确实修改了 `README.md`、`adapter-contract.md`、`app-shell/prototype/script.js`、`route-map.json`、`shell-readme.md`，不是只改说明文档。
2. handoff 结构校验
   - `node .\scripts\validate-handoffs.js`
   - 结果：`c-frontend` manifest 可正常通过统一发现。
3. 浏览器 API 存在性验证
   - 结果：`window.ARY_C_FRONTEND` 存在，且包含 `applyRouteState`、`applyPath`、`parsePath`、`getRouteState`、`getUrlForState`、`pauseHomeCarousel`、`resumeHomeCarousel`。
4. 浏览器首页 live race 切换验证
   - 操作：点击“切换到智能投研助理”。
   - 结果：标题、内容和 URL 一起切换到 `/public/?raceId=smart-investment-analyst#home`。
5. 浏览器 Works filter / route event 验证
   - 操作：执行 `applyPath('/works?raceId=genesis-dogfood-race&filter=awarded', { syncUrl: true })`。
   - 结果：页面切到创世赛获奖作品，URL 变为 `/works?raceId=genesis-dogfood-race&filter=awarded`，并正确派发 `ary:c-frontend-route-change`。
6. 浏览器 Work detail CTA 验证
   - 操作：点击获奖作品卡“查看详情”。
   - 结果：当前运行时下实际生成的 URL 为 `/works/work-genesis-dogfood-race-012`，详情面板打开，内容与作品卡一致。
7. 浏览器 Screen mode route 验证
   - 操作：执行 `applyRouteState({ page: 'screen', raceId: 'bay-area-happy-trip', screenMode: 'leaderboard', homeRacePinned: true }, { syncUrl: true })`。
   - 结果：页面进入 `/screen/bay-area-happy-trip?mode=leaderboard`，标题切为 `GRS-002 TOP3`。
8. 浏览器 Back/Forward 回放验证
   - 操作：从 Screen 页面点浏览器 Back 回到 Works URL。
   - 结果：原型自身不处理 `popstate`，但 E 侧已在产品壳 loader 中消费公开 API 补齐回放；当前回退后 URL、active panel 和页面内容均能回到 Works。
9. 浏览器 Results / Review 目标赛事验证
   - 操作：直接访问 `/results/genesis-dogfood-race`、`/review/genesis-dogfood-race`，并额外执行 `window.ARY_C_FRONTEND.applyPath('/results/genesis-dogfood-race')`。
   - 结果：修复后 URL、route state 和页面标题均稳定指向“创世骑行挑战赛”。
10. 产品壳全路由回归
   - 操作：逐条验证 `/public/?raceId=smart-investment-analyst#home`、`/race/bay-area-happy-trip`、`/live/bay-area-happy-trip`、`/works?raceId=genesis-dogfood-race&filter=awarded`、`/works/work-genesis-dogfood-race-012`、`/results/genesis-dogfood-race`、`/review/genesis-dogfood-race`、`/riders/rider-mira`、`/cooperation`、`/screen/bay-area-happy-trip?mode=leaderboard`，并额外验证 Screen -> Back -> Works。
   - 结果：11/11 通过。

## Overall Assessment

- 上一轮要求 C 返工的核心问题已经被实质性关闭：显式 route contract、Home race 外部接管、Works filter / Work detail / Rider / Screen mode 的公开状态驱动都已经落到了 C 自己的原型代码里。
- 这意味着 E 现在不用再继续包 `renderHomeRace`、`renderPublicRaceContext`、CTA 点击时序或 carousel 内部逻辑，责任边界重新清楚了。
- 当前主 blocker 已被消掉：E 已把现有 loader 从 monkey patch 模式切到消费 `window.ARY_C_FRONTEND` 的正常模式，并在壳层补上了 `popstate` 回放；Results / Review 对 archived 已发布赛事的错误排除也已在当前仓库直接修复。

## Completion Assessment

- 相对最初分工 spec 和上一轮返工要求，我给这次最新交付大约 **88% 到 90%**。
- 没给到更高，主要是因为当前仍有少量状态语义层面的尾项，例如部分非当前页面字段会保留默认值；不过从产品壳路由、页面渲染和回退行为看，主流程已经达到可继续集成验收的状态。

## Direct Integration Judgment

- **可以开始，而且建议立即恢复集成。**
- **不需要再把这次提交打回去等待 C 继续返工后才能动。**
- 对 E 来说，下一步工作重点已经从“替 C 修内部 contract”变成“继续做壳层验收和必要的小尾项清理”。当前仓库里，主 blocker 已经由 E 直接修完。

## Recommended Next Steps

1. E 侧恢复 C-Frontend 集成，把 `app/web/shared/c-frontend-loader.js` 逐步改为消费 `window.ARY_C_FRONTEND.applyPath / applyRouteState / getRouteState`，收掉之前为首页 race、Works filter、Rider CTA、Results / Review、Screen mode 写的内部函数 patch。
2. 在产品壳层补一层 `popstate` 监听，用公开 API 做 URL 回放；这不是 blocker，只是把浏览器 Back / Forward 补齐成正式行为。
3. 当前若继续收尾，重点应放在小范围验收和状态语义整理，而不是再扩大 monkey patch 面积。