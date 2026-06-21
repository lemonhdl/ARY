# STATUS

本文是 ARY 任务瞬时看板，记录当前任务状态、证据和风险。不记录历史流水。

## 当前结论

* 项目处于 MVP 文档基线与架构前准备阶段。
* 业务文档已集中到 `docs/` 下。
* 当前正式项目任务定义入口是 `docs/ary.plan.md`。
* `PRD-TEMP-1` 已完成首轮整改，报名、RaceProject 自动生成、CAConnection 动态接入和评审前风险提示的新口径已同步到主要文档和高保真原型。
* `UX-1` 已产出第一轮高保真原型和设计说明，但尚未评审验收，不能直接进入 `M2` 或启动架构设计。
* 当前仓库已具备最小可运行 Node.js 单机应用骨架、运行时装配脚本、handoff 校验脚本和多组产品壳入口，已进入“持续集成验收与收尾”阶段，而不再只是文档 / 原型材料阶段。
* 已对 `tasks/` 下 4 份小组分工文档完成一轮合理性复核，并新增补充建议与整合方案，作为后续“可运行产品壳 + 联调”输入。
* 已新增共享字段字典初稿，开始把前端原型、管理端需求、Rider 事件和数据导出收敛到统一 view model。
* 已新增真实交付状态清单，明确当前最可用资产是文档基线 + 高保真原型 + 原型样例数据，A/B/D 组仍需补最小可提交样例或实现产物。
* 已新增发布态与可见性规则初稿，开始统一 Works、Results、Review、Rider Profile 和 Live Hall / Screen Display 的公开判断口径。
* 已在 `todos/` 下生成可分发执行的新任务包：5 份个人分工文档 + 5 份公共契约文档，统一了交付路径、权威 mock、产品壳、adapter 和 handoff manifest 规范；其中 `todos/01-04` 已改为保留原始四份分工文档的详细正文，而不是摘要版任务提纲。
* 已在 `todos/` 下新增统一架构图 / 组件图文档，可直接用于说明 A/B/C/D/E 五组职责、handoff 流程、authority mock、adapter 和公开边界。
* 已补充单机 monorepo Web 应用技术路线决策：第一轮实现默认收口为单进程 Web 应用，优先使用原生 HTML/CSS/JS 和 Node.js 原生能力，避免把数据库和重框架变成部署前置条件。
* 已补充 monorepo 目录骨架与最小启动命令约定，开始把“简单实现与部署”从原则推进到具体目录和脚本契约。
* 已创建最小可运行 Node.js 单机骨架：零第三方依赖，包含 `package.json`、原生 HTTP server、`app/web/` 页面占位、`scripts/` 装配脚本和 `runtime-data/` 运行态目录。
* 已补充 Windows 启停脚本 `start-web-app.bat` / `stop-web-app.bat`，通过 `runtime-data/web-app.pid` 管理单机 Web 应用进程，并默认输出启动日志。
* 已创建 `deliverables/` 统一交付目录骨架，并为 A-E 五组预置 manifest 模板，后续可直接按目录填充真实产物供自动集成读取。
* 已补充 monorepo 目录 ownership 约定：A-D 默认只改各自 `deliverables/` 目录，E 负责 `app/`、`scripts/`、`runtime-data/` 接线与装配，降低多人并行修改同一运行时代码目录的冲突。
* 已完成 B-Admin 最新提交 `21e7e38` 的复审：上一轮“未接入 / 未装配 / 用户页空表”的高优先级问题已关闭，但系统配置页交互失效、审计日志 `profile_update` UI 支持不完整、维护页缺少 CA 接入状态详情，以及样例数据内部冲突仍待修复。
* 已完成 D-Data 提交 `d277698` 与 B-Admin 提交 `8d520d3` 的复审：D-Data 交付本身可生成且 12 条不变量校验通过，当前判断完成度约 85% 到 90%，无需因其本身再开一轮返工；现已由 E / 集成侧完成 authority mock 主源接线，运行时装配已优先消费 `deliverables/d-data/authority-mock.json`。B-Admin 本次提交仅包含运行态生成物与日志/pid，不构成新的功能交付。
* 已完成 B-Admin 当前交付复审并继续由集成侧补齐运行壳：配置页本地开关、审计日志 `profile_update` 筛选、Dashboard 接入异常列表 / Report 风险提醒、维护页批量重算 / 重算历史 / Report 失败原因 / 已审核动作，以及运行时 `caStatuses` 枚举收敛均已完成；`deliverables/b-admin/ca-status.sample.json` 中残留的旧口径 `connected` 也已清理。当前 B-Admin 已进入可直接集成收工状态。
* 已完成运行时 `caStatuses` 来源优先级清理：装配链路现以 D-Data 的 `CAConnectionHealth` 为权威枚举，并在运行态中把旧口径 `connected` 收敛为 `handshaken`；管理端维护页已同步按共享字段字典渲染，不再展示旧状态值。
* 已形成 B-Admin / D-Data 最终集成收工说明：当前运行时主源已切到 D-Data，B-Admin 运行壳与样例枚举也已收口；关键 admin 路由与 runtime API 均返回 `200`，当前口径可收敛为“无需等待 B / D 新提交，可直接进入最终集成验收”。
* 已完成 B-Admin 最新提交 `5ffac20` / `dc98f31` 的复审与重新并入：最新增量本身没有新增上游 blocker，真正问题是 `app/web/admin/dashboard.html` 与 `app/web/admin/maintenance.html` 在合流时残留冲突标记。当前已由 E / 集成侧就地解决，并保留了最新 B 增量与既有 A-Rider 维护页区块；Dashboard / 维护页路由实测均返回 `200`，当前 B-Admin 再次回到可直接收工状态。
* 已完成 Admin 维护页关键动作真实持久化：`app/web/admin/maintenance.html` 现已接入当前管理员选择器与本地会话，`Projection` 单项 / 批量重算、`Report` 重跑 / 标记已审核、Work / Rider Profile 可见性变更，以及 CAConnection 异常标记都已通过后端写口落盘到 B-Admin 样例数据，并追加对应审计日志；服务端验证和维护页 / 审计页回归已通过，验证产生的样例变更已清理回原始基线。
* 已完成 A-Rider 最新提交复审与集成收口：A 组已关闭上轮最核心的握手 / 密钥归属矛盾，`register-handshake.contract.json` 已明确为服务端生成 Ed25519 密钥对并下发私钥给 DCR；集成侧也已继续完成剩余收口，把 `session-fetch.contract.json` 收窄回 `claude_code`、清理 `signature-samples.json` 中残留的真实化示例表达，并将 A-Rider 样例、contract 与文档装配进 `runtime-data/assembled-view.json`。当前 app 已暴露 `/api/runtime/a-rider*` API，并在 Admin 维护页增加 “A-Rider 回放与接入验收” 区块，A-Rider 当前已进入可直接最终验收与收工状态。
* 已完成 A-Rider 最新提交 `e942ccb` / `d0364da` 的复审与重新并入：本轮新增的 `proxy-source/`、`one-api-source/` 与 One API 集成说明此前未进入正式 handoff / runtime / 管理端可见面，现已由集成侧补齐到 manifest、`assembled-view` 与维护页 A-Rider 区块；随后又补齐 `ca-status`、`docs`、`source-bundles` 三个 runtime endpoint，并将状态样例、文档摘要和源码包摘要渲染进 app。当前 A-Rider 任务包要求的交付物已全部进入可访问集成面。
* 已补完成 A-Rider 最终人工验收留痕：运行中 app 已实测通过 A-Rider runtime summary API、contracts API、ca-status/docs/source-bundles API、One API 集成说明装配，以及 Admin 维护页 “A-Rider 回放与接入验收” 区块渲染；当前 A-Rider 已具备“主流程已集成且有人工收工证据”的口径。
* 已完成 DCR 本地运行口径澄清：仓库文档现已明确区分 A 组源码回放原型端口 `3737/3738` 与 Windows 已安装桌面壳的统一入口 `127.0.0.1:4302`；现场健康检查与页面验证均已证明桌面壳当前应以 `4302` 作为排障判据。
* 已完成 C-Frontend 当前交付复审：文档与 `app-shell/` 产物齐全，原型壳可本地运行并能切换 Works / Results / Screen；但当前脚本仍直接绑定 `window.ARY_SAMPLE_DATA`，route-map 也尚未落成真实产品壳路由入口。当前判断完成度约 70% 到 75%，可以开始集成，但仍需继续完善 adapter 边界与路由落地。
* 已完成 C-Frontend 首轮产品壳接线：当前 `app/web/public/`、`app/web/live/`、`app/web/screen/` 已不再是占位页，而是通过运行时 bridge 复用 `deliverables/c-frontend/app-shell/prototype/` 原型，并接入 `/api/runtime/assembled-view`；浏览器已验证三处入口可打开，其中 `/screen/` 已收敛为纯展示输出面。
* 已完成 C-Frontend 第二批公开 route 接线：`/race/:raceId`、`/works/:workId`、`/results/:raceId`、`/review/:raceId`、`/riders/:riderId` 与 `/cooperation` 均已落入产品壳入口页，并通过 loader 绑定到对应原型 panel 与资源上下文；浏览器已验证关键 URL 可直接进入对应页面。
* 已完成 C-Frontend 站内 URL 同步：当前从 Public 首页点入 Race、从 Race 点入 Live、从 Results 切换到 Review，以及浏览器 Back 回退，都已能同步 pathname 与页面 panel，不再只停留在原型内部 hash / 面板切换层。
* 已完成 C-Frontend 最新提交 `7685d6b` 的复审、产品壳 API 化收口与本地修复：C 组已把显式 route / CTA contract 收回到 `deliverables/c-frontend/app-shell/prototype/script.js`，`window.ARY_C_FRONTEND` 现已支持 Home race、Works filter、Work detail、Rider、Results / Review 和 Screen mode 的公开状态驱动；E 侧也已将 `app/web/shared/c-frontend-loader.js` 收口为消费公开 API，不再继续扩大 monkey patch 面积。浏览器已验证首页 live race 切换会稳定写回 `/public/?raceId=...#home`，Works / Screen / Work detail 的路径也能由公开 API 正常驱动，Back / Forward 也可在壳层回放。由于当前没有时间再返给 C 返工，E 已直接修复 Results / Review 对 `archived` 但已发布赛事的错误排除；`/results/genesis-dogfood-race` 与 `/review/genesis-dogfood-race` 现已稳定渲染“创世骑行挑战赛”。当前口径已可收敛为：C-Frontend 不再需要等待新提交，可继续进入最终集成验收与收工。
* 已补完成 C-Frontend 最终人工验收留痕：本机浏览器已逐项验证 Public、Live、Works、Results、Review、Riders、Cooperation、Screen 的直达渲染，以及 Results -> Review -> Back 的站内跳转与回退；当前 C-Frontend 已具备“主流程已集成且有人工收工证据”的口径。

## 任务看板

| 任务 | 状态 | 当前判断 | 证据 / 下一入口 |
| --- | --- | --- | --- |
| `PRD-1` 文档基线与范围确认 | 进行中 | 业务文档已集中到 `docs/`，当前已新增分工复核、集成建议、共享字段字典、真实交付状态清单、发布态 / 可见性规则、`todos/` 任务包，以及 `deliverables/` 交付骨架与 manifest 模板；`todos/01-04` 已改为直接保留原始详细分工内容并追加集成约束，并新增统一架构图 / 组件图、单机 monorepo Web 技术路线决策、目录骨架 / 启动契约文档，以及“各改各目录”的 ownership 约定，下一步按统一目录填充真实交付并进入自动集成。 | `docs/README.md`、`docs/ary.plan.md`、`tasks/ARY-integration-plan.review.md`、`tasks/ARY-shared-field-dictionary.md`、`tasks/ARY-delivery-reality-checklist.md`、`tasks/ARY-publication-visibility-rules.md`、`todos/README.md`、`deliverables/README.md` |
| `PRD-TEMP-1` 报名 / RaceProject / CA 参赛语义整改 | 待复审 | 已完成首轮文档和原型整改：Registration approved 自动生成 RaceProject、参赛中可新增 CAConnection、CA 接入异常进入评审前风险提示而非硬门禁。需复审是否并入正式 `PRD-1` 基线。 | `docs/registration-ca-rules-alignment.taskbook.md`、`docs/ary-mvp.prd.md`、`docs/ary-domain-analysis.v0.3.md`、`design-prototype/` |
| `UX-1` UX/UI 高保真原型与设计基线 | 进行中 | 高保真原型已按 IA 重构为 1080P 高密度蓝白竞赛风格页面，并接入样例赛事数据驱动主要页面；页面可见文案已清理 PRD / 实现说明口吻，二级页面口号式大标题已降级为对象名和状态摘要；本轮已按明确审查标准修正首页 IA：Public Header 收敛为 Races / Works / Riders / Cooperation，Race 子页面入口回到具体 Race/赛果模块，底部快捷菜单移除，Hero 与 Featured Race 合体，Latest Results / Past Races 去重，开放报名 / 合作入口命名明确，首页独立 Leaderboards / Live Skill Board 已撤销，未登录态只显示 Login；最新 C-Frontend 提交已把 route / CTA contract 收回到 C 自身原型，E 侧也已恢复 API 化集成并直接修补了 Results / Review 对 archived 已发布赛事的错误排除，当前主流程已进入收尾验收阶段。 | `docs/ux-hifi.taskbook.md`、`.agents/skills/hifi-ui-page-workflow/SKILL.md`、`design-prototype/index.html`、`design-prototype/README.md`、`reviews/c-frontend-7685d6b.review.md`、`reviews/c-frontend-integration-closure-2026-06-20.md` |
| `DEV-1` 领域模型 + 权限 + 数据模型 | 暂缓 | 不能在缺少 UX/UI 高保真原型和关键页面状态输入时启动架构设计。 | `docs/ary-domain-analysis.v0.3.md`、`docs/ary-permission-matrix.md`、`docs/ary-mvp.ia.md` |
| `DEV-5` CA 接入 / Projection / Live Hall | 细化中 | 已将 CA 作为 Agent Race 工具、比赛信号源和评审参考的口径落盘；CAConnection 可在参赛过程中登记和握手，合法连接数据进入证据链，接入异常进入评审前风险提示；`task_progress` 仅用于 unblock / 说明，不做定期推送，且不设 `session_progress` push。 | `docs/ary-ca-integration-spec.md` |
| `REL-1` 赛事彩排 / 灰度发布 / 正式发布 | 待开始 | 等待开发任务和验收证据完成。 | `docs/ary-release-ops-plan.md` |
| `OPS-1` 赛事值守 / 回滚 / 赛后归档 | 待开始 | 等待发布方案和赛事执行计划明确。 | `docs/ary-release-ops-plan.md` |

## 证据索引

| 结论 | 证据 |
| --- | --- |
| 文档集合存在且已集中到 `docs/` | `docs/*.md` |
| 长期任务定义入口为 `docs/ary.plan.md` | `docs/ary.plan.md` |
| 近期窗口入口为 `PLAN.md` | `PLAN.md` |
| 四组分工文档已完成首轮合理性复核，并形成不改原文的补充建议与整合方案 | `tasks/ARY-Manage-System.review.md`、`tasks/ary-rider-client-spec.review.md`、`tasks/DATA-GUIDE.review.md`、`tasks/GRS003-C-ARY-front-display.review.md`、`tasks/ARY-integration-plan.review.md` |
| 第一轮共享 view model 已形成字段字典初稿，可作为统一 mock 数据和 adapter 输出入口 | `tasks/ARY-shared-field-dictionary.md` |
| 第一轮真实交付状态已形成核实清单，可用于区分现货、原型、文档说明和当前仓库未见产物 | `tasks/ARY-delivery-reality-checklist.md` |
| 第一轮发布态与可见性规则已形成独立口径，可统一 Public Site、Results、Review、Profile 和过程展示页的公开判断 | `tasks/ARY-publication-visibility-rules.md` |
| 五人分工任务包与公共契约文档已生成，且 `todos/01-04` 已保留原始四份分工文档的详细正文，可直接对外分发执行 | `todos/README.md`、`todos/*.md` |
| 统一架构图 / 组件图已生成，可用于说明系统边界、handoff 路径、authority mock 与 adapter 关系 | `todos/18-Architecture-Component-Diagram.md` |
| 单机 monorepo Web 技术路线已明确，可用于统一实现与部署方案 | `todos/19-Monorepo-Single-Machine-Web-Decision.md` |
| monorepo 目录骨架与最小启动命令契约已生成，可直接指导工程落地 | `todos/20-Monorepo-Scaffold-And-Startup-Contract.md` |
| monorepo 目录 ownership 已明确，可用于减少多人并行修改同一运行时代码目录的冲突 | `todos/19-Monorepo-Single-Machine-Web-Decision.md`、`todos/20-Monorepo-Scaffold-And-Startup-Contract.md`、`todos/README.md`、`deliverables/README.md` |
| 最小可运行 Node.js 单机骨架已创建，可直接作为真实实现入口 | `package.json`、`app/`、`scripts/`、`runtime-data/` |
| Windows 启停脚本已生成，可直接用于单机 Web 应用进程管理 | `start-web-app.bat`、`stop-web-app.bat` |
| 统一交付目录骨架与 manifest 模板已生成，可直接供 A-E 各组落盘产物 | `deliverables/README.md`、`deliverables/*/handoff.manifest.template.json` |
| B-Admin 最新提交 `21e7e38` 已完成复审，当前已接入程序壳并具备基础可运行性，但仍有配置页交互、审计日志筛选、维护页 CA 接入区块和样例一致性问题待补 | `reviews/b-admin-21e7e38.review.md` |
| B-Admin 提交 `8d520d3` 已完成复审，确认仅提交了 `runtime-data/` 下的生成物与运行日志，不构成新的管理端功能交付 | `reviews/b-admin-8d520d3.review.md` |
| B-Admin 当前运行壳与交付样例已完成 Dashboard / 维护页末尾残项补齐，并已按共享字段字典收敛运行时与样例 CA 状态，可直接进入最终集成验收 | `reviews/b-admin-rereview-2026-06-20.review.md`、`app/web/admin/dashboard.html`、`app/web/admin/maintenance.html`、`scripts/assemble.js`、`deliverables/b-admin/ca-status.sample.json` |
| B-Admin 最新提交 `5ffac20` / `dc98f31` 已完成复审与重新并入：当前已清理程序壳 Dashboard / 维护页中的冲突标记，保留最新 B 增量并与 A-Rider 维护页区块共存，相关 admin 路由与装配校验通过 | `reviews/b-admin-latest-commit.review.md`、`app/web/admin/dashboard.html`、`app/web/admin/maintenance.html`、`deliverables/b-admin/admin-shell/dashboard.html`、`deliverables/b-admin/admin-shell/maintenance.html`、`deliverables/b-admin/ca-status.sample.json` |
| Admin 维护页当前管理员会话与关键维护动作已接成真实持久化闭环：Projection 重算、Report 重跑 / 已审核、Work / Rider Profile 可见性变更、CAConnection 异常标记均可落盘、写审计并重建 runtime，且验证后样例已恢复 | `app/web/admin/maintenance.html`、`app/web/admin/audit-log.html`、`app/web/shared/admin-session.js`、`app/server/index.js`、`deliverables/b-admin/projection-status.sample.json`、`deliverables/b-admin/published-artifacts.sample.json`、`deliverables/b-admin/ca-status.sample.json`、`deliverables/b-admin/audit-log.sample.json` |
| B-Admin / D-Data 最终集成收工口径已形成：当前无需等待 B / D 新提交，可直接进入最终集成验收 | `reviews/integration-closure-2026-06-20.md` |
| A-Rider 最新提交已完成复审与重新并入：除原有 runtime API、contracts 与 replay 区块外，最新新增的 `proxy-source/`、`one-api-source`、One API 集成说明、ca-status/docs/source-bundles 切片也已被纳入 manifest、runtime 与 Admin 维护页可见面，且最终人工验收留痕已补齐 | `reviews/a-rider-review-2026-06-20.md`、`reviews/a-rider-integration-review-2026-06-20.md`、`reviews/a-rider-latest-commit.review.md`、`reviews/a-rider-final-manual-acceptance-2026-06-20.md`、`deliverables/a-rider/handoff.manifest.json`、`deliverables/a-rider/handoff.manifest.template.json`、`scripts/assemble.js`、`app/server/index.js`、`app/web/index.html`、`app/web/admin/maintenance.html` |
| DCR 本地运行口径已澄清：源码回放原型仍使用 `3737/3738`，但本机已安装桌面壳的现场核验入口是 `127.0.0.1:4302`，相关文档与 runtime assembled view 已同步修正 | `deliverables/a-rider/README.md`、`deliverables/a-rider/protocol-summary.md`、`deliverables/a-rider/replay-readme.md`、`runtime-data/assembled-view.json` |
| C-Frontend 当前交付已完成复审：可作为集成起点，但尚未完成 adapter 边界代码化与 route 落地 | `reviews/c-frontend-review-2026-06-20.md` |
| C-Frontend 首轮产品壳接线已完成：`/public`、`/live`、`/screen` 已接入运行时 bridge 与原型壳，浏览器验证通过 | `app/server/index.js`、`app/web/shared/c-frontend-runtime-bridge.js`、`app/web/shared/c-frontend-loader.js`、`app/web/public/index.html`、`app/web/live/index.html`、`app/web/screen/index.html` |
| C-Frontend 第二批公开 route 已接入：Race / Works / Results / Review / Rider / Cooperation 均支持产品壳 URL 直达 | `app/server/index.js`、`app/web/shared/c-frontend-loader.js`、`app/web/race/index.html`、`app/web/works/index.html`、`app/web/results/index.html`、`app/web/review/index.html`、`app/web/riders/index.html`、`app/web/cooperation/index.html` |
| C-Frontend 站内导航已开始同步产品壳 pathname：主导航、关键 CTA 与浏览器 Back/Forward 已可驱动对应页面状态 | `app/server/index.js`、`app/web/shared/c-frontend-loader.js` |
| C-Frontend 最新提交 `7685d6b` 已完成复审：显式 route / CTA contract 已落到 C 自身原型代码，E 侧也已把 loader 收口为消费公开 API，并已在当前仓库直接修复 Results / Review 对 archived 已发布赛事的错误排除；当前可继续最终集成验收，不再等待 C 新提交 | `reviews/c-frontend-7685d6b.review.md`、`reviews/c-frontend-integration-closure-2026-06-20.md`、`deliverables/c-frontend/app-shell/prototype/script.js`、`app/web/shared/c-frontend-loader.js` |
| C-Frontend 最终人工验收留痕已补齐，当前已有浏览器实测收工证据 | `reviews/c-frontend-final-manual-acceptance-2026-06-20.md` |
| D-Data authority mock 已接入运行时主装配链路，`assembled-view` 与运行时 API 已优先消费 `deliverables/d-data/authority-mock.json` | `scripts/assemble.js`、`scripts/setup-runtime.js`、`runtime-data/assembled-view.json`、`runtime-data/authority-mock.json` |
| 运行时 `caStatuses` 已按 D-Data / 共享字段字典收敛状态枚举，live API 与维护页不再出现旧值 `connected` | `scripts/assemble.js`、`app/web/admin/maintenance.html`、`runtime-data/assembled-view.json` |
| D-Data 提交 `d277698` 已完成复审，当前判断完成度约 85% 到 90%，交付本身可生成、可校验且可直接进入集成 | `reviews/d-data-d277698.review.md` |
| CA 接入契约已形成原始骑行状态消息草案，仍需继续讨论完善 | `docs/ary-ca-integration-spec.md` |
| 报名 / RaceProject / CA 参赛语义整改已形成临时任务书 | `docs/registration-ca-rules-alignment.taskbook.md` |
| 当前仓库包含设计原型 | `design-prototype/` |
| UX/UI 高保真原型已作为 `M2` 前置验收任务进入看板 | `PLAN.md`、`docs/ary.plan.md` |
| UX-1 高保真原型已按 IA 和 1080P 视口修订并通过本地截图验证 | `design-prototype/index.html`、`design-prototype/*.png` |
| UX-1 样例赛事数据已生成并接入原型渲染，用于支撑 IA 页面密度和状态差异 | `design-prototype/data/sample-races.json`、`design-prototype/data/sample-races.js`、`design-prototype/script.js` |
| UX-1 页面可见文案已去除 PRD、需求说明和实现术语口吻 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/data/sample-races.json`、`design-prototype/README.md` |
| UX-1 二级页面口号式大标题已降级为对象名和状态摘要 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 本轮 IA 整改已完成：公开导航边界、Home Gallery 模块、单场 Results、Works 筛选/详情入口、Race Riders 入口、Review 下一场、Rider 能力证据、Screen 输出/控制边界，且静态兜底与动态渲染一致 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 首页 IA 复审标准已落地：顶层导航不放 Race 子页面，CTA 依附具体 Race / 作品 / 合作场景，首页不设置独立 Leaderboards 模块 | `docs/ary-mvp.ia.md`、`design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/README.md` |
| UX-1 外审意见已落实：Hero 直接承载 Featured Race 信息，Latest Results / Past Races 去重，Next Entry 改为开放报名 / 合作入口，Header 按未登录态只显示 Login | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 首页 Leaderboards 已撤销：Live Skill Board 从首页移除，过程榜保留在 Live Hall，最终榜保留在 Results | `docs/ary-mvp.ia.md`、`docs/ary-mvp.prd.md`、`docs/ux-hifi.taskbook.md`、`design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 首页视觉复审已处理：右侧首卡从重复 Race Card 改为 Open Registration，首页 page-label 横线已隐藏，避免与 Public Header 分隔线冲突 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css` |
| UX-1 首页 Live Now 结构已修正：独立 Live Now 框已撤销，Hero / Featured Races 直接支持 live Race 切换 | `docs/ary-mvp.ia.md`、`docs/ux-hifi.taskbook.md`、`design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/README.md` |
| UX-1 首页 title 层级已修正：不在顶部额外强调 Series / Gallery title，当前 Live Race title 居中成为首屏主标题，下划线式 Live Race 切换器位于标题下方，赛题位于切换器下方 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 品牌区 logo 已修正：使用 ico 原图展示，移除额外圆形套框、描边和外圈光晕 | `design-prototype/index.html`、`design-prototype/styles.css` |
| UX-1 首页布局节奏已调整：Header 更轻，Hero 信息组上移并压缩，赛道视觉下沉，作品 / Rider 卡缩高并落在赛道下缘，右侧信息栈与主 Hero 保持错落间距 | `design-prototype/styles.css` |
| UX-1 首页 Live Race 切换器已简化：取消重复赛事文字，只保留下划线式选择指示，并加入自动轮播切换 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 首页 Live Race 未激活切换线已增强为浅蓝可见状态，active 状态仍保持深蓝加长 | `design-prototype/styles.css` |
| UX-1 右侧信息卡头部状态标签已降噪：从高饱和蓝色实心 pill 改为浅蓝描边淡底标签，避免抢主 Hero 注意力 | `design-prototype/styles.css` |
| UX-1 首页赛道 Riding Signal 角标已移到赛道容器左上，避免与轨迹节点产生关系误读 | `design-prototype/script.js` |
| UX-1 首页右侧辅助信息已改为 Drawer：默认只露出窄 Rail，点击后从右侧滑出 Open Registration、Latest Results、Past Races 和 Cooperation 四个模块 | `design-prototype/index.html`、`design-prototype/script.js`、`design-prototype/styles.css`、`design-prototype/README.md` |
| UX-1 首页 Live Title 已按 Drawer 默认收起态重新居中，Hero 信息组与赛道主画布中轴对齐 | `design-prototype/styles.css` |
| UX-1 品牌区 logo 已替换为马头罗盘 PNG，生成透明底裁切版并按竖向比例调整 Header 图标容器 | `design-prototype/assets/logo-horse-compass-transparent.png`、`design-prototype/index.html`、`design-prototype/styles.css` |
| UX-1 首页设计与交互短视频已录制，覆盖默认首页、Live Race 切换、右侧 Drawer 打开 / 收起，并内嵌字幕说明 | `design-prototype/recordings/ary-homepage-demo.mp4` |
| UX-1 首页整改经验已沉淀为通用高保真页面工作流 Skill，并在任务书和原型 README 中引用；后续页面需先审 IA、补领域样例数据、复用已通过页面视觉 / 交互惯例，再浏览器复审 | `.agents/skills/hifi-ui-page-workflow/SKILL.md`、`docs/ux-hifi.taskbook.md`、`design-prototype/README.md` |

## 风险与阻塞

| 项目 | 状态 |
| --- | --- |
| 架构、数据模型和接口契约尚未完成 | `DEV-1` 前置风险 |
| UX/UI 高保真原型和关键页面状态尚未评审验收 | `M2` 前置风险 |
| 报名 / RaceProject / CA 参赛语义已完成首轮整改，但仍需人工复审确认是否并入正式基线 | `PRD-TEMP-1` 待复审，重点看评审前风险命名、CAConnection 新增窗口和违规作品处理 |
| 当前仓库已具备本机可执行验证能力 | 已实际执行 `node .\scripts\assemble.js`、`node .\scripts\validate-handoffs.js`，完成 C-Frontend 浏览器路由回归、A-Rider runtime/API/管理页接线与最终人工验收，以及 B-Admin 最新提交重新并入后的 Dashboard / 维护页 `200` 路由验证；剩余工作主要是小范围语义整理 |
| C-Frontend 主 blocker 已关闭并完成本地修复 | C 组最新提交已关闭上轮主 blocker，E 侧也已改用 `window.ARY_C_FRONTEND` 收口现有 loader，并直接修复了 Results / Review 对 archived 已发布赛事的错误排除，且最终人工验收留痕已补齐；当前剩余工作已降为收尾级整理 |
