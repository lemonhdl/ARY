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

## 执行纪律

* 开工前读取对应任务在 `docs/ary.plan.md` 中的定义。
* 近期窗口变化时更新本文；任务状态变化时更新 `STATUS.md`。
