# ARY GRS001 提交版本

这个版本证明一件事：

> Race 源数据留在 Organizer 侧，ARY 只展示公开披露内容，仍能完成 Race 发现、参与入口、提交状态和公开展示。

## 运行

启动 ARY：

```bash
npm start
```

启动 Organizer 评测服务：

```bash
npm run start:organizer
```

打开：

```text
http://127.0.0.1:4400
```

## 本地账号

| 身份 | 账号 | 密码 |
| --- | --- | --- |
| Organizer | `Organizer_001` | `********` |
| Team 001 | `team_001` | `******` |
| Team 002 | `team_002` | `**********` |

## 演示路径

1. 打开 `/yard`，查看 ARY 当前可见的公开 Race。
2. 打开 `/race/grs-001`，查看 Organizer 主动披露的公开摘要。
3. 使用 `Organizer_001` 登录，进入 `/organizer`，查看 Race 源数据状态和评测可用性。
4. 关闭 Organizer 评测状态后，用 `team_001` 提交，页面显示“数据缺失，暂无法评分”。
5. 重新开启评测状态后提交，Team 可以查看本队整理后的过程证据。
6. 打开 `/leaderboard`，只看到公开排名、等级和公开评语。

## 数据位置

- `organizer-private/`：Organizer 持有的 Race 源数据、评测状态和披露控制。
- `ary-public-store/`：ARY 可展示的公开 Race 摘要、队伍公开信息和榜单公开内容。
- `ary-protected-store/`：队伍提交状态和整理后的 Riding Record 摘要。

Riding Record 只保存整理后的回放记录。本地素材原文保留在 Rider 侧。

## 验证

```bash
npm run verify
```

期望输出：

```text
VERIFY_PASS GRS001 Public Yard / Private Race Source scenario holds
```
