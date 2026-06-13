# Real Explicit Closed Course —— 人工确认第二赛道说明

本目录是 cc-data 使用 `/real-image-generation` 得到的真实图像版第二赛道候选。它通过独立视觉复核：清楚闭合成一圈，且不是普通椭圆/标准操场。

## 资产清单

| 文件 | 角色 | 当前状态 |
|---|---|---|
| `source-generated-image.png` | 真实图像生成源图 | 候选源图 |
| `background.webp` | Jumbotron 视觉底图 | 已生成，用户人工确认通过 |
| `preview.png` | 带 overlay 的校准预览 | 已生成，用户人工确认通过 |
| `track.profile.json` | 几何候选 profile | 已生成，用户人工确认通过 |
| `asset-provenance.json` | 来源与处理方式 | 已记录 |
| `asset-validation.json` | 最小验证结果 | pass |
| `real-explicit-closed-course-reading.html` | 读图页 | 已生成 |

## 当前判断

- 真实图像生成：成功。
- 闭合成一圈：是，独立视觉复核 pass。
- 普通椭圆/标准操场：否。
- 复杂度：有 S 弯、发卡弯、斜向穿行、局部收束、不对称外扩/内收。
- 风格：高亮冰蓝、银白、浅灰，接近 `background1.png` 的 Jumbotron 曲线道路感。
- 图内文字/logo/watermark：未见。

## 边界

用户已在运行中的 Jumbotron 主视图人工确认该第二赛道没有问题；它可作为显式切换的已确认第二赛道使用。默认 `/jumbotron` 仍保持当前公开赛道，不自动替换。

## cc-Jumbotron human trace update

- 用户已通过 `cc-jumbotron-centerline-tracer.html` 在原始 `source-generated-image.png` 上描出主中心线。
- Active `track.profile.json` 已切换到 `human-traced-polyline`，40 个点，闭合路线，12 条 lane offsets。
- `human-traced-centerline.validation.json` 状态为 `pass`：无自交、路径长度 4125.33px、非普通椭圆启发式通过。
- `human-traced-centerline.preview.png` 和 active `preview.png` 是带 overlay 的候选预览；底图本身仍不烘焙文字。
- 边界：该资产已通过用户人工视觉确认，可显式进入第二赛道主视图；runtime geometry 仍以 `track.profile.json` 为事实源，底图不作为几何事实源。
