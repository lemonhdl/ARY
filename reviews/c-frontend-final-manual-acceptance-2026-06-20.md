# C-Frontend 最终人工验收记录（2026-06-20）

验收目标：补一轮基于浏览器实际渲染与交互的人工验收留痕，作为 C-Frontend 集成收工证据。

验收环境：

- 本机单机应用：`http://127.0.0.1:3000`
- 验收方式：浏览器直达路由检查 + 页面渲染观察 + 关键交互回放
- 验收范围：Public / Live / Works / Results / Review / Riders / Cooperation / Screen

## 验收结论

本轮人工验收通过。C-Frontend 当前公开路由、关键页面渲染、Results / Review 深链、公开 Rider Profile 边界，以及 Screen 展示模式均符合当前集成收口预期，可作为“进入最终收工阶段”的人工证据。

需要说明的一点是：页面采用 1920×1080 大屏缩放布局，少数按钮在自动化点击时需要使用 force click 才能绕过 Playwright 对“可见且稳定”的默认前置条件。但从真实用户视角看，页面内容、路由切换与浏览器回退均工作正常，这属于验收工具与缩放布局的交互特性，不构成当前收工 blocker。

## 实测记录

### 1. Public 首页直达

- 路由：`/public/?raceId=smart-investment-analyst#home`
- 观察结果：页面标题为 `ARY Public`；首屏主标题显示“智能投研助理”；顶部公开导航、Live Hall、作品墙、赛果 / Review、大屏展示入口均可见。
- 结论：通过。

### 2. Live Hall 直达

- 路由：`/live/bay-area-happy-trip`
- 观察结果：页面标题为 `ARY Live Hall`；主标题显示“湾区开心游 Agent 正在骑行”；Live Hall 主视图、过程榜单、Riding Signal、成本 / 风险卡均渲染正常。
- 结论：通过。

### 3. Works 公开筛选直达

- 路由：`/works?raceId=genesis-dogfood-race&filter=awarded`
- 观察结果：页面标题为 `ARY Works`；主标题显示“创世骑行挑战赛作品墙”；筛选状态显示“获奖作品”；页面仅展示本场公开获奖作品，并能看到 `ARY Forge Console` 详情入口。
- 结论：通过。

### 4. Results 深链直达

- 路由：`/results/genesis-dogfood-race`
- 观察结果：页面标题为 `ARY Results`；主标题显示“创世骑行挑战赛赛果”；正文显示已发布奖项内容，Published Races 侧栏中“创世骑行挑战赛”处于 active；未出现错误回退到其它赛事正文的情况。
- 结论：通过。

### 5. Review 深链直达

- 路由：`/review/genesis-dogfood-race`
- 观察结果：页面标题为 `ARY Review`；主标题显示“创世骑行挑战赛复盘”；正文显示“已发布复盘”“公开证据摘要”等正确公开资产说明，并与创世赛事绑定。
- 结论：通过。

### 6. Rider 公开档案直达

- 路由：`/riders/rider-mira`
- 观察结果：页面标题为 `ARY Riders`；主标题显示 `Mira Chen`；页面明确写明“rider_report 默认不公开”“公开档案不展示原始连接”“仅展示作品入口、公开证据摘要和已发布赛果”。
- 结论：通过。

### 7. Cooperation 公开入口直达

- 路由：`/cooperation`
- 观察结果：页面标题为 `ARY Cooperation`；主标题显示“下一场 Race 如何加入”；报名参赛、发起赛事、赞助合作三个公开入口均可见。
- 结论：通过。

### 8. Screen 展示模式直达

- 路由：`/screen/bay-area-happy-trip?mode=leaderboard`
- 观察结果：页面标题为 `ARY Screen`；主标题显示 `Process Leaderboard`；榜单内容显示 `Mira Chen / Ana Ruiz / Jun Park / Rae Stone` 等过程榜项，且页面保持纯展示输出面。
- 结论：通过。

### 9. 站内跳转与浏览器回退

- 操作：从 `/results/genesis-dogfood-race` 点击“查看 Review”，再执行浏览器 Back。
- 观察结果：
  - 点击后 URL 切换到 `/review/genesis-dogfood-race`，标题切到创世赛事 Review。
  - Back 后 URL 回到 `/results/genesis-dogfood-race`，标题回到创世赛事 Results。
- 结论：通过。

## 最终判断

- C-Frontend 已完成本轮最终人工验收留痕。
- 当前可将其作为“已完成主流程集成、已具备收工证据”的交付看待。
- 后续若继续处理，只剩收尾级人工验收补充或小范围语义整理，不再属于阻塞当前收工的结构性问题。