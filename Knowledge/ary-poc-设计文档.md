# ARY PoC 设计文档

> 来源：飞书文档《ARY PoC 设计文档》；同步日期：2026-06-06；revision: 10。
> URL：https://ccndgn2u777a.feishu.cn/docx/QxaKdzjhUoYWfixl6XSccprznjd

**PoC 目标：**跑通一个可点击 Demo，让评审看见 ARY 能展示 Agent Riding Record，并用提交后的状态变化证明受限数据没有被平台持久化为可继续使用的数据。
**PoC 目标：**跑通一个可点击 Demo，让评审看见 ARY 能展示 Agent Riding Record，并用提交后的状态变化证明受限数据没有被平台持久化为可继续使用的数据。

# 1 当前 PoC 目标

| 编号 | 证明点 | Demo 证据 |
| --- | --- | --- |
| P1 | ARY 能展示 Race | 首页展示 ARY Genesis Race Series |
| P2 | ARY 能组织 Agent Riding Record | Records 页面展示两条 Riding Record |
| P3 | Riding 过程可以被详情化和回放 | Record Detail 与 Replay 页面展示关键步骤和事件流 |
| P4 | 提交后才产生评测状态 | 未提交时页面不显示评测结果 |
| P5 | 平台没有保留受限数据继续使用 | 数据不可用后再次提交重新显示数据缺失 |

---

# 2 Demo 页面路径

| 页面 | 作用 | 评审看到什么 |
| --- | --- | --- |
| / | Race 入口 | GRS 001 的主题、状态和平台定位 |
| /records | Riding Record 列表 | 两条可查看、可回放的 Agent Riding Record |
| /records/record-session-02 | Record 详情 | Prompt、Agent Output、Steering 和 Riding Signal |
| /replay/record-session-02 | Riding Replay | 按事件组织的一次 Agent Riding 过程 |
| /evidence | 提交与评测状态 | 未提交、数据缺失、评测完成三种状态 |

---

# 3 实验性证明

同一份提交在数据不可用时无法完成评测，在数据可用时可以得到结果。数据再次不可用后，平台重新显示缺失。这比只展示文件列表更直接。
同一份提交在数据不可用时无法完成评测，在数据可用时可以得到结果。数据再次不可用后，平台重新显示缺失。这比只展示文件列表更直接。

| 阶段 | 操作 | 页面结果 | 证明点 |
| --- | --- | --- | --- |
| 1 | 打开提交页面但不提交 | 还没有评测结果 | 平台不会预置结果 |
| 2 | 提交“满分答案”，数据不可用 | 数据缺失 | 平台没有足够数据完成评测 |
| 3 | 同样提交，数据可用 | 显示本次评测结果 | 平台能使用被授权的本次结果 |
| 4 | 数据再次不可用后重新提交 | 再次数据缺失 | 平台没有把受限数据保留下来继续使用 |

---

# 4 页面表达边界

页面应该展示页面不应展示
页面应该展示
## 页面应该展示
- 赛事信息
- Riding Record
- Record Detail
- Replay
- 提交内容和评测状态
页面不应展示
## 页面不应展示
- 内部服务名和开关说明
- 终端操作提示
- 内部请求细节
- 文件名、路径、版本指纹
- JSON 快照和 debug 字段

---

# 5 实现策略

| 策略 | 用途 | 边界 |
| --- | --- | --- |
| 本地 Node 服务 | 支撑可点击 Demo | 只服务 PoC，不包装成生产级系统 |
| 本地 JSON 数据 | 模拟公开展示内容和受限材料 | 公开页面不展示内部文件结构 |
| 单独数据处理进程 | 模拟受限数据可用性 | 平台页面不能控制它 |
| mock 提交 | 触发评测状态变化 | 不把 PoC 做成普通 OJ |
| 自动验收脚本 | 验证页面和数据边界 | 每次修改后运行 |

---

# 6 验证方式

`npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC run verify`
npm --prefix /media/lemonhdl/Shared/Software_Engineering/ARY/PoC run verify

| 检查项 | 期望 |
| --- | --- |
| 页面加载 | /、/records、Record Detail、Replay、/evidence 都可访问 |
| 提交前状态 | 不显示评测结果 |
| 提交后状态 | 根据数据可用性显示缺失或完成 |
| 页面可读性 | 不出现内部路径、文件名、版本指纹、终端说明或请求细节 |
| 主线一致性 | 页面围绕 Agent Riding Record，而不是排行榜或刷题 |

---

# 7 后续同步

等待 cc-ARY 完成页面文案清理。

同步最新 verify 结果。

把最终演示脚本整理成可给评审看的版本。

根据实际页面截图补充展示材料。
