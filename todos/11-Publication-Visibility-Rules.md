# 发布态与可见性规则

本文件是分发版发布态与可见性规则。规则口径以 `tasks/ARY-publication-visibility-rules.md` 为基础，但这里收敛为实施最低要求。

## 1. Public 总规则

Public 只能访问已公开、已发布资源。

## 2. 原始数据总规则

1. 原始 CA Session 永不进入公开端。
2. Live Hall / Screen Display 只能使用 Projection 和脱敏事件流。
3. Results / Review 不得把 Projection 当成最终事实源。

## 3. 第一轮最低判定

### Work

只有 `visibility = public` 才能进公开端。

### Result

只有 `published = true` 或等价 `publicationStatus = published` 才能进公开端。

### Review / Report

只有已发布且公开可见才能进公开端。

### Rider Profile

只有公开档案才能进公开端，且不得包含原始 RidingRecord / 原始 CA Session。

## 4. 执行要求

1. C 不得在页面里自发明公开规则。
2. D 必须在权威 mock 里给出公开判定所需字段。
3. E 必须自动校验上游产物是否违反本文件规则。
4. 如果只分发 `todos/`，则本文件就是公开判断的直接执行入口，不依赖 `tasks/` 目录。

## 5. 详细规则基线

详细规则直接以 `tasks/ARY-publication-visibility-rules.md` 为权威基线执行。