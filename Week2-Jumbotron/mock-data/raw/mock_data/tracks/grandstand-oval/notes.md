# Grandstand Oval —— 已撤回候选说明

本目录保留为错误反例和 raw geometry 参考，不再作为第二赛道候选资产交接。

## 撤回原因

用户指出第二赛道不要是椭圆赛道。此前生成的 `background.webp` / `preview.png` 错误收敛为通用椭圆/操场环道语义，没有吸收 riding record 中“轨道不能停留在旧通用椭圆、要继承 background1 曲线道路风格、底图只做视觉且要可校准”的约束。

## 当前状态

| 文件 | 当前状态 |
|---|---|
| `withdrawn-oval-background.webp` | 已撤回，不可接入 |
| `withdrawn-oval-preview.png` | 已撤回，不可接入 |
| `withdrawn-oval-real-background-candidate.png` | 已撤回，不可接入 |
| `track.profile.json` | 保留为撤回反例，`meta.doNotUse=true` |
| `asset-provenance.json` | 撤回原因 |
| `asset-validation.json` | `status=withdrawn` |

新的纠偏候选在 `../nonoval-curve-course/`。进入正式 Jumbotron asset flow 前仍需要人工 review。
