# C 组任务：前端展示完整任务与产品壳接线

本文保留原始前端展示模块说明中的页面、数据需求、对接方式、边界和推进记录，并在后半部分追加产品壳 adapter 与 handoff 规范。

## 1. 一句话职责

前端展示模块负责把高保真原型中面向观众和现场展示的页面做成可走查、可演示、可接入 mock 数据的展示前端。

核心目标不是做后台管理、不是做数据库、不是做真实 CA 接入，而是保证观众打开 ARY 前端时，能看懂赛事是什么、正在发生什么、作品和赛果在哪里、现场大屏展示什么。

## 2. 模块定位

前端展示模块 = Public Site + Live Hall + Screen Display + 展示排版。

对应角色：public audience、现场观众、潜在合作方、未登录访客。

不负责登录后的真实操作流程，只负责公开观看和展示体验。

## 3. 页面范围

### 3.1 必须覆盖页面

1. Home / Race Gallery。
2. Race Page。
3. Live Hall。
4. Works。
5. Work Page。
6. Results。
7. Review。
8. Rider Profile。
9. Cooperation。
10. Screen Display。

### 3.2 每个页面要做到什么程度

Home / Race Gallery：能展示主推赛事、Live Race 切换、作品和 Rider 入口，并保持 Gallery-first。

Race Page：展示赛题、状态、赛程和 Live / Works / Results / Review 入口。

Live Hall：展示 riding signal、riders、records、cost、alerts、event stream、process leaderboard，并明确“过程榜不是最终赛果”。

Works / Work Page：展示公开作品列表、精选作品、作品详情、Demo、Evidence、Award、Judge comment 摘要。

Results：展示最终 Award / Leaderboard，不把 Live Hall 过程榜单当最终结果。

Review：展示 review summary、judge comments、featured cases、skill highlights。

Rider Profile：展示公开 Rider 档案、作品、获奖、Evidence 摘要和能力标签。

Cooperation：展示报名、办赛、赞助合作入口。

Screen Display：大字号、远距离可读、支持 Live / Leaderboard / Works / Announcement 模式，不出现后台控制按钮。

## 4. 功能清单与注意事项

### 4.1 Home / Race Gallery

必须实现品牌区、主推赛事、Live Race 切换器、进入 Live Hall / Race Page / Works / Rider 的入口，以及 Race Updates / Latest Results / Past Races / Cooperation 区域。

注意：首页必须 Gallery-first，Login / Console 入口不能抢占主视觉。

### 4.2 Race Page

必须实现 Race 标题、状态、challenge brief、schedule、CTA、状态卡。

注意：completed 时 CTA 偏 Results / Review；running 时 CTA 偏 Live Hall。

### 4.3 Live Hall

必须展示 Projection 与 event stream，不读取原始 CA Session，不公开原始 CA Session。

### 4.4 Works / Work Page

公开端原则上只展示 public / published 内容。private / review 内容若用于 demo，必须标明 mock 或 internal preview。

### 4.5 Results / Review / Rider Profile

Results 读取 Award / leaderboard / Report，不读取过程榜。

Review 是赛后资产，不是 Live Hall 事件流。

Rider Profile 只展示公开档案与公开 Evidence 摘要。

### 4.6 Screen Display

这是输出面，不是控制面。控制按钮只能在控制面或 demo 侧栏中，不能出现在纯展示输出区域。

## 5. 和其他模块的对接

与 A 对接：确认 Rider Profile、Work Page 中哪些字段可以公开展示，以及防伪标识使用什么公开文案。

与 B 对接：确认哪些 Results、Review、Work 可公开，Screen Console 是否控制 Screen Display。

与 D 对接：对齐 Race、Work、Rider Profile、Projection、Award / Results、review summary、publicEvidenceSummaries、screen feed。

与 E 对接：确认采用静态原型还是正式前端工程、路由约定、页面入口命名、demo 主路径。

## 6. 模块边界

你负责：公开展示页面、大屏展示页面、展示排版、公开浏览路径、展示层 fallback、展示层 UX 走查。

你不负责：Rider 上传与防伪真实逻辑、管理端真实操作逻辑、数据库模型、GitHub 登录、RidingRecord 存储、CA / Projection 真实生成逻辑、QA 总表和最终 demo 录制。

## 7. 可独立推进方式

1. 直接基于 `design-prototype/index.html`、`script.js`、`styles.css`、`sample-races.json`、`sample-races.js` 推进。
2. 建立本地 fallback 数据，但字段名尽量贴近现有 `sample-races.json`。
3. 页面先跑通，接口后替换，围绕 `renderRacePage`、`renderLiveHall`、`renderWorks`、`renderResults`、`renderReview`、`renderRiderProfile`、`renderScreenDisplay` 这种输入边界组织。
4. 不做真实登录和权限，只消费公开态判断。
5. 不做真实 CA 数据生成，只消费 Projection。

## 8. 当前推进记录

现有 `design-prototype/index.html` 已可作为展示模块起点。Home、Race、Live、Works、Results、Review、Rider Profile、Cooperation、Screen Display 已有原型基础；Work Page 需要补详情页或详情面板；Screen Display 需要补多模式切换。

当前数据需求已经明确，短期可以先按 `sample-races.json` 推进，后续再替换为 D 的正式 schema 或统一 authority mock。

## 9. 统一执行输入

必须先读：

1. `todos/10-Shared-Field-Dictionary.md`
2. `todos/11-Publication-Visibility-Rules.md`
3. `todos/12-Authority-Mock-Data-Spec.md`
4. `todos/13-Product-Shell-Adapter-Spec.md`
5. `todos/16-Project-Baseline-Requirements.md`
6. 本文

## 10. 统一交付输出

你必须在 `deliverables/c-frontend/` 下交出以下产物：

1. `handoff.manifest.json`
2. `route-map.json`
3. `page-dependencies.json`
4. `adapter-contract.md`
5. `fallback-rules.md`
6. `shell-readme.md`
7. `app-shell/`（如实现前端代码）

## 10.1 实现栈约束

为了集成和部署简单，C 组默认按以下方式实现：

1. 优先使用原生 HTML、CSS、JavaScript ES Modules。
2. 优先复用现有 `design-prototype/` 资产，不额外引入重型前端框架。
3. 页面壳应能被单机 Web 应用直接托管，不要求独立前端部署。
4. 如果使用脚手架，只能作为初始化工具，不能把运行时绑定到复杂框架链路上。

## 11. 交付附加要求

`route-map.json` 必须描述页面 route、主数据源、fallback 来源、公开判断依赖。

`page-dependencies.json` 必须列清页面依赖的 `RaceSummary`、`LiveProjectionView`、`PublishedWorkView`、`PublishedResultView`、`PublishedReviewView`、`PublicRiderProfileView`。

`fallback-rules.md` 至少覆盖 Projection 缺失、Results 未发布、Review 未发布、Work 非公开、Profile 非公开。

## 12. 验收标准

1. E 只替换 adapter 输入，不改页面结构，就能切换数据源。
2. 页面不会误展示 private、review、hidden、unpublished 内容。
3. 原型壳能跑通首页到赛果的主路径。
4. 交付内容不能把原始展示模块任务退化成“只写几个 route 和 fallback 规则”。