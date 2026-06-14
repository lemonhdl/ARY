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


## 上下文恢复与最小自检

`cc-data` 一度丢失上下文后，`cc-Jumbotron` 以 `2026-06-12T16:20:15Z-cc-Jumbotron-2af9b494` 发送恢复说明，重申 cc-data 仍负责 Jumbotron mock-data、data-side profile/debug evidence、adapter/lastMessage mapping、validator/status 和 data-side 文档同步；这些任务不能转给 cc-ARY 代做。

`cc-data` 随后以 `2026-06-12T16:31:39Z-cc-data-f88978ce` 回报上下文已恢复，并完成最小自检：

- 8 个指定文件均存在。
- 重新运行 `generate-data-side-evidence.js`，生成 `data-profile-evidence.json`、`last-message-mapping-evidence.json`、`data-side-evidence-summary.md`。
- 直接运行三套 validator。
- 运行 `npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001 run verify`。

自检结果：

```text
curated-full-12: pass / 0 warnings
smoke-8-visual-low-load: pass_with_expected_warnings / 5 warnings
coverage-9-enum-complete: pass / 0 warnings
PoC verify: VERIFY_PASS
```

风险结论：未发现指定文件缺失、验证失败或 public-hidden raw URL 泄漏证据。`remoteCockpitUrl / targetUrl` 仍只作为隐藏字段名、计数或布尔 evidence 出现，不暴露 raw value。当前没有新增 data 实现任务；后续如果继续 data profile/debug/adapter/validator 文档同步，仍由 cc-data 自己处理。

## 新增 mock_data (3) 与近期回放接入

2026-06-13，用户提供新增压缩包 `mock_data (3).zip`，要求解压并放到合适位置，开始充分利用其中的随时间变化数据：主视图默认展示最终数据，同时提供近期回放，把比赛随时间变化的状态 replay 出来。

### 输入与导入

- 新增 zip 被解压到 `Week2-Jumbotron/mock-data/imports/2026-06-13-mock-data-3/`，保留完整原始包结构和导入来源。
- 选择性迁入 `Week2-Jumbotron/mock-data/raw/mock_data/`：`race-timeline.json`、`build-timeline.mjs` 以及带日期后缀的导入说明文件。
- 新包中的 `tracks/grandstand-oval` 没有覆盖 active/raw track。原因是此前椭圆/操场式赛道已被用户否定，直接替换会回退已经确认的第二赛道资产方向。

### Rider steering

用户连续纠偏了 replay 形态：

1. 不要做第二个 replay panel；应当只有一个主视图。
2. 点击开始回放后，在同一个主视图中播放；停止回放后恢复最终主视觉。
3. 不能按原始数据有多少帧就播放多少帧，必须做平滑插值。
4. replay 不循环；点击重放只播放一次，结束后恢复最终主视觉。
5. 回放过程中增加事件气泡，反映超越、冲线等关键事件。
6. 事件气泡要使用已有防重叠自适应算法，不能只简单叠在马匹旁边。
7. 事件气泡消失太快，需要延迟几帧消失；replay 最后一帧也需要停留几帧再恢复主视图。

这些 steering 把需求从“额外时间轴面板”收敛为“主视觉内的一次性时间回放”，更符合 Jumbotron 作为现场大屏主视觉的表达方式。

### 实现记录

主要修改集中在 `PoC-GRS-001/src/server.js` 和 `PoC-GRS-001/src/verify.js`：

- 新增读取 `race-timeline.json` 的 timeline helper。
- 将原始 13 个 keyframes 通过 `JUMBOTRON_REPLAY_INTERPOLATION_STEPS = 6` 插值成 73 个 playback frames。
- `roundProgress / avgRoundProgress / phaseProgress` 继续通过归一化 helper 转为 0–100 百分比，避免 0–1 原始比例直接进入 runtime。
- `/jumbotron` 的主赛道卡片增加 `data-main-replay-controls`，默认 `data-main-track-mode="final"`。
- replay 控件点击后替换 `#jumbotron-main-track-frame` 内部内容；停止或播放结束后恢复 server-rendered final frame。
- `/api/jumbotron-replay?profile=...&track=...&frame=...` 以 playback frame index 返回当前帧 HTML、panel frame HTML、插值 metadata 和 hold 参数。
- replay frame 的主 track SVG 不再带旧 debug grid，debug/panel 信息改由 `panelFrameHtml` 保留。

### 事件气泡与防重叠

新增 replay 事件气泡层：

- `race_start` 显示“起跑”。
- `overtake` 显示“超越”或 finish 阶段的“冲刺超越”。
- `finish` 显示“冲线”。
- `status_change` 显示“状态变化”。

用户追问后确认：最初只复用了部分 rect 估算逻辑，不算完整接入现有防重叠自适应算法。随后补齐：

- 按事件类型优先级筛选：finish > overtake > lead_change > race_start > status_change。
- 同一队伍每帧最多显示一个 replay 事件气泡。
- 同屏最多 3 个 replay 事件气泡。
- 复用多 placement 候选和 `estimateBubbleRects(...)`。
- 使用 `rectsSpatiallySeparated(...)` 做空间过滤：不相交且中心距至少 220。
- 输出 `data-replay-bubble-x/y/width/height` 与 `data-placement`，让 verify 能检查几何分离。

抽查帧包括 overtake 和 finish 密集帧，目标是保证事件气泡不互相覆盖，也不因为候选过多而污染主视觉。

### 事件停留与 final hold

针对“气泡消失太快”和“最后一帧停留”的要求，新增 replay timing 参数：

```text
JUMBOTRON_REPLAY_FRAME_DELAY_MS = 180
JUMBOTRON_REPLAY_EVENT_HOLD_FRAMES = 5
JUMBOTRON_REPLAY_FINAL_HOLD_FRAMES = 6
```

事件气泡从对应 raw keyframe 的 playback index 开始，继续保留 5 个 playback frames；replay 播到最后一帧后，显示“回放结束，停留最终帧”，再等待 `frameDelayMs * finalHoldFrames` 后恢复最终主视觉。

验证断言同步调整：

- 页面需要暴露 `data-event-hold-frames="5"` 和 `data-final-hold-frames="6"`。
- API 需要返回 `eventHoldFrames`、`finalHoldFrames`、`frameDelayMs`。
- replay event bubbles 需要通过 `assertReplayEventBubblesSpatiallySeparated(...)`。
- 过期窗口不再用 `frame=30` 断言无 overtake，因为该帧正好是下一次 raw overtake 事件；改为使用 `race_start` 的 `frame=5` 仍存在、`frame=6` 过期。

### 当前验证状态

本轮在实现过程中多次遇到并发修改和验证基线切换：

- `verify.js` 的默认赛道断言一度在 public track 和 confirmed second track 之间不一致。
- 当前产品方向对齐为 `/jumbotron` 默认使用已人工确认的 `real-explicit-closed-course`，仍保留切回 `default-public-track` 的入口。
- `server.js` 的 `resolveJumbotronTrackSelection(...)` 需要使用 `JUMBOTRON_DEFAULT_TRACK_ID`，不能把空 track 硬编码回 `default-public-track`。

最新 `npm run verify` 尚未完成通过；当前卡点不是 replay 本身，而是 debug 模式下 `renderJumbotron()` 调用了缺失的 `renderJumbotronValidation(viewModel)`。下一步需要补回 debug-only validation panel，渲染现有 `buildValidationModel(...)` 的 contract、track、runtime、visual checks，再复跑 verify。

### 边界

- 本轮未 commit、未 push。
- 未公开 raw `targetUrl`、raw `remoteCockpitUrl`、完整 session log 或本地私有路径到 public/debug/API evidence。
- `mock_data (3).zip` 的 timeline 已用于 replay；`grandstand-oval` 资产未接管 active track，避免回退到已否定的椭圆赛道方向。
- replay 是 Jumbotron 主视觉内的近期回放能力，不是独立 Riding Record 详情页，也不改变 ARY Riding Record 去中心化口径。

## Jumbotron 主视觉比例、几何隐藏和底栏工具栏收敛

2026-06-13，用户继续以截图和页面观感纠偏 Jumbotron 主视图：第二赛道成为默认赛道后，旧高度限制让主视觉再次出现左右留白；几何隐藏按钮只隐藏虚线，没有同时隐藏与虚线打包出现的几何赛道；回放控制按钮不应放在标题区，而应成为主视觉下面的底栏工具栏。

### Rider steering

本轮 steering 集中在现场大屏的观看视角，而不是内部实现说明：

1. 默认第二赛道必须按自身 `1672×941` 比例铺满主赛道卡片，不能继续套旧公开赛道的 `1200×620` 约束。
2. 隐藏几何线时，应同时隐藏几何赛道层，只保留真实底图和 Rider 状态展示。
3. `开始回放`、`停止回放`、`隐藏几何线` 这组控制不应作为 header 内容挤在标题和主视觉之间，应放到主视觉下方作为底栏工具栏。
4. 页面可见文案继续保持克制，避免把操作机制、实现细节和内部编号放到主页面。

这些纠偏体现了 Rider 对 Agent 输出的视觉约束：功能存在不等于呈现正确，Jumbotron 的主视图必须先服务观众观看，再服务调试和验证。

### 实现记录

主要修改集中在 `PoC-GRS-001/src/server.js` 和 `PoC-GRS-001/src/verify.js`：

- `.jumbotron-live-layout` 取消旧固定高度 `height:calc(51.7vw - 116px)` 和 `min-height:620px`，主视觉区域改为按内容和当前赛道比例自适应。
- `renderJumbotronTrack(...)` 和 `renderJumbotronReplayMainTrackFrame(...)` 使用当前 `trackProfile.viewBox` 生成 `aspect-ratio:${trackAspectRatio}`，默认第二赛道输出 `aspect-ratio:1672 / 941`。
- 全局 `.track-svg` 不再锁死 `1200/620`，改为 `aspect-ratio:var(--track-aspect-ratio,1672/941)`，避免加载或回放注入时回退到旧比例。
- `#jumbotron-main-track-frame` 从 `flex:1` 改为 `flex:0 0 auto`，避免外层 frame 被侧栏高度拉伸，导致 SVG 下面出现空白。
- `.jumbotron-geometry-hidden` 同时隐藏 `.track-band`、`.track-centerline` 和 `.track-samples`，但保留 `.track-background-image`。
- `renderJumbotronTrack(...)` 的结构调整为先输出标题和主视觉 frame，再输出 `data-main-replay-controls`，使回放与几何控制成为主视觉底栏工具栏。
- `verify.js` 增加对第二赛道比例、旧固定高度移除、几何赛道隐藏和工具栏位于主视觉下方的断言。

### 浏览器验收证据

本轮不是只看源码，而是用 4400 本地页面做浏览器测量和截图：

```text
URL: http://127.0.0.1:4400/jumbotron
启动命令: npm --prefix "/media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001" start
```

主视觉比例实测：

```text
#jumbotron-main-track-frame: 1038×584, ratio 1.7769
.track-svg: 1038×584, ratio 1.7769
expected: 1672 / 941 = 1.7768
旧固定高度: false
旧 1200/620 比例: false
active track: Real Explicit Closed Course
```

几何隐藏实测：

```text
Live frame after toggle:
track-band: none
track-centerline: none
track-background-image: inline

Replay frame after toggle:
mode: replay
track-band: none
track-centerline: none
track-background-image: inline
svgRatio: 1.7769
```

底栏工具栏实测：

```text
titleBeforeFrame: true
frameBeforeToolbar: true
svgBeforeToolbar: true
frame: 1038×584
toolbar top: 978
svg bottom: 966
active track: Real Explicit Closed Course
```

截图产物：

- `PoC-GRS-001/jumbotron-second-track-fit.png`
- `PoC-GRS-001/jumbotron-geometry-hidden-track.png`
- `PoC-GRS-001/jumbotron-toolbar-bottom.png`

### 边界

- 本轮未 commit、未 push。
- 4400 服务重启过程中出现过后台 wrapper 把 `kill` 旧进程记录为 exit code 143 的通知；随后已确认新服务监听 4400，`/jumbotron` 返回正常。
- 本轮验证集中在 Jumbotron 主视觉、几何隐藏和底栏工具栏，不代表 Calibrator demo 录制说明等其他验证线已一并审完。

## Jumbotron UI 文案、抽屉和固定入口验收收敛

2026-06-13，用户继续通过截图审阅 Jumbotron 主页，重点指出公开大屏上仍有面向实现或开发者的残留信息，以及若干抽屉和状态组件的视觉问题。本轮工作属于主视觉表达收敛，不改变 mock-data、timeline replay 或 track runtime 的数据链路。

### Rider steering

用户连续给出以下纠偏：

1. `最终主视觉` 这类状态字样不应出现在主页；删除文字后，也不能留下空的绿色文本框。
2. 页头出现 `DevCompass Racing DevCompass Racing` 这类主副标题完全一致时，优先删除重复副标题。
3. `数据视图` 抽屉展开后不能截断 `赛道选择` 卡片。
4. `赛事状态` 抽屉里的信息应多换行，少用标点；不要把 `主题：...；主办方：...`、`阶段：...；下一步：...` 写成两条长句。
5. 页面修改后必须重启并验证固定入口 `http://127.0.0.1:4400/jumbotron`，不能只在临时端口验证后把 4400 报给用户。用户对此明确警告过一次。

这些 steering 继续强调 Jumbotron 的产品页边界：公开页面服务观众观看，不展示实现状态、重复标题、机械标点或开发者说明。

### 实现记录

主要修改集中在 `PoC-GRS-001/src/server.js` 和 `PoC-GRS-001/src/verify.js`：

- `renderJumbotronHeader(...)` 对 `competition.brand` 和 `competition.title` 做去重；两者相同时只渲染一次，避免页头重复。
- `renderJumbotronMainReplayControls(...)` 将 `data-replay-status` 设为默认隐藏，不再显示 `最终主视觉`。
- replay 脚本新增 `setReplayStatus(...)`，回放中显示状态，恢复最终画面时清空并隐藏状态。
- 全局 pill 样式补 `.pill[hidden]{display:none}`，修复空 `data-replay-status` 被 `.pill{display:inline-flex}` 撑出绿色空框的问题。
- `jumbotron-profile-drawer` 单独放宽展开高度，确保 `数据视图` 和 `赛道选择` 两组内容完整展开。
- `renderJumbotronFooter(...)` 将赛事状态从两段带冒号、分号的长句改成四个分行信息块：`主题`、`主办方`、`阶段`、`下一步`。
- `verify.js` 增加回归断言：不允许 `最终主视觉`、重复页头、空状态 pill、`主题：`、`主办方：`、`阶段：`、`；下一步` 等问题回归。

### 浏览器验收证据

固定入口：

```text
http://127.0.0.1:4400/jumbotron
```

服务启动命令：

```bash
npm --prefix "/media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001" start
```

本轮特别记录：一次修复后只在临时端口完成验证，没有将 4400 切到最新代码。用户指出“你没有启动服务 警告一次”。随后重启 4400，并把后续页面修改的验收标准收紧为：最终汇报前必须确认固定入口已运行最新代码。

浏览器与 DOM 检查证据：

```text
页头：LIVE / DevCompass Racing
DevCompass Racing 出现次数：1
页面包含“最终主视觉”：false
回放状态 hidden：true
空状态 display：none
空状态宽高：0×0
```

数据视图抽屉：

```text
bodyScrollHeight: 460
bodyClientHeight: 460
complete: true
```

赛事状态抽屉：

```text
主题
Agentic Development

主办方
DevCompass

阶段
ROUND 3 · 实时赛事

下一步
ROUND 4 · 最终冲刺

冒号：false
分号：false
```

截图产物：

- `PoC-GRS-001/jumbotron-copy-dedup-review.png`
- `PoC-GRS-001/jumbotron-replay-status-hidden-review.png`
- `PoC-GRS-001/jumbotron-profile-drawer-full-review.png`
- `PoC-GRS-001/jumbotron-status-lines-review.png`

验证命令：

```bash
ARY_GRS001_PORT=4570 ARY_GRS001_ORGANIZER_PORT=4571 npm --prefix "/media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001" run verify
```

结果：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

### 边界

- 本轮未 commit、未 push。
- 本轮只记录 Jumbotron 公开页 UI 文案和抽屉布局收敛，不代表 Calibrator、录制入口或其他页面已完成同等级视觉审阅。
- `targetUrl`、`remoteCockpitUrl`、本地绝对路径、raw session log 和完整内部日志仍不进入 public Jumbotron 页面。

## 队伍图例悬停菜单贴近展开修复

2026-06-14，用户指出鼠标悬停后的二级菜单没有尽可能在队伍图例最近位置展开。

### 修复记录

- 将“小地图和队伍图例”抽屉中的每一条队伍图例从普通文本改为 `legend-entry` 焦点源。
- 每个图例项现在带有稳定的 `data-legend-entry-id`，并复用 entry tooltip 信息。
- 新增 `.legend-entry .html-tooltip` 定位规则：桌面端优先在当前图例项右侧 `calc(100% + 10px)` 贴近展开。
- 新增 `.jumbotron-focus-source.legend-entry:hover .html-tooltip` 高优先级规则，避免通用 tooltip hover 规则把图例菜单重新拉回上方。
- 小地图抽屉 body 增加 `overflow:visible`，避免右侧贴近展开的图例菜单被抽屉裁剪。

### 验证

```text
LEGEND_TOOLTIP_CHECK pass
legendEntries=12
legendIds=12
nearCss=true
overrideCss=true
visibleDrawer=true
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

固定入口需重启到本轮代码：

```text
http://127.0.0.1:4330/jumbotron
```

