# DCR 使用限制

## 禁止嵌套监测

**绝对禁止**对存在父子关系的目录同时启动 DCR 中转站监测。

### 示例

```
❌ 禁止：
  DCR_PROJECT_DIR=/home/rider/project-A    # 监测父目录
  DCR_PROJECT_DIR=/home/rider/project-A/sub # 同时监测子目录

❌ 禁止：
  中转站 A 监测 /workspace/
  中转站 B 监测 /workspace/module-x/
```

### 原因

DCR 每轮对话后对项目文件做 SHA256 快照。如果在父目录 A 中修改了子目录 B 的文件：

- 中转站 A 记录：文件变更 → fileHash 变化
- 中转站 B 记录：文件变更 → fileHash 变化

但 B 的变更会导致 A 的文件快照哈希改变，而 A 的链条目中记录的对话可能并未涉及 B 的修改。结果是**两条链的文件演进路径都对不上**，提交验证双双失败。

### 正确做法

```
✅ 只监测最外层项目目录：
  DCR_PROJECT_DIR=/home/rider/project-A

✅ 不同项目放在不同目录，各自独立监测：
  DCR_PROJECT_DIR=/home/rider/race-1   # 比赛一
  DCR_PROJECT_DIR=/home/rider/race-2   # 比赛二（另启一个中转站实例）
```

## 多比赛隔离

同一用户参加多场比赛时，每场比赛应使用独立的项目目录，并为每个目录启动独立的中转站实例。

中转站通过 `用户哈希 + 项目路径哈希` 组合键隔离不同项目的哈希链，确保互不干扰。
