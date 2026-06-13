# Grandstand Oval —— 校准说明（notes.md）

> 对应资产目录 `assets/tracks/grandstand-oval/`，本目录提供 `track.profile.json`（运行时事实来源）。
> `background.webp` / `preview.png` 为占位说明，正式资产由 AI-assisted Asset Pipeline 产出后替换。

## 资产清单（冻结目标）

| 文件 | 角色 | 当前状态 |
|---|---|---|
| `track.profile.json` | 运行时事实来源（几何/车道/检查点/气泡区） | ✅ 已提供 |
| `background.webp` | 视觉底图（16:9，仅负责氛围） | ⛳ 占位，待替换 |
| `preview.png` | 带 overlay 的预览图 | ⛳ 占位，待替换 |
| `notes.md` | 本文件 | ✅ |

## 几何设计

- **画布**：`viewBox = [0,0,1920,1080]`，16:9 大屏。
- **中心线**：16 点闭合 polyline + Catmull-Rom 平滑（`tension 0.5`），近似椭圆（中心 ~`(960,610)`，水平半径 ~780，竖直半径 ~290）。
- **行进方向**：点序即方向。起/终点在**前直道右端 `(1740,610)`**；行进顺序为「上右弯 → 后直道(右→左) → 下左弯 → 前直道(左→右) 回终点」。
  - 屏幕坐标系(y 向下)中表现为顺时针；**前直道由左向右**，使领先者落在画面右侧 —— 复刻高保真图构图。
- **车道**：**12 条**，沿法线偏移 `-88 / -72 / -56 / -40 / -24 / -8 / +8 / +24 / +40 / +56 / +72 / +88`（px），间距 16px。负值偏内圈，正值偏外圈（前直道即贴近观众一侧），lane-1..lane-12 与 12 个 entry 一一对应。
- **检查点**：`s = 0.0 / 0.25 / 0.5 / 0.75`，对应 Start·Far Turn·Back Straight·Home Straight。

## 位置派生（务必遵守的铁律）

马匹位置**不写死 x/y、不从底图反推**，由进度沿几何派生：

```
roundProgress → 归一化 s → 采样中心线点 → 切线/法线 → lane offset → 马匹 x/y/rotation
```

补间在 **s 轴**进行（不是 x/y），避免弯道切内圈。本数据集中 12 匹马的 `roundProgress`
（0.930 / 0.872 / 0.845 / 0.808 / 0.760 / 0.728 / 0.690 / 0.655 / 0.612 / 0.560 / 0.515 / 0.470）
从前直道右端一路铺到左弯，形成「领先者在右、中段成群、尾段掉队/stale」的画面；
12 匹分配到交错车道（lane 6/1/9/3/12/5/2/8/11/4/7/10，按 rank 序）以错开竖向重叠。

## 气泡落位

- `messageZones`：顶部天空带 + 内场中心，气泡优先落在此处。
- `noBubbleZones`：Header / TOP3+KPI 行 / 左侧栏 / 底部 ticker / Footer —— 气泡不得遮挡。
- 降噪：每匹马同时最多 1 个气泡，全局最多 3 个，风险/里程碑优先，其余进 ticker。

## 校验（对照《子系统定义》§9.1）

- [x] schemaVersion / trackId / viewBox / background 齐备
- [x] 闭合赛道 ≥ 4 点（实际 16 点）
- [x] direction 合法
- [x] startFinish.s 与全部 checkpoints.s ∈ [0,1]
- [x] lanes ≥ 1（实际 **12 条**），offset 不重复
- [x] 相邻采样点无异常跳变（近似椭圆，曲率平滑）
- [x] ≥ 8 马多马预览（本集 **12 匹**，满足《子系统定义》§8.3 第 4 条「≥8 匹多马预览」）
- [ ] 单马 0%→100% 预览（待接 track-runtime / Calibrator 后人工确认）
- [ ] 替换占位 `background.webp` / `preview.png` 为正式资产后再正式冻结
