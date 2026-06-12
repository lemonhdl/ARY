# session 12：Week2 Jumbotron mock-data 接入

## 任务

用户指定本轮身份为 `cc-data`：负责与 `cc-Jumbotron` 沟通，处理并丰富 Jumbotron mock-data；初始阶段基于两份核心文档审阅数据是否有缺漏，后续按新增评审标准扩展为三份核心文档口径；如果没有缺漏，则将 mock-data 接入当前实现，并记录新的 riding record。

## 输入材料

- 原始压缩包：`mock_data.zip`
- 迁入位置：`Week2-Jumbotron/mock-data/raw/`
- 初始两份核心标准文档：
  - `Week2-Jumbotron/docs/source/jumbotron-information-architecture.md`
  - `Week2-Jumbotron/docs/source/jumbotron-subsystem-definition.md`
- 后续新增三文档评审口径见下文“三文档扩展与 data 利用计划”。

## 操作记录

1. 将原始 `mock_data.zip` 解压到 `Week2-Jumbotron/mock-data/raw/`，并生成 `raw-manifest.json`。
2. 阅读原始数据说明、`race-snapshot.json`、`racing-entry-snapshots.json`、`track.profile.json` 与 `index.js`。
3. 对照核心文档确认原始数据已覆盖 Competition、Competition KPI、Racing Entry、Riding Message、Attention Item、Track Profile、RacingEntrySnapshot 等主要对象。
4. 发现原始数据不能直接接入当前 PoC：
   - `roundProgress / overallProgress / phaseProgress` 使用 0–1 比例，而当前 PoC runtime 消费 0–100 百分比。
   - TrackProfile 使用 1920×1080 画布、数组式 `viewBox`、`centerline.points`，当前 PoC runtime 使用 1200×620、对象式 `viewBox` 和 `centerlinePath`。
   - 原始 `direction` 使用 `cw`，当前 validation 接受 `clockwise / counterclockwise`。
   - 原始数据未完整覆盖 `finished` motionState、`violation` 与 `obstacle` 类型 Riding Message 的显式展示。
   - 原始包没有真实 `background.webp / preview.png`，当前公开页 validation 需要 allowlist 与真实文件存在。
5. 生成 curated 数据目录：`PoC-GRS-001/jumbotron-mock-data/curated/`。
6. 对 curated 数据做补齐：
   - 转换 0–1 进度为 0–100。
   - 将 1920×1080 TrackProfile 等比适配为当前 1200×620 runtime 画布。
   - 映射背景为现有 allowlist 本地资产 `/assets/public-yard-hero.webp`。
   - 保留 12 个 Racing Entry 与 12 条 lane 对应关系。
   - 补齐 `finished` motionState 覆盖。
   - 补齐 `violation` 与 `obstacle` Riding Message 覆盖。
   - 补齐 `critical` attention severity 与 `resolved` attention status 覆盖。
   - 刷新时间戳，只保留 MediScribe 作为 stale 样例，避免全体 Entry 因历史时间戳误判 stale。
   - 清理公开页禁用词，将“第三方 API 配额”改成观众可见的“外部配额”。
7. 修改主线实现 `PoC-GRS-001/src/server.js`：
   - `/jumbotron` 优先读取 curated `race-snapshot.json` 与 `track.profile.json`。
   - curated 数据缺失时回退到原动态 `buildRaceSnapshot(...)`。
   - `adaptJumbotronSnapshot(...)` 保留数据自带 `laneId`，只在不存在时按 track lanes fallback。
   - `adaptJumbotronSnapshot(...)` 优先使用 `motionState`，避免 rich 展示态被生命周期 `status` 覆盖。
8. 更新 `PoC-GRS-001/src/verify.js`，将 Jumbotron 验证从旧 Team 样例切换到 curated 数据样例。

## 覆盖结果

curated mock-data 当前覆盖：

- `entries`: 12
- `messages`: 13
- `attentionItems`: 13
- `lanes`: 12
- `checkpoints`: 4
- `messageTypes`: milestone、obstacle、pit_stop、progress_update、quality_signal、risk_alert、strategy_change、takeover、violation
- `attentionCategories`: obstacle、risk、violation
- `motionStates`: blocked、finished、idle、pit_stop、running、slowed、sprinting、stale、takeover
- `caProviders`: claude、codex、other
- TrackProfile 包含 messageZones、noBubbleZones、riskZones。

## 验证

运行命令：

```bash
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

## 三文档扩展与 data 利用计划

用户随后要求按新增的第三份核心文档《ARY GRS 002 Jumbotron 评审标准.md》重新判断 mock-data 是否足以支撑 100 分作品中的 data 证据链，并要求逐字逐句落成 data 利用计划。

本轮扩展后的核心口径：

- `ary-grs-002-sinbawang/ARY GRS 002 Jumbotron 评审标准.md`
- `ary-grs-002-sinbawang/Jumbotron信息架构.md`
- `ary-grs-002-sinbawang/Jumbotron子系统定义.md`

新增或更新的审阅包：

- `Week2-Jumbotron/mock-data/review-package/rubric-data-coverage-report.json`
- `Week2-Jumbotron/mock-data/review-package/data-utilization-plan-by-rubric.md`
- `Week2-Jumbotron/mock-data/review-package/data-scenario-manifest.json`
- `Week2-Jumbotron/mock-data/review-package/adapter-last-message-mapping.md`
- `Week2-Jumbotron/mock-data/review-package/validation-results.md`

三套数据的分工：

- full curated 12 entries：完整承载、完整 KPI、完整 attention/messages、压力能力证明。
- smoke-8：低负载视觉 smoke、课堂大屏和视频主视觉候选，不用于证明全枚举覆盖。
- coverage-9：覆盖 9 种 motionState 和 9 种 message type，用于 debug/validator/技术解释，不作为最低视觉负载默认图。

## 行号纠偏与审阅反馈

`cc-Jumbotron` 审阅后指出早期 rubric 行号记录存在错位，随后修正了：

- `Week2-Jumbotron/mock-data/review-package/rubric-data-coverage-report.json`
- `Week2-Jumbotron/review-ledger/source-line-ledger.jsonl`

备份文件：

- `Week2-Jumbotron/mock-data/review-package/rubric-data-coverage-report.before-line-alignment-fix.json`
- `Week2-Jumbotron/review-ledger/source-line-ledger.before-cc-data-line-alignment-fix.jsonl`

后续规则：脚本抽取评审标准行时必须输出 `line -> text`，只有证据与该行原文对齐时才更新有效阅读台账。

`cc-Jumbotron` 对 `data-utilization-plan-by-rubric.md` 的审阅结论是总体可用，但要求修正 L126/L127/L128/L129/L147/L149/L150/L218/L224/L225/L243/L245/L263-L268/L351/L394/L396 等行的语义分类。cc-data 已重新生成计划文档，并确认这些关键行不再落到空行或错误语义。

## 最新验证结果

三组数据校验结果记录在 `Week2-Jumbotron/mock-data/review-package/validation-results.md`：

- full curated：pass，无 errors，无 warnings。
- coverage-9：pass，无 errors，无 warnings。
- smoke-8：pass，无 errors；存在预期 warnings，因为它有意不覆盖 `slowed / pit_stop / takeover` 等全枚举状态，不能用于证明全枚举覆盖。

## data-side profile/debug/adapter 证据

用户纠正后明确：cc-data 负责的内容必须由 cc-data 自己实现，不能转发给 cc-ARY 代为实现。因此 cc-data 继续补齐 data-side 可交付物：

- `Week2-Jumbotron/mock-data/review-package/generate-data-side-evidence.js`
- `Week2-Jumbotron/mock-data/review-package/data-profile-evidence.json`
- `Week2-Jumbotron/mock-data/review-package/last-message-mapping-evidence.json`
- `Week2-Jumbotron/mock-data/review-package/data-side-evidence-summary.md`

这些产物提供：

- full / smoke-8 / coverage-9 三套 profile 的 counts、motionStateCoverage、messageTypeCoverage、attentionCategoryCoverage、publicHiddenFields、validatorStatus。
- smoke-8 的 expected enum warnings，明确它是低负载视觉 profile，不是 enum-complete profile。
- coverage-9 的 enum-complete 证据，明确它是 coverage/debug profile，不是最低负载主视觉。
- `latestMessageId + messages[] -> lastMessage` 的逐 entry 解析结果。
- 缺失 message id 时 fallback 到 `latestMessage` 摘要的 synthetic check。
- `remoteCockpitUrl / targetUrl` 只以字段名、计数或布尔值进入 evidence，不输出 raw URL。

最新生成结果：

- `curated-full-12`：validatorStatus `pass`，entries 12，messages 13，attentionItems 13，motion/message coverage complete。
- `smoke-8-visual-low-load`：validatorStatus `pass_with_expected_warnings`，entries 8，messages 9，attentionItems 9，motion/message coverage intentionally incomplete。
- `coverage-9-enum-complete`：validatorStatus `pass`，entries 9，messages 10，attentionItems 11，motion/message coverage complete。
- lastMessage mapping：full 12/12 resolved，smoke-8 8/8 resolved，coverage-9 9/9 resolved，三套 synthetic missing id fallback 均通过。

## runtime profile/debug/evidence 接入

按 `cc-Jumbotron` 在 `2026-06-12T15:25:17Z` 布置的任务，cc-data 已自行把 data-side profile/debug/adapter 证据接入 runtime，而不是转交给 cc-ARY 代做：

- `PoC-GRS-001/src/server.js`
  - `/jumbotron` 默认使用 `full -> curated-full-12`。
  - `/jumbotron?profile=full|smoke-8|coverage-9` 支持三套 profile 切换，并保留 canonical `dataProfileId`。
  - `/jumbotron?debug=1&profile=...` 展示 data profile、entry/message/attention counts、motion/message coverage、public-hidden fields、validatorStatus、profileUsageGuard。
  - debug panel 展示逐 entry `latestMessageId + messages[] -> lastMessage` 解析状态，以及 `resolvedCount / fallbackCount / unresolvedCount / syntheticMissingIdFallsBack` 聚合证据。
  - `adaptJumbotronSnapshot(...)` 已把 resolved 或 fallback 的 `lastMessage` 放入 runtime entry，契合 `RacingEntrySnapshot.lastMessage?: RidingMessageSnapshot` 契约。
  - 新增只读 `/api/jumbotron-data-evidence?profile=full|smoke-8|coverage-9`，非法 profile 返回显式错误和 allowed profiles，不 silent fallback。
  - `/api/jumbotron-bubbles?profile=...` 与当前页面 profile 保持一致。
- `PoC-GRS-001/src/verify.js`
  - 覆盖 full / smoke-8 / coverage-9 页面、debug panel、JSON evidence endpoint、invalid profile、防 raw URL 泄漏、lastMessage fallback 证据。

复验命令：

```bash
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-8.json /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-9-coverage.json /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/generate-data-side-evidence.js
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify
```

结果：

- full validator：pass，0 errors，0 warnings。
- smoke-8 validator：pass，0 errors，保留预期 enum coverage warnings。
- coverage-9 validator：pass，0 errors，0 warnings。
- data-side evidence generator：重新生成 profile/mapping/summary evidence，三套 synthetic missing id fallback 均通过。
- PoC verify：`VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds`。
- public-hidden：public page、debug panel、bubble API、JSON evidence API 不输出 raw `remoteCockpitUrl` / `targetUrl` value，只输出字段名、计数或 `targetUrlHidden` 等布尔 evidence。
## 当前实现接轨状态

- `/jumbotron` 已优先读取 curated `race-snapshot.json` 与 `track.profile.json`，并支持 `profile=full|smoke-8|coverage-9`。
- adapter 已保留 `laneId`，优先使用 `motionState`，按 `roundProgress` 驱动 HorsePose 链路，并补齐 runtime `lastMessage` 映射。
- debug UI 已展示 data profile、counts、coverage、public-hidden、validator status 和 lastMessage mapping evidence。
- JSON evidence endpoint 已接入，只读返回三套 profile 的 runtime evidence，并对非法 profile 显式报错。
- public-hidden 边界保留，`remoteCockpitUrl`、`targetUrl` 作为数据存在但不直接公开渲染。

仍不属于 cc-data 狭义 data 缺口、需要视觉/审阅线继续消化的事项：

- 继续用截图和视频复审 label-bubble overlap、弯道自然、risk/obstacle/violation 是否清晰且不过载。
- 视觉资产、Calibrator UI、短视频录制与最终展示审美仍由 cc-Jumbotron/cc-ARY 线处理。

## 当前边界

- 本轮未提交、未推送。
- curated 数据用于当前 Week2 Jumbotron mock-data 主线接入，不宣称来自真实后端聚合。
- 原始 zip 未提供真实 `background.webp / preview.png`，所以 TrackProfile 使用现有本地 allowlist 资产保持 validation 可运行。
- 资产、Calibrator UI、短视频、弯道自然、气泡清晰、checkpoint 视觉语义不属于 cc-data 狭义 mock-data 缺口，仍需 `cc-Jumbotron` 从截图和人类观看视角做复审确认。
