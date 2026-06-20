# C-Frontend 集成收口说明（2026-06-20）

审查对象：当前工作树中的 `deliverables/c-frontend/`、`app/web/shared/c-frontend-loader.js`、`app/server/index.js`、`app/web/` 产品壳入口页

结论：截至本轮收口，**C-Frontend 已达到“当前仓库内可继续集成验收 / 不再等待 C 继续返工”状态**。

这次收口分成两部分：

1. E 侧已把产品壳从临时 monkey patch 模式切到消费 C 公开的 `window.ARY_C_FRONTEND` route / CTA API。
2. 由于时间窗口不足以再返给 C 做新一轮返工，E 已直接在当前仓库修复 Results / Review 对 `archived` 但已发布赛事的错误排除，使 `/results/genesis-dogfood-race` 与 `/review/genesis-dogfood-race` 恢复符合 deep-link contract 的行为。

当前最合适的项目口径是：**继续由我们自己完成最终验收与收工，不再以等待 C-Frontend 新提交作为前置条件。**

## What Closed

### 产品壳接线

- `app/web/shared/c-frontend-loader.js` 已改为消费 `window.ARY_C_FRONTEND.applyRouteState`，不再继续注入和包裹 `renderHomeRace`、`renderPublicRaceContext`、`rotateHomeLiveRace`、`renderWorkDetail` 等原型内部函数。
- 产品壳初始直达、URL 解析、以及浏览器 `popstate` 回放已由 E 在壳层完成收口。
- `/public`、`/race/:raceId`、`/live/:raceId`、`/works/:workId`、`/results/:raceId`、`/review/:raceId`、`/riders/:riderId`、`/cooperation`、`/screen/:raceId` 已统一落到同一套公开 route contract。

### Results / Review 修复

- `deliverables/c-frontend/app-shell/prototype/script.js` 现已将 `archived` 且已发布 award/review 的赛事纳入 published results 集合。
- `genesis-dogfood-race` 不再因为 `race.status = archived` 被错误排除。
- `/results/genesis-dogfood-race` 与 `/review/genesis-dogfood-race` 当前已稳定显示“创世骑行挑战赛”，不再错误回退成“政务办事导航 Agent”。

## Final Validation Evidence

我本轮实际确认了以下结果：

1. `node .\scripts\assemble.js`
   - 结果：成功重建 `runtime-data/assembled-view.json` 与 `runtime-data/compatibility-report.json`，且 `warnings = []`。
2. `node .\scripts\validate-handoffs.js`
   - 结果：`a-rider`、`b-admin`、`c-frontend`、`d-data` 的 `handoff.manifest.json` 全部被成功发现。
3. 浏览器路由矩阵回归
   - 已验证：
     - `/public/?raceId=smart-investment-analyst#home`
     - `/race/bay-area-happy-trip`
     - `/live/bay-area-happy-trip`
     - `/works?raceId=genesis-dogfood-race&filter=awarded`
     - `/works/work-genesis-dogfood-race-012`
     - `/results/genesis-dogfood-race`
     - `/review/genesis-dogfood-race`
     - `/riders/rider-mira`
     - `/cooperation`
     - `/screen/bay-area-happy-trip?mode=leaderboard`
   - 结果：10 条直达路由全部命中对应 active panel，并显示正确页面内容。
4. 浏览器历史回放验证
   - 操作：从 Works 切到 Screen，再使用 Back 回到 Works。
   - 结果：URL、active panel 和页面标题均回到 Works，说明壳层 `popstate` 回放已生效。
5. Results / Review 目标赛事验证
   - 结果：`/results/genesis-dogfood-race` 显示“创世骑行挑战赛赛果”；`/review/genesis-dogfood-race` 显示“创世骑行挑战赛复盘”；Results 切换器中 genesis 处于 active。

## Remaining Work

- 当前剩余工作已降为收尾级，不再是结构性 blocker。
- 合理的剩余项主要是：
  - 最终人工验收留痕
  - 如有需要，补一轮 UI/文案微调
  - 收敛少量非当前页面字段仍保留默认值的状态语义噪音

## Recommended Close-Out Position

- 对内口径：**C-Frontend 已完成当前仓库内主 blocker 修复和 API 化集成收口，可继续进入最终集成验收。**
- 对外口径：**不再等待新的 C-Frontend 提交；如后续有新增提交，只按增量吸收，不作为当前集成阻塞项。**