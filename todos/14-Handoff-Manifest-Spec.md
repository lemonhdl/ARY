# Handoff Manifest 规范

## 1. 目标

让 E 能自动发现和读取 A、B、C、D 的交付，而不是靠口头说明或手工找文件。

## 2. 每组必须提供

每组都必须在自己的 `deliverables/<group>/` 目录下提供：

`handoff.manifest.json`

## 3. 最低字段

```json
{
  "group": "a-rider",
  "version": "0.1.0",
  "contractVersion": "0.1.0",
  "dependsOn": [],
  "artifacts": [
    {
      "name": "riding-events.sample.json",
      "path": "deliverables/a-rider/riding-events.sample.json",
      "required": true,
      "type": "sample-data"
    }
  ],
  "notes": ""
}
```

## 4. 字段说明

1. `group`: 组标识，固定为 `a-rider`、`b-admin`、`c-frontend`、`d-data`、`e-integration`。
2. `version`: 当前交付版本。
3. `contractVersion`: 对应公共契约版本。
4. `dependsOn`: 依赖的上游组。
5. `artifacts`: 当前交付物清单。
6. `notes`: 额外说明。

## 5. E 的自动发现规则

E 必须按以下路径自动扫描：

1. `deliverables/a-rider/handoff.manifest.json`
2. `deliverables/b-admin/handoff.manifest.json`
3. `deliverables/c-frontend/handoff.manifest.json`
4. `deliverables/d-data/handoff.manifest.json`

## 6. 执行要求

1. 没有 manifest 的交付视为不可自动集成。
2. manifest 中声明为 `required` 的产物缺失时，E 必须在兼容性报告中报错。
3. manifest 是自动集成入口，不是可选说明文件。