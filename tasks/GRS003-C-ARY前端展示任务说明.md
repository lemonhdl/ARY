# GRS003 前端展示模块同步说明

> 本文用于小组内部同步 ARY 前端展示模块的范围、接口、边界和当前完成情况。  
> 基准文档仍以 `README.md`、`docs/ary-mvp.prd.md`、`docs/ary-mvp.ia.md`、`docs/ary-domain-analysis.v0.3.md`、`docs/ux-hifi.taskbook.md` 等原始文档为准。  
> T13 演示视频、T14 最终提交说明不在本文展开。

---

## 0. 小组分工简表

当前先按已有沟通粗略对齐，具体边界仍需要各负责人确认：A 负责 Rider 客户端；B 负责 ARY 管理系统；C 负责 ARY 前端展示；D 负责数据 mock / 数据库 / GitHub 登录 / RidingRecord 存储；E 负责汇总整合、审阅和 PRD / PoC。

本文只细化 **ARY 前端展示模块**，用于和其他模块确认数据字段、页面入口和公开展示边界。

---

## 1. 前端展示模块的一句话职责

前端展示模块负责把老师给出的 `design-prototype/` 高保真原型中 **面向观众和现场展示的页面** 做成可走查、可演示、可接入 mock 数据的展示前端。

核心目标不是做后台管理、不是做数据库、不是做真实 CA 接入，而是保证：

```text
观众打开 ARY 前端时，能看懂赛事是什么、正在发生什么、作品和赛果在哪里、现场大屏展示什么。
```

---

## 2. 前端展示模块定位

前端展示模块的分工方向：

```text
ARY 前端展示
= 面向观众和现场展示的页面层
= Public Site + Live Hall + Screen Display + 展示排版
```

前端展示模块对应产品角色：

- public audience / 观众
- classroom / venue screen audience / 现场观众
- potential sponsor / 合作方浏览者
- non-login visitor / 未登录访客

前端展示模块不负责登录后的真实操作流程，只负责公开观看和展示体验。

---

## 3. 页面范围

前端展示模块的页面范围按优先级分为 P0 / P1 / P2。

### 3.1 P0 必须完成页面

这些页面是展示模块的核心交付，建议优先实现。

| 页面 | 作用 | 当前原型位置 | 展示模块要做到什么程度 |
|---|---|---|---|
| Home / Race Gallery | 首页，展示主推赛事和赛事入口 | `design-prototype/index.html` 的 `page-home` | 能看到当前主推 Race、进入 Race Page / Live Hall、看到作品和 Rider 入口 |
| Race Page | 单场赛事页，承载赛题、赛程、状态和入口 | `page-race` | 能说明一场 Race 的赛题、状态、赛程，并能跳到 Live / Works / Results |
| Live Hall | 实况大厅，展示赛事正在发生 | `page-live` | 展示 riding signal、riders、records、cost、alerts、event stream、process leaderboard |
| Works | 作品墙 | `page-works` | 展示公开作品列表、精选作品、作品状态和入口 |
| Results | 赛果页 | `page-results` | 展示最终 Award / Leaderboard，不能把过程榜单当最终结果 |
| Review | 赛后复盘页 | `page-review` | 展示 review summary、judge comments、案例亮点 |
| Rider Profile | 骑手档案页 | `page-rider` | 展示 Rider 的作品、获奖、Evidence 摘要和能力标签 |
| Screen Display | 现场大屏展示输出 | `page-screen` | 大字号、远距离可读、适合投屏，不出现后台控制按钮 |

### 3.2 P1 建议完成页面 / 状态

这些不是最核心，但能显著提高完整度。

| 页面 / 状态 | 为什么需要 | 展示模块要做什么 |
|---|---|---|
| Work Page | `docs/ary-mvp.ia.md` 中有 Work Page，但当前原型主要是 Works 卡片 | 可做一个作品详情状态或独立页，展示 Demo、作者、骑行摘要、评审摘要 |
| Cooperation | 合作 / 报名 / 办赛入口 | 保留并优化现有 `page-cooperation`，展示参赛、办赛、赞助合作入口 |
| Screen Display 多模式 | 大屏不应只有一种展示 | 至少展示 Live / Leaderboard / Works / Announcement 四种模式之一的切换效果，数据可 mock |
| Public 可见性标识 | 公开端不能展示 private / unpublished 内容 | 对 Work / Report / Review 做公开状态标记或过滤说明 |

### 3.3 P2 可选增强

时间充足再做。

| 增强项 | 说明 |
|---|---|
| 移动端适配 | 当前原型以 1920x1080 为主，可保留截图说明，不强制完整响应式 |
| 多场 Race 切换 | Home 已有 live race switcher，可扩展到 Race Page / Works / Results |
| Live Hall 动态刷新 | 可用定时器模拟 event stream / leaderboard 更新 |
| Screen Display 全屏模式 | 可加按钮或说明，但不必真实调用浏览器 fullscreen API |

---

## 4. 展示模块对应任务

对应总任务 T1–T14 中与前端展示相关的部分，主要用于和其他模块确认覆盖关系，不代表其他成员的最终分工。

| 索引 | 对应总任务 | 展示模块责任 | 是否必须 |
|---|---|---|---|
| T1-C | T1 UX-1 高保真原型验收 | 验收公开前端和大屏展示是否符合 UX-1 | 必须 |
| T5-C | T5 可运行应用壳 | 提供展示模块页面入口和路由需求；如果独立推进，可保留一个静态展示入口 | 必须 |
| T6-C | T6 Public Site 静态闭环 | 实现 Public Site 展示闭环 | 必须 |
| T10-C | T10 Screen Console / Screen Display | 实现 Screen Display 展示输出；控制面与输出面保持边界 | 必须 |
| T11-C | T11 Report / Review / Results | 实现公开端 Results / Review / Rider Profile 的赛后展示 | 必须 |

---

## 5. 功能清单

### 5.1 Home / Race Gallery

目标：让观众第一眼知道 ARY 是 Agent Racing Yard，并看到当前主推赛事。

必须实现：

- 品牌区：Agent Racing Yard。
- 主推赛事标题、赛题摘要、核心指标。
- Live Race 切换器，至少能切换两个 mock race。
- 进入 Live Hall 的入口。
- 进入 Race Page 的入口。
- 作品 / Rider 精选入口。
- Race Updates / Latest Results / Past Races / Cooperation 信息区。

注意事项：

- 首页必须 Gallery-first，不能变成后台功能索引。
- Login / Console 入口不能抢占主视觉。
- 文案要像真实产品页面，不要像需求说明。

当前可复用：

- `page-home`
- `renderHomeRace`
- `renderHomeLiveSwitcher`
- `restartHomeRaceCarousel`
- Home 相关 CSS

---

### 5.2 Race Page

目标：展示一场 Race 的赛题、状态、赛程和入口。

必须实现：

- Race 标题。
- Race 状态：registration / running / judging / completed 等。
- Challenge brief。
- Schedule：报名、比赛、提交、评审、赛果。
- CTA：进入 Live Hall、查看作品、查看赛果。
- Race 状态卡：报名、赛道、提交、评审、颁奖。

注意事项：

- Race Page 不是说明页，要有赛事现场感。
- Race 是公开端和工作台的核心上下文。
- 如果 race.status 是 completed，CTA 应偏 Results / Review；如果 running，CTA 应偏 Live Hall。

当前可复用：

- `page-race`
- `renderPrototypeData` 中 race 相关渲染逻辑
- `sample-races.json` 中 races 数据

---

### 5.3 Live Hall

目标：展示 Agent Racing 正在发生。

必须实现：

- 当前 Race 标题。
- Riding Signal。
- Riders / Records / Cost / Signals 指标。
- 赛事 track / canvas 视觉。
- Event Stream。
- Current Process Leaderboard。
- 过程榜单说明：它不是最终 Results。

注意事项：

- Live Hall 读取的是 Projection / mock projection，不是原始 CA Session。
- 过程榜单只用于观看，不作为最终赛果。
- 风险、成本、进度要可见。
- 不公开原始 CA Session。

当前可复用：

- `page-live`
- `liveCanvas`
- `drawFrame`
- `drawRiderMarker`
- `drawOverlay`
- `sample-races.json` 中 `liveProjections`

不依赖 D 的独立方案：

- 如果 D 还没给 Projection 数据，前端展示模块可以先在展示代码中建立临时 `fallbackLiveProjection`。
- 字段保持与当前 `sample-races.json.liveProjections` 类似：

```js
{
  raceId: 'bay-area-happy-trip',
  headlineMetrics: [],
  processLeaderboard: [],
  eventStream: []
}
```

后续 D 提供正式 mock schema 后再替换数据来源。

---

### 5.4 Works / Work Page

目标：展示公开作品资产。

Works 必须实现：

- 作品列表。
- Featured Work。
- 作品作者 / Rider。
- 作品所属 Race。
- Work 状态：public / review / private 等。
- Demo / Evidence / Award 摘要入口。

Work Page 建议实现：

- 作品标题。
- 作者 / Rider。
- Race 回链。
- Demo URL / repo / video 等 mock 信息。
- Riding Summary。
- Evidence Summary。
- Judge comment 或 award 摘要。

注意事项：

- 公开端原则上只展示 public / published 内容。
- private / review 内容如果用于 demo，必须标清是 mock 或 internal preview。
- Work 是作品资产，不是单纯提交记录。

当前可复用：

- `page-works`
- `sample-races.json` 中 `works`
- Works 相关 CSS

不依赖 D 的独立方案：

- 先沿用 `sample-races.json.works`。
- 如果需要 Work Page，可从现有 Work card 点击后切换一个详情面板，不必等后端。

---

### 5.5 Results

目标：展示最终赛果。

必须实现：

- Award / Leaderboard。
- 获奖作品。
- 获奖 Rider。
- 分数 / 标签 / 决策理由摘要。
- 进入 Review 的入口。

注意事项：

- Results 读取 Award / leaderboard_read_model / Report，不读 live process leaderboard。
- 必须和 Live Hall 的过程榜单区分。
- 未发布 Results 不应作为公开赛果显示。

当前可复用：

- `page-results`
- `sample-races.json` 中 `awards`
- `renderPrototypeData` 中 results 渲染逻辑

不依赖 D 的独立方案：

- 先使用本地 fallback awards 数据。
- 字段建议：

```js
{
  raceId,
  awardName,
  rank,
  riderName,
  workTitle,
  score,
  decisionReason
}
```

---

### 5.6 Review

目标：展示赛后复盘和评审总结。

必须实现：

- Review Summary。
- Judge comments。
- Featured cases。
- Riding skill highlights。
- 下一场 / 合作入口。

注意事项：

- Review 是赛后资产，不是 Live Hall 事件流。
- Judge comment 要经过公开摘要处理，不展示原始私密评审材料。

当前可复用：

- `page-review`
- `sample-races.json` 中 `reviews`

---

### 5.7 Rider Profile

目标：展示公开的 Rider 能力资产。

必须实现：

- Rider 基础信息。
- 代表作品。
- 参赛记录。
- Award。
- Skill tags。
- Evidence 摘要。

注意事项：

- Rider Profile 只展示公开档案。
- 原始 RidingRecord / CA Session 不应直接公开。
- 能力标签要来自公开 Evidence / Report 摘要，而不是随意编造。

当前可复用：

- `page-rider`
- `sample-races.json` 中 `profiles`

---

### 5.8 Cooperation

目标：承接报名、办赛、赞助合作。

必须实现：

- 参赛报名入口。
- 发起赛事入口。
- 赞助 / 合作入口。

注意事项：

- Cooperation 是公开转化页，不是后台入口。
- 文案要面向外部用户。

当前可复用：

- `page-cooperation`

---

### 5.9 Screen Display

目标：现场大屏展示输出。

必须实现：

- 大字号 Race title。
- 当前模式：Live / Leaderboard / Works / Announcement。
- Riding Signal 或主指标。
- Top riders / leaderboard / featured works / announcement 中至少一种模式。
- 远距离可读。
- 不出现后台控制按钮。

建议实现：

- `screenMode` 状态。
- 四个 mock 模式：
  - Live
  - Leaderboard
  - Works
  - Announcement
- Projection 不可用时 fallback 到公告或静态榜单。

注意事项：

- Screen Display 是输出面，不是控制面。
- 如果有 Screen Console 控制按钮，只能放在控制面或 demo 侧栏中，不能出现在纯展示输出区域。

当前可复用：

- `page-screen`
- `screenCanvas`
- Screen 相关 CSS

不依赖 B/E 的独立方案：

- 展示模块可先在前端展示模块内做一个本地 `screenMode` 切换，模拟控制效果。
- 后续如果 B 做正式 Screen Console、E 做集成，只需把本地状态替换为外部传入。

---

## 6. 和其他模块的对接

这里按“需要确认什么 / 展示模块输出什么 / 当前 mock 方案”写，方便小组同步接口，不预设其他成员一定已经完成。

### 6.1 和 A：Rider 客户端

A 大致负责 Rider 上传、防伪、RidingRecord、个人提交。前端展示模块需要和 A 确认：Rider Profile、Work Page 中哪些字段可以公开展示，RidingRecord 公开到什么粒度，以及防伪标识使用什么公开文案。

展示模块当前输出：Rider Profile / Work Page 所需字段清单，以及公开端只展示 public evidence summary、不展示原始 RidingRecord / CA Session 的边界。

当前 mock 方案：先使用 `profiles`、`works`、`publicEvidenceSummaries`，防伪或可信标识只作为公开摘要文案，不实现真实校验。

---

### 6.2 和 B：ARY 管理系统

B 大致负责 Organizer / Judge / Admin 管理、发布 Results / Report 和权限入口。前端展示模块需要和 B 确认：哪些 Results 已发布、哪些 Review 已发布、哪些 Work 可公开、Screen Console 是否控制 Screen Display。

展示模块当前输出：Results / Review / Screen Display 的展示字段、发布状态规则和公开端可见性要求。

当前 mock 方案：使用 `status: published`、`visibility: public`、completed race 和 published review_summary 判断公开内容；Screen mode 使用本地 demo 控制模拟。

---

### 6.3 和 D：数据 mock / 数据库 / 登录 / RidingRecord

D 大致负责数据 schema、mock data、Projection、赛时 / 赛果、登录、RidingRecord 存储。前端展示模块需要和 D 对齐以下数据对象：Race、Work、Rider profile、liveProjection、Award / Results、review summary、publicEvidenceSummaries、screen feed。

展示模块当前输出：页面字段需求、fallback 规则、哪些字段不能公开展示。

当前 mock 方案字段尽量贴近现有 `sample-races.json`：

```js
const fallbackRace = { id, title, status, summary, challenge, metrics, schedule };
const fallbackWork = { id, title, riderId, raceId, summary, status, visibility };
const fallbackProjection = { headlineMetrics, processLeaderboard, eventStream };
const fallbackAward = { raceId, name, rank, workId, riderName, reason };
const fallbackReview = { raceId, status, summary, judgeComments, featuredCases };
const fallbackEvidence = { raceId, workId, riderId, sourceType, visibility, summary, skillTags };
```

后续 D 提供正式 mock data 后，展示模块应优先替换数据源，不重做页面结构。

---

### 6.4 和 E：汇总整合 / PRD PoC

E 大致负责应用壳、路由接线、QA、demo 和最终说明。前端展示模块需要和 E 确认：当前采用静态原型还是正式前端工程、路由约定、页面入口命名、demo 主路径。

展示模块当前输出：页面入口、运行说明、已实现 / mock / 未实现清单和必要截图材料。

当前 mock 方案：保留 `design-prototype/index.html` 单页切换方式；如果后续有 app shell，只需接入 Home、Race、Live、Works、Results、Review、Rider、Cooperation、Screen 这些入口。

---

## 7. 模块边界

### 7.1 负责范围

前端展示模块负责：

- 公开展示页面。
- 大屏展示页面。
- 展示排版。
- 页面间公开浏览路径。
- 公开端和大屏的 mock 数据消费。
- 展示层 fallback。
- 展示层 UX 走查。

### 7.2 不负责范围

前端展示模块不负责：

- Rider 客户端上传、防伪真实逻辑。
- Organizer / Judge / Admin 管理操作真实逻辑。
- 数据库模型设计。
- GitHub 登录实现。
- RidingRecord 存储设计。
- CAConnection / RidingSignal / Projection 的真实生成逻辑。
- QA 总表、最终 demo 录制、最终 PRD/PoC 总文档。

### 7.3 容易混淆的边界

| 功能 | 展示模块负责什么 | 其他模块负责什么 |
|---|---|---|
| Live Hall | 展示 Projection、event stream、过程榜单 | D 提供 Projection 数据，A 提供 Rider 侧 CA 状态，E 接线 |
| Results | 公开展示最终赛果 | B 负责发布动作，D 提供 Award / Report 数据 |
| Review | 公开展示复盘 | B / Judge 侧负责评审输入，D 提供 review data |
| Rider Profile | 展示公开档案 | A 负责 Rider 客户端证据入口，D 提供 profile/evidence 数据 |
| Screen Display | 展示输出面 | B 可负责 Screen Console 控制动作，D 提供 screen feed，E 集成 |
| Works | 展示公开作品 | A 负责 Rider 提交，D 提供 work 数据 |

---

## 8. 可独立推进方式

为了不被其他模块进度完全卡住，前端展示模块可以按以下方式推进。

### 8.1 使用现有静态原型作为起点

可直接基于：

- `design-prototype/index.html`
- `design-prototype/script.js`
- `design-prototype/styles.css`
- `design-prototype/data/sample-races.json`
- `design-prototype/data/sample-races.js`

先完成公开展示和大屏展示，而不是等待正式工程。

### 8.2 建立本地 fallback 数据

如果 D 的数据还没给，展示模块可以先建本地 fallback 数据，但要注意：

- 字段名尽量贴近 `sample-races.json`。
- 页面不要写死文案到 HTML，可以通过 JS 数据渲染。
- fallback 数据要集中放在一个位置，便于后续替换。
- 明确标注这是展示模块的临时展示数据。

### 8.3 页面先跑通，接口后替换

展示页面结构应以“数据输入对象”为边界：

```js
renderRacePage(race)
renderLiveHall(race, projection)
renderWorks(works)
renderResults(awards)
renderReview(review)
renderRiderProfile(profile)
renderScreenDisplay(screenFeed)
```

这样即使没有后端和正式 mock schema，也可以先让页面跑起来。

### 8.4 不做真实登录和权限

展示页面可以用公开态判断：

```js
visibility === 'public'
status === 'published'
```

不要实现真实权限系统。权限由 B / D 负责。

### 8.5 不做真实 CA 数据生成

Live Hall 和 Screen Display 只消费 Projection：

```text
projection in → display out
```

不要在展示模块里生成真实 CA metrics。Projection 生成由 D 负责。

---

## 9. 当前推进记录

### 第一步：确认现有原型页面

当前检查结果：现有 `design-prototype/index.html` 已经可以作为展示模块起点。原型可通过本地静态服务正常打开，`index.html`、`script.js`、`styles.css` 和 `sample-races.json` 能支撑主要展示页面。

| 页面 | 当前原型状态 | 展示模块判断 |
|---|---|---|
| Home / Race Gallery | 已有 `page-home`，有主推 Race、Live Race 切换、Live / Race / Works / Rider 入口 | 可直接沿用 |
| Race Page | 已有 `page-race`，有赛题、赛程、状态卡和 Live / Works / Results / Review 入口 | 可直接沿用 |
| Live Hall | 已有 `page-live`，有 Riding Signal、Canvas 赛道、Event Stream、Process Leaderboard | 可直接沿用，但要保留“过程榜单不是最终赛果”的说明 |
| Works | 已有 `page-works`，有作品墙和作品卡片 | 可沿用，但公开可见性需要再处理 |
| Work Page | 当前没有独立页面，只有作品卡上的“查看详情”按钮 | 需要补详情页或详情面板 |
| Results | 已有 `page-results`，展示最终奖项和 Review 入口 | 可直接沿用，不能读取 Live Hall 过程榜单 |
| Review | 已有 `page-review`，展示复盘、高光案例、评委摘录 | 可直接沿用 |
| Rider Profile | 已有 `page-rider`，展示 Rider 档案、作品、能力标签 | 可直接沿用，但 Evidence 摘要字段还可以补强 |
| Cooperation | 已有 `page-cooperation`，展示报名、办赛、赞助入口 | 可直接沿用 |
| Screen Display | 已有 `page-screen`，有大屏 Canvas 和关键指标 | 可沿用，但 Live / Leaderboard / Works / Announcement 模式切换仍需补 |

第一步产出：页面检查记录已完成。后续不用从零做页面，优先补 Work Page 和 Screen Display 多模式。

---

### 第二步：整理页面数据需求

展示页面要尽量消费集中数据，不把核心赛事、作品、赛果和 Rider 信息写死在 HTML 里。当前 `sample-races.json` 已经能覆盖大部分展示需求，但仍有少数字段需要先 mock，后续再和 D 对接。

| 页面 | 必需数据 | 当前已有来源 | 需要补充 / 对接 |
|---|---|---|---|
| Home / Race Gallery | `series.title`、`series.subtitle`、`raceGroups.featuredRaceId`、`raceGroups.liveRaceIds`、主推 `race.title`、`race.challenge`、`race.metrics`、`race.primaryCta` | `series`、`raceGroups`、`races`、`liveProjections` | Featured Work / Featured Rider 当前在 `script.js` 里有局部映射，后续最好改成数据字段 |
| Race Page | `race.id`、`race.title`、`race.status`、`race.stageLabel`、`race.summary`、`race.challenge`、`race.schedule`、`race.metrics`、`race.live`、CTA 文案 | `races` | 不同状态下 CTA 规则需要统一：running 去 Live，completed 去 Results / Review，registration 去 Cooperation |
| Live Hall | `race.title`、`race.live.ridingSignal`、`projection.headlineMetrics`、`projection.eventStream`、`projection.processLeaderboard`、同 Race 的 `riders` | `races`、`liveProjections`、`riders` | Projection 异常 / 缺失时的 fallback 文案；不能展示原始 CA Session |
| Works | `work.id`、`work.title`、`work.raceId`、`work.riderId`、`work.status`、`work.visibility`、`work.summary`、`work.demo`、`work.repo`、`work.evidenceRefs`、`work.awardIds` | `works`，并通过 `raceId` 关联 `races` | 当前页面混合展示 private / review / public，需要过滤或标注 mock / internal preview |
| Work Page / 作品详情 | 单个 `work`、关联 `race`、关联 `rider`、Demo / repo / video、Riding Summary、Evidence Summary、Award / Judge comment 摘要 | `works`、`races`、`riders`、`awards` 可拼出基础版本 | 当前没有独立页面；Riding Summary、Evidence Summary、公开 Judge comment 需要 fallback mock |
| Results | `award.id`、`award.raceId`、`award.name`、`award.rank`、`award.workId`、`award.riderName`、`award.reason`、关联 `work`、关联 `race` | `awards`、`works`、`races` | awards 当前没有独立 `published` 字段，可先用 completed race / Review published 作为公开条件 |
| Review | `review.raceId`、`review.status`、`review.summary`、`review.featuredCases`、`review.judgeComments`、关联 Race / Award / Work | `reviews`、`races`、`awards`、`works` | 不展示未发布 report；未发布时要显示 unavailable 或 draft preview |
| Rider Profile | `profile.riderId`、`profile.displayName`、`profile.headline`、`profile.featuredRaceIds`、`profile.featuredWorkIds`、`profile.skillTags`、`profile.stats` | `profiles`、`works`、`races` | Evidence 摘要、公开防伪 badge、公开 RidingRecord 粒度需要和 A / D 对接；可先 mock badge |
| Cooperation | 报名中 race 的 `title`、`status`、`summary`、`challenge`、`metrics.applicants`、`metrics.capacity`、`primaryCta`、`secondaryCta`、安全边界说明 | `raceGroups.registrationRaceIds`、`races` | 办赛 / 赞助合作可以先用静态 mock 文案，不需要真实表单 |
| Screen Display | `race.title`、`projection.headlineMetrics`、`projection.processLeaderboard`、`projection.eventStream`、`screenMode`、announcement、featured works | `races`、`liveProjections`、`works` | 当前没有独立 screen feed / announcement 结构，也没有模式切换逻辑；可先本地维护 `screenMode` 和 fallback announcement |

第二步产出：页面数据需求表已明确。短期不需要等 D 的正式 schema，先按当前 `sample-races.json` 字段推进；后续只要字段名对齐，替换数据源即可。

---

### 第三步：补齐 Work Page / Screen 模式

当前只能算完成了第一轮补丁，不能算展示模块完成，也不能把现有网址当作交付标准。

已补内容：

1. Work Page / 作品详情状态
   - 在 Works 页面补充了 `work-detail-panel` 作品详情面板。
   - 作品卡片的“查看详情”按钮可以打开对应作品详情。
   - 详情内容从 `works`、`races`、`riders`、`awards` 拼出，包括作品标题、摘要、Race、Rider、状态、公开可见性、Demo、Repo、Riding Summary、Evidence 和 Award / Comment 摘要。

2. Screen Display 多模式
   - 在 Screen Display 页面补充了 `screen-mode-panel`。
   - Screen 区域按钮可以本地切换 Live、Leaderboard、Works、Announcement。
   - Announcement 模式补了一条 fallback 文案，说明最终赛果以 Results 发布为准。

审慎复查后的结论：这些修改只是让缺失位置“有东西可点、有内容可看”，还没有达到完整展示前端的标准。现有原型仍然存在页面内容粗、状态规则不完整、公开 / 私有边界不严、Screen Display 控制面与输出面混在一起、多赛事上下文没有打通等问题。后续必须继续修，而不能把“能打开、能切页、按钮能点”当成完成。

下一轮必须优先修：

1. Works 默认不能把 private / review 作品当公开作品展示。
2. Screen Display 页面不能把控制按钮放进纯大屏输出面。
3. Home 切换 live race 后，Race Page / Live Hall / Screen Display 的上下文必须跟着切换，不能仍固定在 `featuredRaceId`。
4. Race Page 需要按 registration / running / judging / completed 状态动态组织 CTA 和导航。
5. Results / Review 需要按 published 状态展示，不能只写死创世赛样例。
6. Rider Profile / Work Page 需要保留 Race 回链，并展示公开 Evidence 摘要，而不是只有占位文字。

---

### 第四步：统一展示状态

已按原文档重新收紧第一轮公开展示规则。依据来自 `docs/ary-mvp.prd.md`、`docs/ary-mvp.ia.md` 和 `docs/ary-domain-analysis.v0.3.md`：公开端只展示已公开 Work、已发布 Award、已发布且公开可见的 Report / Review 摘要和公开 Rider Profile；Projection 只服务 Live Hall / Screen Display 的过程展示，不作为最终结果事实源。

本轮已修：

- Works 默认只展示 `visibility === 'public'` 且 `status === 'published'` 的作品。
- private / review 作品不再混入公开作品墙，只在右侧公开边界说明中统计为“未公开”。
- Work Detail 只允许打开公开已发布作品；没有公开作品时显示 unavailable 状态。
- Results 改为读取 completed race 下已发布 Review 对应的 Award 数据，不再把过程榜单当最终赛果。
- Review 改为只展示 `status === 'published'` 的 review summary；未发布 Review 不进入公开端。
- Screen Display 的 Works 模式只读取公开作品。

当前收尾状态：

- Race 上下文已完成第一轮联动：Home 选择的 Race 会同步更新 Race Page、Live Hall、Works 和 Screen Display。
- Race Page 已完成第一轮状态化：registration / running / judging / completed / upcoming 会影响 CTA、状态卡、内容重点和右侧内部导航；未发布 Results / Review 不进入公开导航；Rules / Schedule 已补充阶段摘要和公开展示规则。
- Results / Review 已完成第一轮多场已发布赛事切换：公开端只列 completed 且有 published review_summary / Award 的赛事，切换后 Results 和 Review 保持同一 Race 上下文，并继续强调 Award / Report 不读取 Projection。
- Screen Display 已完成第一轮边界修正：左侧 `screen-output` 作为纯大屏输出面，右侧改为 `screen-demo-control` 原型演示控制区，并明确不属于正式 Screen Display 输出面。后续如果接 B / E 的 Screen Console，再把 demo 控制替换为正式控制入口。
- Rider Profile / Work Detail 已完成第一轮公开 Evidence 摘要修正：页面基于公开 Work、Award、公开 Evidence 摘要和能力标签生成，保留 Race / Work 回链，不展示原始 Session，也明确 `rider_report` 默认不公开。

后续深化项：已补充更真实的 `publicEvidenceSummaries` mock 数据，并让 Work Detail / Rider Profile 读取公开 Evidence 摘要。本轮还补充了更多 completed race 的公开 Work、Award、Review featured cases 和 Evidence summary；Home 的 Latest Results 已改为从 published Results 动态生成，Results 页面也会展示 Award 关联作品、Rider 和 public Evidence 摘要。若还有时间，可以继续补移动端适配和人工视觉走查截图。

---

### 第五步：准备展示模块同步材料

用于小组同步时，建议提供：

- 展示模块页面入口。
- 展示模块运行说明。
- 展示模块已实现 / mock / 未实现三列表。
- 展示模块截图。
- 展示模块已知限制。

---

## 10. 已实现 / mock / 未实现同步口径

这部分用于给 E 汇总或给其他成员对齐，不是最终提交说明。

### 已实现

- Home / Race Gallery：主推赛事、Live Race 切换、Race / Live / Works / Rider 入口。
- Race Page：按 Race status 展示 CTA、状态卡、Rules / Schedule、公开导航。
- Live Hall：展示 Projection、Event Stream、Process Leaderboard 和 fallback。
- Works：只展示 public + published 作品。
- Work Page：以作品详情面板展示公开作品、Race、Rider、Award 和 Evidence 摘要。
- Results：支持多场 completed + published race 切换，展示 Award、Work、Rider 和 public Evidence 摘要。
- Review：展示 published review_summary、Judge comments、Featured cases 和公开 Evidence 摘要。
- Rider Profile：展示公开作品、Race 回链、Award、Skill tags、public Evidence 摘要。
- Cooperation：保留参赛 / 办赛 / 合作入口。
- Screen Display：左侧为纯展示输出面，右侧仅为 prototype demo control。

### mock

- Projection 数据：使用 mock / fallback。
- Awards 数据：使用 expanded mock，已覆盖多场 completed race 的 published Awards。
- Review Summary：使用 expanded mock，已覆盖多场 completed race 的 published review_summary。
- Public Evidence Summary：使用 `publicEvidenceSummaries` mock，并已接入 Work Detail / Rider Profile / Results。
- Screen mode：使用前端本地状态模拟。

### 未实现 / 待其他模块确认

- 真实后端接口。
- 真实登录权限。
- 真实 CA 接入。
- 真实 Report Generator。
- 真实 Screen Console 远程控制。
- Rider 客户端的真实上传、防伪和 RidingRecord 存储。
- 管理系统里的发布动作、权限控制和评审操作。

---

## 11. 对齐时最需要确认的问题

1. D 的 mock schema 是否沿用当前字段：`races`、`works`、`liveProjections`、`awards`、`reviews`、`profiles`、`publicEvidenceSummaries`。
2. B 的管理系统如何表达发布状态：哪些 Work / Results / Review 可以公开。
3. A 的 Rider 客户端哪些字段允许进入公开 Work Page / Rider Profile。
4. E 的应用壳采用静态原型接线，还是迁移到正式前端工程。
5. Screen Display 的正式控制入口由 B 的 Screen Console 还是 E 的集成壳接管。

---

## 12. 最应该避免的误解

1. 不要把 Live Hall 的过程榜单写成最终赛果。
2. 不要在公开页面展示原始 CA Session 或完整 RidingRecord。
3. 不要把 private / review / unpublished 内容当成公开内容。
4. 不要把 Screen Display 做成后台页面放大版。
5. 不要依赖真实后端才能展示页面。
6. 不要在展示模块里设计数据库 schema；只提出字段需求。
7. 不要实现 Organizer / Judge / Rider 的操作逻辑；只展示公开结果和公开状态。
8. 不要等 D 的最终数据模型，先用 fallback 数据推进页面。

---

## 13. 最终对齐目标

希望其他成员打开页面或看本文时，能直观看到：

```text
ARY 是一个可观看的 Agent Racing 平台。
它有赛事首页、单场赛事页、Live Hall、作品墙、赛果、复盘、骑手档案和现场大屏。
这些页面能用 mock 数据跑通，并且不会把过程数据、最终赛果、私有证据和后台操作混在一起。
```
