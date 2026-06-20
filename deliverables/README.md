# ARY 统一交付目录

本目录是 `todos/` 任务包对应的统一交付入口。A 到 E 每组的实现产物都必须落在这里，供第 5 人自动发现、自动校验和自动集成。

## 1. 目录结构

```text
deliverables/
├─ a-rider/
├─ b-admin/
├─ c-frontend/
├─ d-data/
└─ e-integration/
```

## 2. 最低要求

1. 每组目录都必须保留 `handoff.manifest.json` 或从模板复制出的正式 manifest。
2. 每组只在自己的目录中交付产物，不跨目录放文件。
3. 第 5 人只读取这里的产物，不回读 `tasks/` 或 `todos/` 里的说明文档作为运行输入。
4. 需要代码、静态资源或样例文件时，也优先放在自己组目录的子目录中，不要求直接改 `app/`。

## 2.1 默认目录 ownership

1. A 只改 `deliverables/a-rider/`。
2. B 只改 `deliverables/b-admin/`。
3. C 只改 `deliverables/c-frontend/`。
4. D 只改 `deliverables/d-data/`。
5. E 只改 `deliverables/e-integration/`，并负责读取本目录完成运行态装配。

## 3. 当前状态

目录骨架仍作为统一交付入口保留，但当前仓库已不再只是模板阶段：A-Rider、B-Admin、C-Frontend、D-Data 均已存在正式 `handoff.manifest.json` 与对应交付物，E 侧也已基于这些目录完成运行态装配与 app 集成。