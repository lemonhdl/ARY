# Explicit Closed Complex Course —— 候选资产说明

本目录是 cc-data 对第二赛道资产的当前候选。上一版仍没有清楚读成闭合赛道，所以本版改为本地可控绘制：先定义闭合复杂 centerline，再从同一几何绘制赛道底图和 preview。

## 资产清单

| 文件 | 角色 | 当前状态 |
|---|---|---|
| `source-controlled-render.png` | 可控绘制源图 | 候选源图 |
| `background.webp` | Jumbotron 视觉底图 | 候选已生成，待人工 review |
| `preview.png` | 带 overlay 的校准预览 | 候选已生成，待人工 review |
| `track.profile.json` | 几何候选 profile | 候选已生成，待 Calibrator 复核 |
| `asset-provenance.json` | 来源与处理方式 | 已记录 |
| `asset-validation.json` | 最小验证结果 | pass |

## 当前判断

- 闭合成一圈：是，底图赛道由同一 closed centerline 绘制。
- 普通椭圆/标准操场：否，包含 S 弯、发卡弯、斜向穿行、局部收束和不对称转向。
- 风格：冰蓝、银白、浅灰，贴近 `background1.png` 的 Jumbotron 曲线道路感。
- 图内文字/logo/watermark：无。

## 边界

这是 candidate asset，不是 confirmed asset。正式接入前必须在 Calibrator 中复核 centerline、direction、lane offset、message/no-bubble zones 和 0%→100% 单马预览。
