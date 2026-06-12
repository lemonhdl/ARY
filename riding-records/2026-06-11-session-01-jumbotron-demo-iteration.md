# Riding Record — 2026-06-11 — Session 01 — Jumbotron Demo Iteration

## [2026-06-11 23:53:43] Prompt

用户围绕 Jumbotron Demo 的资产与展示效果，连续提出并推进了以下需求：

1. 查看两个 Jumbotron Markdown 文档，提炼与竞技场背景、骑手及相关资产制作有关的要求；
2. 明确资产范围，重点确认除了背景、骑手、气泡之外还需要哪些资产；
3. 讨论骑手动画实现方式，确定不使用 GIF，而使用分帧图片 / sprite sheet 思路；
4. 讨论赛道形态，确认不要求必须为圆形，并进一步提出“首尾可拼接背景”的方案；
5. 反复迭代背景图与 rider 资产的生图提示词，包括：
   - 白色主调；
   - 蓝白网站适配；
   - 强调跑道感；
   - Q 版 / 透明背景；
   - 木牌 / 舞台剧风格；
   - rider 朝向右侧、骑马、带柄木牌等约束；
6. 将本地 `background.png`、`rider.png`、后续 `rider2.png` 接入 Demo，并多轮微调：
   - 人物大小；
   - 手柄显示完整度；
   - 纵向位置；
   - 去除名字标签与气泡；
   - 让牌子动而不是 rider 本体动；
   - 让每个骑手的动画错峰初始化，不同步摆动；
7. 纠正背景实现方向：
   - 不是“背景自动滚动”；
   - 而是“同一背景图横向拼接形成长场景”，再通过 0%~100% 的相机视角窗口去浏览不同区间；
8. 将网站整体主色调改为白色系；
9. 最后要求整理今天这次 Demo 讨论与实现过程的骑行记录，用于带去小组讨论。

---

## [2026-06-11 23:53:43] Agent Answer

### 一、文档理解与资产口径确认

- 阅读并提炼了：
  - `C:/Users/ROG/Desktop/se/ary-002/Jumbotron信息架构.md`
  - `C:/Users/ROG/Desktop/se/ary-002/Jumbotron子系统定义.md`
- 识别出对资产制作最核心的约束：
  - 背景只负责视觉，不承载业务定位；
  - 赛道几何、位置、名次、消息不能写死进底图；
  - rider 更适合做成独立动态层；
  - 推荐舞台剧 / 木牌化表达，可降低逐帧动画成本并强化风格统一性。

### 二、Prompt 与资产方案探索

围绕背景与 rider 资产，完成了多轮 Prompt 设计迭代，逐步锁定以下方向：

- 背景：
  - 简约、明亮、白色主调；
  - 适配蓝白色网站；
  - 强调跑道感；
  - 支持横向拼接；
  - 适合做成长赛道世界的重复单元；
- rider：
  - Q 版；
  - 透明背景；
  - 右向骑马；
  - 舞台木牌 / 带柄木牌；
  - rider 本体静态，动画由木牌整体承担。

### 三、Demo 接入与前端改造

对本地 Demo 完成了多轮真实改动与验证，涉及文件包括：

- `C:/Users/ROG/Desktop/se/ary-002/src/render-jumbotron.js`
- `C:/Users/ROG/Desktop/se/ary-002/public/jumbotron.css`
- `C:/Users/ROG/Desktop/se/ary-002/src/server.js`

主要实现内容：

1. 接入本地背景与 rider 资源：
   - 使用 `background.png` 作为主背景；
   - 使用 `rider.png`，后续切换为 `rider2.png`；
2. 将赛道上的 entry marker 改造成木牌 rider 方案；
3. 删除赛道上的消息气泡；
4. 删除 rider 名称标签，仅保留 rider 木牌与 rank 圆点；
5. 多轮调整 rider：
   - 放大；
   - 下压；
   - 显示完整手柄；
   - 再次切换到更长手柄的 `rider2.png`；
6. 给木牌增加舞台式动效：
   - 轻微上下浮动；
   - 左右摆动；
   - blocked / stale / pit_stop / takeover 做轻量节奏区分；
7. 给每个 rider 设置不同 `animation-delay`，让木牌动效不再同步；
8. 将整体网站主色调从深色改为白色 / 浅蓝白体系。

### 四、背景机制从“自动滚动”修正为“长世界 + 相机”

根据用户纠正，废弃了“CSS 背景自动循环滚动”的错误实现，改为：

- 将背景视为一张可横向拼接的 tile；
- 在页面中拼成一条更长的 `track world`；
- 将整个 world 映射成 0%~100%；
- 页面当前只展示一个 viewport；
- 新增“视角进度”滑条，通过拖动滑条移动相机，而不是让背景自己滚动；
- rider 按全局进度映射到长 world 中，在不同视角下观察不同区段。

### 五、验证结果

整个过程中多次运行：

```bash
npm run verify
```

验证均通过，最终 Demo 可在本地访问：

- `http://127.0.0.1:4300/`
- `http://127.0.0.1:4300/calibrator`

### 六、关键决策（供小组讨论）

**关键决策 1：rider 不做真实逐帧骑行动画，而做“木牌整体动效”。**

原因：
- 资产成本更低；
- 风格更统一；
- 更适合 Jumbotron 舞台化表达；
- 更便于和赛道定位逻辑分离。

**关键决策 2：背景不是无限滚动贴图，而是“长世界 + 相机窗口”。**

原因：
- 更符合 0%~100% 赛段浏览逻辑；
- 更容易支持拖动进度条查看不同区间；
- 更接近后续真实赛段浏览需求。

**关键决策 3：整体 UI 切换到白色 / 浅蓝白主调。**

原因：
- 更贴合当前背景和 rider 风格；
- 更利于小组讨论时展示视觉统一性；
- 更符合“明亮、舞台剧、Q 版”资产方向。

### 七、重要文件 / 产出路径

- 文档参考：
  - `C:/Users/ROG/Desktop/se/ary-002/Jumbotron信息架构.md`
  - `C:/Users/ROG/Desktop/se/ary-002/Jumbotron子系统定义.md`
- 参考图：
  - `C:/Users/ROG/Desktop/se/ary-002/target.png`
- 背景资产：
  - `C:/Users/ROG/Desktop/se/ary-002/background.png`
- rider 资产：
  - `C:/Users/ROG/Desktop/se/ary-002/rider.png`
  - `C:/Users/ROG/Desktop/se/ary-002/rider2.png`
- 前端实现：
  - `C:/Users/ROG/Desktop/se/ary-002/src/render-jumbotron.js`
  - `C:/Users/ROG/Desktop/se/ary-002/public/jumbotron.css`
  - `C:/Users/ROG/Desktop/se/ary-002/src/server.js`
- 本地运行入口：
  - `http://127.0.0.1:4300/`

---

## Steering

（留空，待用户补充）
