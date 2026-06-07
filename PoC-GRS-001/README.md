# ARY GRS 001 PoC

这个 PoC 证明：Race 源数据留在 Organizer 侧，ARY 只读取公开披露数据，也能完成 Race 发现、组织入口、提交状态和公开展示。

完整说明见：

```text
PoC说明文档.md
```

## 运行

启动 ARY 页面服务：

```bash
npm start
```

另开终端启动 Organizer 本地评测服务：

```bash
npm run start:organizer
```

打开：

```text
http://127.0.0.1:4400
```

## 演示账号

| 身份 | 账号 | 密码 |
| --- | --- | --- |
| Organizer | `Organizer_001` | `********` |
| Team 001 | `team_001` | `******` |
| Team 002 | `team_002` | `**********` |

## 推荐路径

1. `/yard`：查看公开 Race 列表。
2. `/race/grs-001`：查看公开详情和参与入口。
3. `/organizer/race`：查看 Organizer 侧创建记录、披露字段和生命周期控制。
4. `/organizer`：切断或恢复本地数据服务。
5. `/team/submit`：提交方案和整理后的 Riding Record 摘要。
6. `/team/records` 与 `/team/replay`：查看本队过程证据和回放记录。
7. `/leaderboard`：查看公开结果和六维结果画像。

## 验证

```bash
npm run verify
```

期望输出：

```text
VERIFY_PASS GRS001 creation disclosure lifecycle riding evidence result radar holds
```

## 数据位置

- `organizer-private/`：Organizer 私有源数据、评测依据和披露控制。
- `ary-public-store/`：ARY 可见的公开披露、Race 状态和公开榜单。
- `ary-protected-store/`：Team 提交状态和整理后的过程证据摘要。
