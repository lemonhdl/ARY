# GRS001 UI image prompts

这些素材用于增强 PoC 观感和观众引导能力。当前 PoC 先用 CSS 渐变、占位图饰和分栏完成页面，不等待图片生成。后续由用户统一复制 prompts 给 gpt-image-2。

## 统一风格

- 未来感课堂竞技场，但保持克制、清晰、可信。
- 深蓝、靛蓝、暖橙、少量玫红点缀。
- 适合网页 hero 背景和卡片图饰。
- 不出现真实文字、Logo、端口、代码、路径、JSON、API、账号、密码。
- 不出现具体人物肖像，不生成可识别个人。
- 保持 16:9 或 3:2 画幅，方便裁切。

## 1. Public Yard hero 背景

用途：`/yard` 与 `/race/grs-001` 的 hero 背景。

Prompt:

```text
Create a clean futuristic web hero background for an agent engineering race yard. Show an open digital arena in the foreground, with several subtle lanes leading toward a distant private data vault silhouette. Use abstract light paths to imply public discovery and controlled disclosure. No readable text, no logos, no code, no UI screenshots, no people faces. Style: premium SaaS product illustration, deep navy and indigo base, warm orange highlights, soft gradients, high clarity, spacious composition, 16:9.
```

## 2. Organizer Race 控制台图饰

用途：`/organizer` 与 `/organizer/race` 的右侧视觉卡片或顶部背景。

Prompt:

```text
Create a product illustration for an organizer-controlled race source. Show a secure local data chamber on the left, emitting a narrow controlled disclosure beam toward a public board on the right. Include abstract status nodes for draft, open, paused, expired, and offline without using any text. No readable labels, no code, no file names, no people faces. Style: modern technical dashboard illustration, trustworthy, sharp edges, glassmorphism accents, navy, violet, teal, and amber, 3:2.
```

## 3. Riding Replay 时间线图饰

用途：`/team/records` 与 `/team/replay`，强调 Rider 与 Agent 协同。

Prompt:

```text
Create a clean abstract illustration of a human rider and an AI agent collaborating through a timeline. Show two distinct abstract trails converging into validation checkpoints, with small nodes for plan, observation, steering, validation, and review. Do not show readable text, chat bubbles, code, terminal windows, or real faces. Style: elegant product illustration, dynamic but not busy, deep blue background, violet and green trails, soft glow, 16:9.
```

## 4. Leaderboard 徽章与成果图饰

用途：`/leaderboard` 公开结果区域的卡片或背景。

Prompt:

```text
Create a refined public results illustration for an agent competition leaderboard. Show abstract podium blocks, score bands, and evidence badges as geometric shapes, emphasizing public summaries rather than private process details. No readable numbers, no names, no text, no logos, no UI screenshots. Style: premium educational tech platform, crisp vector-like 3D, navy background, gold and green highlights, 3:2.
```

## 5. 异常状态插画

用途：披露过期、Race 下线、等待 Organizer 更新等状态卡。

Prompt:

```text
Create a calm status illustration for a paused or expired digital race. Show a public arena entrance softly dimmed, with an abstract update beacon waiting from a distant organizer vault. The mood should be clear and non-alarming. No readable text, no warning words, no code, no file names, no people faces. Style: clean SaaS empty-state illustration, pale blue and amber palette, soft lighting, 16:9.
```

## 替换建议

- 生成后优先压缩为 WebP。
- 可放入 `PoC_grs001/assets/` 或作业仓库 `poc/assets/`。
- 只替换 CSS 背景，不改变页面文字和流程。
