# ARY GRS 001 Agent Riding Record PoC

这个 PoC 证明两件事：ARY 能展示和回放 Agent Riding Record；参赛者提交后才会产生评测状态，并解锁 Riding Record 与回放内容。平台页面面向参赛者和评审展示，不暴露内部路径、版本号、服务请求或调试信息。

## 运行

终端 1 启动 ARY 平台：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC
npm start
```

打开：

`http://127.0.0.1:4100`

关键页面：

- `/` Race 首页
- `/records` Agent Riding Records
- `/records/record-session-02` Record 详情
- `/replay/record-session-02` Riding Record 回放
- `/evidence` 提交与评测

## 提交评测实验

`/evidence` 页面提供参赛者提交入口。提交前，`/records`、Record 详情和回放页只显示提交引导；提交 `满分答案` 后才会显示 Riding Record、详情和回放内容。

只启动 ARY 时，先提交：

```text
满分答案
```

页面会显示数据缺失。

终端 2 启动评测进程：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC
npm run start:organizer
```

再次在 `/evidence` 提交 `满分答案`，页面会显示 mock 评测结果：

```text
这个小组的解答测评结果为:满分!
```

在终端 2 按 `Ctrl+C` 关闭评测进程，再次提交，页面会重新显示数据缺失。

这个实验说明：只有参赛者提交后，平台才触发评测。评测能力不可用时，平台不会凭空给出结果。

## 验证

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC
npm run verify
```

通过标志：

```text
VERIFY_PASS ARY PoC participant submission experiment holds
```

## 页面展示边界

平台页面展示：

- Race 信息
- Riding Record 列表 提交后显示
- Record 详情 提交后显示
- Riding Replay 提交后显示
- 参赛者提交入口
- 本次提交的评测状态

平台页面不展示：

- 内部路径
- 版本指纹
- JSON 快照
- 服务请求细节
- 未公开材料
- 评审细则

## 证明点

1. ARY 可以展示 GRS 001 Race。
2. 未提交时，Records、详情和回放页只显示提交引导。
3. 提交后，ARY 可以组织并展示 Agent Riding Record。
4. Record 详情页展示 Prompt、Agent Output、Steering 三类过程证据。
5. Replay 页面能按事件流回放 Agent Riding 过程。
6. 未提交时，平台不会出现评测结果。
7. 提交后数据不可用，平台提示数据缺失。
8. 提交后数据可用，平台显示本次提交的评测结果。
9. 数据再次不可用后重新提交，平台重新提示数据缺失。
