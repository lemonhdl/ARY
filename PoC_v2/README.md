# ARY PoC_v2

PoC_v2 在 v1 提交评测闭环上增加登录、组织方视图和多队伍隔离。

## 运行

终端 1 启动 ARY：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2
npm start
```

打开：

`http://127.0.0.1:4400`

终端 2 启动组织方评测服务：

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2
npm run start:organizer
```

如果不启动组织方评测服务，队伍提交后会显示暂时无法完成评测，Records 和回放不会开放。

## 开发账号

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 组织方 | `Organizer_001` | `********` |
| 队伍 | `team_001` | `******` |
| 队伍 | `team_002` | `**********` |

这些账号只用于本地演示。

## 页面

- `/login` 登录
- `/organizer` 组织方控制台
- `/team` 队伍首页
- `/team/submit` 本队提交
- `/team/records` 本队 Records
- `/team/records/:recordId` 本队 Record 详情
- `/team/replay` 本队回放
- `/leaderboard` 赛事榜单

## 已覆盖用例

组织方：

- 登录后查看队伍提交摘要
- 查看多维评价维度
- 查看榜单展示内容
- 不能作为队伍进入队伍页面

队伍：

- 登录后进入本队工作区
- 未提交时不能查看 Records、详情和回放
- 提交但组织方评测服务不可用时显示暂时无法评测
- 组织方评测服务可用时，提交后开放本队 Records、详情和回放
- 队伍只能看到本队提交、Riding Record 和回放事件
- 队伍不能访问组织方控制台
- 队伍不能通过接口读取其他队伍提交

公开展示：

- 榜单只展示队伍、名次、等级和公开评语
- 页面不展示本地路径、内部文件名、受保护存储名和过细评审材料

## 验证

```bash
cd /media/lemonhdl/Shared/Software_Engineering/ARY/PoC_v2
npm run verify
```

期望输出：

```text
VERIFY_PASS ARY PoC_v2 role boundary holds
```
