# PLAN

本文是 ARY 近期任务窗口，记录近期要推进的任务和里程碑。长期任务定义见 `docs/ary.plan.md`；任务瞬时状态见 `STATUS.md`。

## 近期窗口

| 窗口 | 目标 |
| --- | --- |
| UX 高保真原型评审 | 完成 UX-1 第一轮高保真原型评审，确认能否作为架构设计输入继续推进。 |
| 报名 / CA 参赛语义整改 | 确认 Registration approved 自动生成 RaceProject、CAConnection 参赛中动态接入、CA 接入状态不再作为参赛资格硬门禁，并完成文档一致性整改。 |

## 近期任务

| 任务 | 目标 | 下一入口 |
| --- | --- | --- |
| `PRD-1` 文档基线与范围确认 | 完成首轮文档一致性检查，确认能否作为架构入口。 | `docs/ary.plan.md` |
| `PRD-TEMP-1` 报名 / RaceProject / CA 参赛语义整改 | 已完成首轮整改并进入待复审：PRD、领域、CA 契约、IA、UX / 高保真原型、权限、QA、OPS 和计划文档已同步新口径。 | `docs/registration-ca-rules-alignment.taskbook.md` |
| `UX-1` UX/UI 高保真原型与设计基线 | 已产出 IA 对齐版 1080P 高密度高保真原型，后续页面按高保真页面工作流继续深化。 | `docs/ux-hifi.taskbook.md`、`.agents/skills/hifi-ui-page-workflow/SKILL.md`、`design-prototype/index.html` |
| `DEV-1` 领域模型 + 权限 + 数据模型 | 输出聚合边界、数据模型草案和接口鉴权规则。 | `docs/ary-domain-analysis.v0.3.md` |
| `DEV-5` CA 接入 / Projection / Live Hall | 已按新口径整改 CA 原始骑行状态消息草案：CAConnection 可在参赛过程中登记和握手，合法连接数据进入证据链，接入异常进入评审前风险提示；继续收敛投影规则、字段必填性、push / fetch 边界和幂等规则。 | `docs/ary-ca-integration-spec.md` |

## 近期里程碑

| 里程碑 | 完成口径 |
| --- | --- |
| `M1` 文档基线可作为架构入口 | PRD、领域、IA、权限、QA、计划、OPS、CA 草案无高优先级冲突。 |
| `M2` 架构设计输入就绪 | 领域边界、权限规则、数据模型、CA 接入待定项、UX/UI 高保真原型和关键页面状态有明确输入。 |

## 下一步

1. 评审 `UX-1` IA 对齐版 1080P 高密度高保真原型，重点确认首页 Public Header、Race Gallery 层级、具体内容卡、蓝白竞赛视觉、Console 气质和 Screen Display 表达。
2. 后续高保真页面新增或整改时，使用 `.agents/skills/hifi-ui-page-workflow/SKILL.md`，先确认 IA 合约、数据面和已通过页面惯例，再进入页面实现和浏览器复审。
3. 暂缓 `DEV-1` 架构设计进入，直到 `UX-1` 的高保真原型和关键页面状态被确认可作为输入。
4. 复审 `PRD-TEMP-1` 整改后的 PRD、领域、IA、UX / 高保真原型、权限、QA、OPS 和 CA 契约一致性，确认是否可将临时任务并入正式 `PRD-1` 基线。
5. 基于 `tasks/*.review.md` 新增的分工复核与集成建议，冻结四组交付边界、共享契约、发布态和整合顺序，再启动可运行产品壳与联调。
6. 以 `tasks/ARY-shared-field-dictionary.md` 作为第一轮共享 view model 草案，优先统一 mock 数据和 adapter 输出，再推进页面接线与管理端读取模型。
7. 以 `tasks/ARY-delivery-reality-checklist.md` 作为集成前核实清单，先区分“已提交可消费”“仅文档说明”“文档声明但仓库未见”的交付现状，再安排补交物。
8. 以 `tasks/ARY-publication-visibility-rules.md` 冻结第一轮发布态与可见性规则，统一 Public Site、Results、Review、Rider Profile、Live Hall 与管理端的公开判断。
9. 已在 `todos/` 下重组生成五人分工任务包与公共契约文档，并已将原始四份分工文档的详细有效内容直接保留进 `todos/01-04` 主体；下一步按该任务包分发执行，并要求各组将实现产物交付到统一 `deliverables/` 目录和 manifest 规范下。
10. 已创建 `deliverables/` 目录骨架与 A-E 五组 manifest 模板，后续要求各组直接在对应目录中填充正式交付并将模板复制为正式 `handoff.manifest.json`。
11. 已在 `todos/` 下补充统一架构图 / 组件图文档，可作为任务分发、联调 kickoff 和边界对齐的快速入口。
12. 已补充“单机 monorepo Web 应用”技术路线决策，后续实现优先按单进程、原生 Web 栈、低依赖和简单部署收口。
13. 已补充 monorepo 目录骨架和最小启动命令约定，后续实现应尽量收敛到统一目录结构与 `setup/dev/start` 脚本语义。
14. 已落下最小可运行 Node.js 单机骨架：包含 `package.json`、原生 HTTP server、`app/web/` 占位页面、运行态脚本和 `runtime-data/` 目录，下一步可以开始把真实页面壳和 handoff 装配逻辑接进去。
15. 已补充 Windows 启停脚本 `start-web-app.bat` / `stop-web-app.bat`，用于在具备 Node.js 环境时直接启动和停止单机 Web 应用。
16. 已补充 monorepo 目录 ownership 约定：A-D 默认只改各自 `deliverables/` 目录，E 负责 `app/`、`scripts/`、`runtime-data/` 接线，以降低多人并行修改同一运行时代码目录的冲突。
17. 已完成 C-Frontend 首轮产品壳接线：`app/web/public/`、`app/web/live/`、`app/web/screen/` 已通过运行时 bridge 复用 `deliverables/c-frontend/app-shell/prototype/`，下一步继续把 `route-map.json` 中剩余页面入口和共享 view model 边界正式落到产品壳。
18. 已完成 C-Frontend 第二批公开 route 接线：`/race/:raceId`、`/works/:workId`、`/results/:raceId`、`/review/:raceId`、`/riders/:riderId` 与 `/cooperation` 已可直达；下一步从“URL 可进入”继续推进到“站内导航 URL 同步”和更明确的共享 adapter/view model 代码边界。
19. 已完成 C-Frontend 关键站内导航的 pathname 同步：主导航、关键 CTA 与浏览器 Back/Forward 已能带动对应页面状态；此前暴露出的首页 live switcher、carousel 与 CTA contract 问题，已由 C 最新提交 `7685d6b` 收回到原型自身公开 API。
20. 已完成 C-Frontend 最新提交复审、本地收口和最终人工验收留痕：`window.ARY_C_FRONTEND` 已成为可消费的 route / CTA contract，`app/web/shared/c-frontend-loader.js` 已改为消费公开 API 并在产品壳层补齐 `popstate` 回放；由于当前没有时间再返给 C 返工，Results / Review 对 archived 已发布赛事的错误排除也已在当前仓库直接修复，并已形成单独的 C 集成收口说明与最终人工验收记录。当前剩余工作量已降为收尾级整理，不再有新的 C 集成 blocker。
21. 已完成 A-Rider 前一轮最新提交复审与本地接线：A 组已关闭握手密钥模型的主矛盾，集成侧也已继续把 `session-fetch.contract.json` 收窄回 `claude_code`、清理 `signature-samples.json` 的脱敏残留，并将 A-Rider 样例、contract 与文档装配进 `runtime-data/assembled-view.json`；当前 app 已暴露 `/api/runtime/a-rider*` API，并在 Admin 维护页增加 “A-Rider 回放与接入验收” 区块。
22. 已完成 A-Rider 最新提交 `e942ccb` / `d0364da` 的复审与重新并入：上游本轮新增的 `proxy-source/`、`one-api-source/` 与 One API 集成说明已由集成侧纳入正式 handoff manifest、runtime `assembled-view` 与 Admin 维护页可见面；随后又补齐了 `/api/runtime/a-rider/ca-status`、`/api/runtime/a-rider/docs`、`/api/runtime/a-rider/source-bundles`，并将状态样例、文档摘要与源码包摘要渲染进维护页 A-Rider 区块。当前 A-Rider 任务包要求的交付项已全部进入 app 的可访问集成面，不再存在“仓库里已交付、运行时却不可见”的缺口。
23. 已完成 A-Rider 最终人工验收留痕：运行中 app 已实测通过 A-Rider runtime summary API、contracts API、ca-status/docs/source-bundles API、One API 集成说明装配，以及 Admin 维护页接线区块渲染。当前 A-Rider 已具备完整收工证据，不再有新的 A 集成 blocker。
23. 已完成 B-Admin 最新提交 `5ffac20` / `dc98f31` 的复审与二次集成收口：最新交付中的 CA 状态样例、Dashboard 风险呈现和维护页批量 / 历史 / 审核增量已重新并入 `app/web/admin/`；当前发现的问题不是 B 交付缺口，而是程序壳合流时残留的冲突标记，现已在 `dashboard.html` / `maintenance.html` 中清理并验证通过。B-Admin 当前再次回到无 blocker 的可直接收工状态。
24. 已完成 Admin 维护页当前管理员接线与关键维护动作持久化：`maintenance.html` 现已复用当前管理员会话，`Projection` 单项 / 按赛事 / 按范围重算、`Report` 重跑 / 标记已审核、Work / Rider Profile 可见性变更，以及 CAConnection 异常标记都已接入真实后端写口，能够落盘到 `deliverables/b-admin/*.sample.json`、写入审计日志并重建 runtime；相关 API、维护页与审计页读取已验证通过，测试痕迹已清理回样例基线。
25. 已完成 DCR 本地运行口径澄清：`deliverables/a-rider/` 文档现已明确区分“源码回放原型 `3737/3738/3000`”与“已安装桌面壳统一入口 `127.0.0.1:4302`”；后续桌面壳排障、人工验收和运行时文档读取都应以 `4302` 为现场核验入口，而不是继续把 `3737/3738` 当作桌面壳启动判据。

## 执行纪律

* 开工前读取对应任务在 `docs/ary.plan.md` 中的定义。
* 近期窗口变化时更新本文；任务状态变化时更新 `STATUS.md`。
