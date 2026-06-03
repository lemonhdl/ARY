# ARY GRS 001 PoC 演示脚本

## 演示目标

让老师在 3 到 5 分钟内看懂：

- ARY 展示的是 Agent Riding Race
- 参赛者提交后才会显示 Riding Record 和回放内容
- 平台页面不展示内部路径、版本号或调试信息
- 参赛者提交后才会触发评测
- 数据不可用时，平台不会凭空给出结果

## 准备

终端 1 启动 ARY：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC
npm start
```

打开：

`http://127.0.0.1:4100`

## 点击路径

### 1. Race 首页

打开首页 `/`。

说明：

- GRS 001 的对象是 Agent Riding Record
- 页面展示赛事标题、摘要、状态和生命周期
- 页面不出现内部路径、版本指纹或 JSON 调试信息

### 2. 未提交时的 Records 和回放

打开 `/records`、`/records/record-session-02`、`/replay/record-session-02`。

页面应显示：

```text
请先提交答案
```

说明：

- 未提交时不展示 Riding Record 卡片、详情和回放事件
- 平台不会在参赛者提交前提前展示过程内容

### 3. 参赛者提交和评测状态

打开 `/evidence`。

第一步，只启动 ARY，不启动评测进程。

页面初始状态应显示：

```text
还没有评测结果
```

提交框里填：

```text
满分答案
```

点击提交后，页面应显示：

```text
数据缺失
```

说明：

- 未提交时没有结果
- 提交后才触发评测
- 数据不可用时，平台只提示缺失，不会给出假结果
- 提交后 Records、详情和回放内容被解锁

### 4. 提交后查看 Riding Records

提交后打开 `/records`。

说明：

- ARY 展示两条 Agent Riding Record
- 页面展示 Record 标题、摘要、标签和步骤数
- 不是提交代码、跑测试、刷分的普通 OJ 流程

### 5. 提交后查看 Record 详情

打开 `/records/record-session-02`。

重点讲三列：

- Prompt：Rider 如何给出目标和约束
- Agent Output：Agent 如何执行、实现、复核和验证
- Steering：Rider 如何纠偏，防止 Agent 跑偏

说明：

- 这才是 ARY 想展示的 Agent Riding Skill
- Record 详情只展示适合放在平台上的过程摘要

### 6. 提交后查看 Riding Replay

打开 `/replay/record-session-02`。

说明：

- 回放页按事件流展示一次 Riding 过程
- 可以看到目标下达、Agent 拆解、自动验收、用户 Steering、最终验证
- 这证明 ARY 能展示和回放过程资产

### 7. 数据可用时的评测结果

另开终端启动评测进程：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC
npm run start:organizer
```

回到 `/evidence`，再次提交 `满分答案`。

页面应显示：

```text
这个小组的解答测评结果为:满分!
```

说明：

- 数据可用时，平台可以得到本次提交的评测结果
- 结果不是页面预置的，必须在提交后产生

### 8. 数据再次不可用后的状态

在评测进程终端按 `Ctrl+C` 关闭。

再回到 `/evidence`，再次提交 `满分答案`。

页面应再次显示：

```text
数据缺失
```

说明：

- 数据再次不可用后，平台不能继续完成评测
- 如果平台提前持有可用评测数据，关闭后仍可能继续给结果
- 现在关闭后重新缺失，说明平台没有把外部评测数据变成自己可长期使用的数据

## 自动验收

```bash
npm run verify
```

通过标志：

```text
VERIFY_PASS ARY PoC participant submission experiment holds
```
