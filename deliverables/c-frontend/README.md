# C 组交付目录

本目录用于交付前端产品壳、页面依赖清单和 adapter 契约。

正式交付文件：

1. `handoff.manifest.json`
2. `route-map.json`
3. `page-dependencies.json`
4. `adapter-contract.md`
5. `fallback-rules.md`
6. `shell-readme.md`
7. `app-shell/` 目录

当前正式交付已包含上述文件；`handoff.manifest.template.json` 仅作为后续迭代模板保留。

返工后，`app-shell/prototype/script.js` 暴露 `window.ARY_C_FRONTEND`，E 可以通过 `applyRouteState` / `applyPath` 接管 Home race、Works filter、Work detail、Rider CTA、Results / Review、Screen mode 等状态，不需要继续 monkey patch 原型内部函数或 DOM。
