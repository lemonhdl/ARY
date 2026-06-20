# C-Frontend 当前交付复审（2026-06-20）

审查对象：`deliverables/c-frontend/` 当前交付（文档 + `app-shell/`）

结论：C-Frontend 这次交付**不是空壳**。它已经交出了完整的 handoff 文档集合、可运行的高保真前端原型壳，以及 GRS-001 / GRS-002 的复用资产；我本地直接打开 `app-shell/prototype/index.html` 后，Home、Works、Results、Screen 等主路径都能跑起来。从“能不能开始集成”看，答案是：**可以开始**。但从“是否已经达到 E 只换数据源、不改页面结构就能直接接进当前产品壳”的标准看，答案是：**还没有**。当前交付更准确的定位是“可演示、可讨论、可作为集成起点的前端壳”，而不是“已经具备正式 adapter 接缝的最终集成壳”。

按最初分工 spec 对齐当前完成度，我给 C-Frontend 一个大约 **70% 到 75%** 的完成度判断。它已经值得开始集成，但还需要继续完善 adapter 边界、路由落地和 demo 数据对齐，才能把集成成本真正压下来。

## Findings

### 1. 高优先级：原型脚本仍直接绑定 `window.ARY_SAMPLE_DATA`，没有把文档里的 adapter 契约落成可执行代码边界

- `adapter-contract.md` 要求 C 壳只消费 adapter 输出，E 只替换输入，不改 DOM 结构，见 [deliverables/c-frontend/adapter-contract.md](../deliverables/c-frontend/adapter-contract.md)。
- 但当前原型脚本一开始就直接读取 `window.ARY_SAMPLE_DATA`，并在后续用 `sampleData.races / works / reviews / awards / caConnections` 贯穿整个页面渲染，见 [deliverables/c-frontend/app-shell/prototype/script.js](../deliverables/c-frontend/app-shell/prototype/script.js#L1) 和 [deliverables/c-frontend/app-shell/prototype/script.js](../deliverables/c-frontend/app-shell/prototype/script.js#L17)。
- `shell-readme.md` 也明确说明当前原型通过 `prototype/data/sample-races.js` 作为 browser bridge 运行，而不是读取组装后的运行时 view，见 [deliverables/c-frontend/shell-readme.md](../deliverables/c-frontend/shell-readme.md)。

影响：这意味着当前 adapter 契约主要停留在文档层，而没有变成真正的可执行接缝。E 如果要把它接进当前单机产品壳，仍然需要改脚本数据入口，而不是只替换输入对象。

### 2. 中优先级：`route-map.json` 声称已有多路由页面，但实际交付仍是单个 `index.html` 的面板切换壳，没有落实到真正的页面入口或 deep-link 行为

- `route-map.json` 把 `/race/:raceId`、`/live/:raceId`、`/works/:workId`、`/results/:raceId`、`/review/:raceId`、`/screen/:raceId` 等都声明成正式 route，见 [deliverables/c-frontend/route-map.json](../deliverables/c-frontend/route-map.json)。
- 但当前 `app-shell/prototype/` 实际只有一个 [deliverables/c-frontend/app-shell/prototype/index.html](../deliverables/c-frontend/app-shell/prototype/index.html) 入口文件，页面切换主要依赖 `data-page` 按钮和 `data-page-panel` 面板切换，见 [deliverables/c-frontend/app-shell/prototype/index.html](../deliverables/c-frontend/app-shell/prototype/index.html#L14) 和 [deliverables/c-frontend/app-shell/prototype/script.js](../deliverables/c-frontend/app-shell/prototype/script.js#L8)。
- 当前我直接打开文件后看到的也是单页原型导航，而不是可单独进入的真实路由入口。

影响：文档里的 route 设计已经有了，但实现面还停留在“单页原型演示”阶段。E 可以开始集成，但必须额外补路由包装或页面入口映射，不能把这份交付当作已经完成的 route-ready shell。

### 3. 中优先级：原型 demo 数据仍保留旧口径 `connected`，和当前共享字段字典及运行时枚举不一致

- 共享字段字典当前权威枚举是 `not_configured / registered / handshaken / active / failed / disabled`，见 [todos/10-Shared-Field-Dictionary.md](../todos/10-Shared-Field-Dictionary.md#L33)。
- 但 c-frontend 原型 demo 数据里仍然保留 `status: "connected"`、`aggregateIngestionStatus: "connected"` 等旧值，见 [deliverables/c-frontend/app-shell/prototype/data/sample-races.js](../deliverables/c-frontend/app-shell/prototype/data/sample-races.js#L701) 和 [deliverables/c-frontend/app-shell/prototype/data/sample-races.js](../deliverables/c-frontend/app-shell/prototype/data/sample-races.js#L723)。

影响：这不会阻止今天开始集成，但会降低这份 demo 数据作为 fallback / smoke 数据的可信度，也会让 C 壳在接正式运行时前继续携带过期语义。

## What Passed

- `handoff.manifest.json`、`route-map.json`、`page-dependencies.json`、`adapter-contract.md`、`fallback-rules.md`、`shell-readme.md` 和 `app-shell/` 都已交齐，满足 [todos/03-C-Frontend-Shell.md](../todos/03-C-Frontend-Shell.md#L106) 的最小产物清单。
- `app-shell/prototype/` 不是空目录，确实包含可打开的 `index.html`、`script.js`、`styles.css`、`data/` 和 `assets/`。
- 原型壳不是静态截图：我实际打开 [deliverables/c-frontend/app-shell/prototype/index.html](../deliverables/c-frontend/app-shell/prototype/index.html) 后，Works、Results、Screen 页面都能切换并渲染。
- 公开态过滤意识是存在的。脚本里至少已经实现了 `isPublicWork()`，并用它过滤公开作品，同时 Results / Review 也显式按已发布条件渲染，见 [deliverables/c-frontend/app-shell/prototype/script.js](../deliverables/c-frontend/app-shell/prototype/script.js#L67)、[deliverables/c-frontend/app-shell/prototype/script.js](../deliverables/c-frontend/app-shell/prototype/script.js#L137) 和 [deliverables/c-frontend/app-shell/prototype/script.js](../deliverables/c-frontend/app-shell/prototype/script.js#L148)。
- `legacy-reuse/` 目录也已带上 GRS-001 / GRS-002 复用资产，不是只有文字说明没有材料，见 [deliverables/c-frontend/app-shell/README.md](../deliverables/c-frontend/app-shell/README.md)。

## Run/Test 结果

我实际执行了以下验证：

1. 目录与文档核对
   - 确认 `deliverables/c-frontend/` 已包含 spec 要求的全部 handoff 文件与 `app-shell/`。
2. 原型可运行性验证
   - 直接打开 `deliverables/c-frontend/app-shell/prototype/index.html`。
   - 结果：页面能成功加载。
3. 浏览器主路径切换验证
   - 点击 `Works`
   - 点击 `Results`
   - 点击 `Screen`
   - 结果：三者都能切换并渲染，说明当前原型确实是可演示壳，而不是静态稿。
4. 代码侧核对
   - 确认当前脚本仍直接消费 `window.ARY_SAMPLE_DATA`，未看到对当前产品壳 `/api/runtime/assembled-view` 或等价 adapter runtime 的接入实现。

## Overall Assessment

- 如果看“C-Frontend 有没有交东西、是不是能本地演示”，答案是：**有，而且能演示**。
- 如果看“这套壳是否已经变成可直接喂运行时数据的最终集成壳”，答案是：**还没有**。
- 更准确的判断是：**C-Frontend 已达到可开始集成的成熟度，但当前更像高保真可运行原型壳，而不是已完成 adapter 边界与 route 落地的正式产品壳。**

## Completion Assessment

- 相对于 [todos/03-C-Frontend-Shell.md](../todos/03-C-Frontend-Shell.md)，当前完成度约为 **70% 到 75%**。
- 文档交付面和原型展示面完成度较高。
- 真正拉低完成度的主要不是“页面没做”，而是**集成边界还没有真正代码化**。

## Direct Integration Judgment

- **可以开始集成。**
- 但这不是“直接挂进当前产品壳即可收工”的状态，而是“可以由 E 现在开始接线、抽 adapter、落路由”的状态。
- 最合理的策略是：**不要等 C 组再提一轮新提交才开始接；直接由我们自己把这套壳往当前 `app/web/public/`、`app/web/live/`、`app/web/screen/` 方向接进去，同时把下面的完善点一并关闭。**

## Continue Improving

1. 把 `window.ARY_SAMPLE_DATA` 抽成真正的 adapter 输入边界，至少让页面入口先消费一个统一 runtime model，而不是直接散读 demo 数据对象。
2. 把 `route-map.json` 中声明的页面路径落成真实可进入的 route 入口，或明确由 E 提供路由包装层，但不能长期停留在单页按钮切换状态。
3. 把 `prototype/data/sample-races.js` 里的旧枚举 `connected` 收敛到当前共享字段字典口径，避免 fallback 数据继续漂移。
4. 把当前 `app-shell/prototype/` 的数据读取边界和 `adapter-contract.md` 对齐，至少实现一个最小桥接层，使 E 替换 `assembled-view` 输入时不需要重写页面渲染逻辑。
5. 进入当前产品壳后，再补一轮 Public / Live / Screen 的运行时回归，确认不只是 file:// 原型能跑，而是单机 Web 路由也能跑。

## Recommended Next Steps

1. 立即开始集成，不必等待 C-Frontend 新提交。
2. 集成时优先处理 adapter 输入边界和 route 落地，而不是先改视觉或重做页面结构。
3. 等最小接线完成后，用 `runtime-data/assembled-view.json` 替换 demo 输入，做一轮 Public / Live / Screen 的浏览器回归，再决定是否还需要 C 组补专门提交。
