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

当前仅创建目录骨架和模板文件，供后续各组填充真实实现产物。