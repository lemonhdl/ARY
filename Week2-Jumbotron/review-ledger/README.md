# Jumbotron 架构审阅台账

本目录记录 `cc-Jumbotron` 对 Jumbotron 实现的行级审阅。

## 标准

只以两份源文档为准：

- `../docs/source/jumbotron-information-architecture.md`
- `../docs/source/jumbotron-subsystem-definition.md`

## 有效阅读

某一行只有在同时满足下面三点时，才计为一次有效阅读：

1. 审阅时明确引用该源文档行号。
2. 对照 `cc-ARY` 的实现或文档，判断该行要求已实现、未实现或部分实现。
3. 基于该判断给出修改意见、下一步实现方向，或确认无需修改。

只读取文档、只做摘要、只在脑中理解，不增加有效阅读次数。

## 文件

- `source-line-ledger.jsonl`：每个源文档行号的累计有效阅读次数和最近结论。
- `review-events.jsonl`：每次审阅事件，记录引用行、实现证据、状态和发给 `cc-ARY` 的要求。
- `screenshots/`：每次页面截图审阅的全屏图、区域裁剪图和长屏图证据。

## 视觉审阅

Jumbotron 审阅必须同时看代码和看图。每次涉及页面实现时，先打开当前页面并保存截图，再按人类观看大屏的方式判断：

1. 3 秒内能否识别全局状态、赛事主题和当前重点。
2. 10 秒内能否看懂主舞台正在发生什么，以及哪支队伍或哪类事件最重要。
3. 颜色是否只表达状态，不把装饰色和风险色混用。
4. KPI、主赛道、侧栏、ticker、footer 是否形成清晰层级。
5. 现场观众默认只看到摘要，审阅者细节通过 hover tooltip、popover、折叠面板或固定详情栏进入。
6. tooltip 不遮挡标题、KPI、主赛道关键对象；边缘处需要翻转或改用右侧详情栏。

参考方向：Grafana / Netdata 的 KPI 与告警层级、Open MCT 的任务控制台结构、Uptime Kuma / Cachet 的状态页克制表达、ECharts / Observable / Vega-Lite 的 hover tooltip 和 focus details。

## 状态字段

- `unreviewed`：尚未形成有效审阅。
- `implemented`：该行要求已在实现中满足。
- `partial`：已有部分实现，但仍有缺口。
- `missing`：实现中未覆盖该行要求。
- `not_applicable_yet`：当前实现阶段尚未触及该行，但后续需要回查。
