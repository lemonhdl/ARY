# 数据映射与对接说明（data-mapping-notes）

本文给 C(前端)、E(集成)和复核者讲清:`authority-mock.json` 如何映射到页面、如何被 E 接线、
公开/可见性如何过滤,以及 D 的关键设计取舍。

## 1. D 在单机架构中的位置

```
source/ (PostgreSQL + generator)  ──离线──►  exports/authority-mock.json
                                                     │  同步发布(单一来源)
                                                     ▼
                              deliverables/d-data/authority-mock.json   ◄── D 的运行时主入口
                                                     │  由 E 的 setup/assemble 消费
                                                     ▼
                              runtime-data/authority-mock.json  ──►  assembled-view.json  ──►  app/adapter  ──►  页面
```

要点(对齐 `todos/19` §3.4、`todos/20` §4.4):

1. 数据库与 generator 是**离线工具层**,不是第一轮启动前置。
2. `deliverables/d-data/authority-mock.json` 是 D 交给运行时的**主入口**。
3. D **只改 `deliverables/d-data/`**;`runtime-data/`、`scripts/`、`app/` 由 E 接线。

## 2. 给 E 的接线说明（关键,避免「合不起来」）

当前 `scripts/setup-runtime.js` 在 `runtime-data/authority-mock.json` 不存在时,从
`design-prototype/data/sample-races.json` 复制初始占位。**D 就绪后,正确做法是让运行态来源指向 D 的交付**。
建议 E 二选一(均**不需要** D 改任何运行态目录):

- **方案 A(推荐,改动最小)**:把 `deliverables/d-data/authority-mock.json` 复制/软链为
  `runtime-data/authority-mock.json`(在 `setup-runtime.js` 中将 `sourceMockPath` 指向 D 的交付)。
- **方案 B**:在 `assemble.js` 中以 D 的文件为基底,叠加 A/B handoff 后写出 `assembled-view.json`。

兼容性保证:本文件顶层键完全包含 `assemble.js` 读取的
`races / liveProjections / works / awards / reviews / profiles / dashboard`,以及 `app/adapter` 读取的
`races[].{id,title,status,summary}` 与 `dashboard.{totalUsers,activeRaces,systemHealth}`——**已用真实 adapter 联检通过**。

## 3. 页面 → View 映射（给 C）

| 页面 | 读取的 authority-mock 键 | 过滤约定 |
|---|---|---|
| Home / Race Gallery | `races` | featured=`bay-area-happy-trip`;Gallery-first |
| Race Page | `races`(by id)+ `works/results/reviews`(by raceId) | 公开端按下方规则过滤 |
| Live Hall | `liveProjections`(by raceId) | 只用 projection + 脱敏事件流,**不读原始 CA Session** |
| Works / Work Page | `works` | **只显示 `visibility==='public'`** |
| Results | `results`(或 `awards` by raceId) | 只显示 `published===true` |
| Review | `reviews`(by raceId) | 只显示 `published===true` |
| Rider Profile | `profiles`(by riderId) | 只显示 `isPublic===true`,无原始骑行/CA |
| Cooperation | `races` + 静态文案 | — |
| Admin 摘要 | `dashboard` / `projectionStatuses` / `caStatuses` / `auditLogs` | 管理端可见全量(含非公开) |
| Screen Display | `liveProjections` / `results` | 同 Live/Results 过滤 |

## 4. 发布态 / 可见性过滤(对齐 `todos/11`)

D 在权威 mock 里**给齐了公开判定所需字段**,过滤动作由消费方(C 页面 / E 装配)执行:

| 资源 | 进入公开端的条件 | authority-mock 判定字段 |
|---|---|---|
| Work | `visibility==='public'` | `works[].visibility` / `works[].isPublic` |
| Result | `published===true`(等价 `publicationStatus==='published'`) | `results[].published` / `results[].publicationStatus` |
| Review / Report | 已发布且公开可见 | `reviews[].published`、`publishedArtifacts[].status==='published'` |
| Rider Profile | 公开档案,且不含原始 RidingRecord / CA Session | `profiles[].isPublic`(profiles 本身已脱敏) |

> `works` 故意是**全量**(含 private/review/hidden),以同时服务管理端;**公开端必须主动过滤**。这是有意设计,
> 不是泄露——D 的职责是「给齐判定字段」,E/C 的职责是「按规则过滤」。已用脚本验证公开视图
> (`results/reviews/profiles/liveProjections`)不引用任何非 public/未发布内容。

## 5. 关键设计取舍(诚实,对齐 `todos/04` §10)

1. **PK 用可读字符串 ID**(如 `work-bay-area-happy-trip-001`)而非 uuid:利于 diff 与跨组对账。
2. **前端导出是「对齐前端实际读取字段」**,不是 core 对象逐键全等:View 是面向页面的投影。
3. **`verify` 覆盖可落库强制的 12 条核心不变量**,不是全部业务规则。
4. **`ca_connections.public_key_fingerprint` 等是实现扩展字段**,非前端必需。CA 健康枚举以
   `todos/10-Shared-Field-Dictionary.md` 的 `CAConnectionHealth`
   (`not_configured/registered/handshaken/active/failed/disabled`)为**最终权威**——它是 `04-D` §11 列为
   「必须先读」的更高优先级共享契约。`docs/ary-ca-integration-spec.md` 的 `ingestionStatus`
   (`not_configured/connected/active/failed`)是更早口径,在握手态命名上与共享字典存在已知差异
   (旧 spec 的 `connected` ≈ 共享字典的 `handshaken/active`);冲突时一律以共享字典为准。
5. **`races[].metrics` 是策划展示聚合数**,与详细行的代表子集刻意不强行相等(见 coverage-report §3)。
6. **`works` 同时承载公开与非公开作品**,以一份数据服务公开端与管理端,避免维护两份。

## 6. A/B handoff 注入点（给 E）

`handoff.manifest.json` 的 `consumes` 已声明 D 期望从 A、B 读取的样例。注入语义:

- A 的 riding events / ca-status / signature → 覆盖/补齐 `liveProjections[].eventStream`、`caStatuses`、
  riding_signals 的 `signature`。
- B 的 dashboard / projection-status / published-artifacts / audit-log → 覆盖/补齐
  `dashboard`、`projectionStatuses`、`publishedArtifacts`、`auditLogs`。

注入时以 `todos/11` 发布/可见性规则为准做校验;**未发布内容不得进入公开端**,缺失上游时回退到 D 的占位并在
E 的 fallback-report 标注 `degraded`。

## 7. 重新生成 / 校验

```bash
cd deliverables/d-data/source
python generate.py       # 重算 authority-mock.json / relational-mock.json / seed.sql
python manage.py verify  # 12 条不变量校验
```
