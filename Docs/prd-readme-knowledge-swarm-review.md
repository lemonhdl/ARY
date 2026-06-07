# PRD 联合审阅报告：README、知识库与蜂群反思

审阅对象：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md`

本报告只记录审阅结论。未修改 PRD 主稿。

## 依据

- 作业评审标准：`/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/README.original.md`
- 当前提交 README：`/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/README.md`
- 当前 PRD 主稿：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md`
- PoC 表述待更新清单：`/media/lemonhdl/Shared/Software_Engineering/ARY/Docs/prd-poc-final-version-update-checklist.md`
- 知识库重点材料：
  - `ARY/Knowledge/0603小组线下讨论内容分析.md`
  - `ARY/Knowledge/prd-内外边界与角色分析方法.md`
  - `ARY/Knowledge/poc-范围与演示策略.md`
  - `ARY/Knowledge/riding-record-去中心化设计.md`
  - `ARY/Knowledge/非功能需求.md`

## 蜂群审阅分工

这次审阅让蜂群从四个方向并行检查：

1. 评分标准对齐：按 `README.original.md` 的硬门槛、评分项和一票否决项审阅。
2. 最终 PoC 对齐：按当前提交 `README.md` 的运行路径、页面路径、验证命令和演示脚本审阅。
3. 知识库口径对齐：检查是否违背已沉淀的 ARY 数据主权、PoC 边界和 Riding Record 去中心化口径。
4. 反方挑刺：以严格评审视角找过强承诺、证明链缺口、术语不稳和表达风险。

## 总体判断

当前 PRD 的主线是成立的：它清楚回答了 `Race 数据留在 Organizer 侧，ARY 仍能完成赛事创建、披露、组织与展示` 这个命题，也已经补上角色、用户价值、权限矩阵和数据流图。

但它还不适合直接作为最终提交版。最大问题不是概念方向，而是当前 PRD 仍混有旧 PoC 设想，与 `ary-grs-001-sinbawang/README.md` 中的最终可运行版本不一致；同时部分能力写得像已经实现或已经具备安全证明，容易被评审追问。

建议后续修改顺序：先统一 PoC 事实，再收紧 Riding Record 与数据持久化口径，最后补强 Agent Riding Skill 的证据链。

## P0：必须优先处理的问题

### 1. §7 PoC 页面路径与最终 README 明显不一致

PRD 当前写的是 5 个页面：

- `/`
- `/records`
- `/records/record-session-02`
- `/replay/record-session-02`
- `/evidence`

位置：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md:346-354`

当前提交 README 的演示路径是：

- `/yard`
- `/race/grs-001`
- `/organizer`
- `/team/submit`
- `/team/records`
- `/leaderboard`

位置：`/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/README.md:46-54`

风险：评审按 README 启动演示，再看 PRD，会发现页面路径和证明点对不上。这会削弱 PoC 可信度。

建议：重写 PRD §7，不再写“5 个页面”。改成“角色化 PoC 页面链路”，按最终 README 的真实路径解释每一步证明什么。

### 2. 验证命令和通过输出不一致

PRD 当前写：

```bash
npm --prefix <PoC路径> run verify
```

输出：

```text
VERIFY_PASS ARY PoC participant submission experiment holds
```

位置：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md:367-373`

README 当前写：

```bash
cd poc
npm run verify
```

输出：

```text
VERIFY_PASS GRS001 Public Yard / Private Race Source scenario holds
```

位置：`/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/README.md:56-67`

风险：自动验收输出是评审最容易核对的证据之一，不一致会显得文档没有跟随最终实现收敛。

建议：以 README 的命令和输出为准。PRD 中不要保留旧输出字符串。

### 3. “四段实验 / /evidence”已经不是最终演示主线

PRD 当前把 `/evidence` 四段状态变化作为关键证明流程：未提交、数据缺失、评测完成、再次缺失。

位置：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md:356-365`

README 当前演示主线是：

1. `/yard` 查看公开 Race。
2. `/race/grs-001` 查看 Organizer 主动披露摘要。
3. `/organizer` 查看 Race 源数据状态和评测可用性。
4. Organizer 页面关闭评测状态。
5. `team_001` 在 `/team/submit` 提交，显示“数据缺失，暂无法评分”。
6. 重新开启评测后再次提交，进入 `/team/records`。
7. `/leaderboard` 只展示公开排名、等级和公开评语。

位置：`/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/README.md:46-54`

风险：PRD 的证明链仍停留在旧页面模型；最终实现已经转为 Organizer、Team、Leaderboard 的角色链路。

建议：把“数据可用性实验”保留为一个证明点，但嵌入最终演示路径，不再写成独立 `/evidence` 页面。

### 4. “沙箱验证 + 排队转发”写得像已实现能力

PRD 多处写到沙箱和排队：

- ARY 职责：`沙箱验证 + 排队转发`，位置：`ary-grs-001-prd.md:127`
- Rider 提交：`经 ARY 沙箱验证和排队转发至 Organizer`，位置：`ary-grs-001-prd.md:147`
- UC-R9：`沙箱验证 → 排队转发`，位置：`ary-grs-001-prd.md:189`
- 提交转发链：检查死循环、病毒、硬 bug，位置：`ary-grs-001-prd.md:205-217`
- 六项安全机制：`必须在 ARY 的沙箱中用假数据运行`，位置：`ary-grs-001-prd.md:306-308`

风险：当前 README 的可运行版本证明的是 Public Yard / Private Race Source 的最小链路，不是生产级沙箱、队列和恶意代码检测。如果 PRD 把沙箱写成已实现，会被认为包装 mock 或夸大 PoC。

建议：拆成两层：

- GRS 001 PoC 已验证：提交、评测可用性、公开展示、Records 解锁、公开榜单。
- 正式系统目标能力：沙箱、排队、并发控制、代码安全筛查。

### 5. “完整覆盖创建→披露→组织→展示全流程”表述偏强

PRD 验收标准写：

`完整覆盖创建→披露→组织→展示全流程`

位置：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md:382`

README 原始评分标准要求 PoC 能演示 Race 在 Organizer 侧被创建、Organizer 向 ARY 披露公开元数据或公开投影、ARY 展示列表/详情/状态或入口。

位置：`/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/README.original.md:99-106`

风险：如果最终 PoC 没有真实“创建 Race”的交互，只展示既有 `grs-001` Race，那么“完整覆盖创建”会被追问。

建议：改成“以本地 PoC 验证四个动作的最小链路”。如果创建流程只是预置数据或 Organizer 页面状态，则要诚实说明。

## P1：需要收紧的问题

### 6. Riding Record 口径有中心化倾向

PRD 写：

- `Riding Record 存储、回放、互查、互评、留言板`，位置：`ary-grs-001-prd.md:128`
- `Riding Record 存储与回放`，位置：`ary-grs-001-prd.md:246`
- `骑行日志自动抓取`，位置：`ary-grs-001-prd.md:247`
- `Record 数据 | 本地 JSON 保存公开摘要 | 数据库、对象存储、审核后的公开内容`，位置：`ary-grs-001-prd.md:428`

知识库口径是：完整 Riding Record / 完整 session 原文不默认上传；平台保存的是摘要、选择后的 Record、授权片段或公开投影。

风险：如果 PRD 写成 ARY 统一存储完整 Riding Record，会与去中心化 Riding Record 口径冲突，也可能让评审误以为平台中心化保存所有 Agent 协作原文。

建议：统一改成：完整协作历史默认留在 Rider 本地；ARY 接收 Rider 选择后的 Record 摘要、关键事件、公开投影和授权片段。

### 7. 数据分类中“协作原文仅 Organizer 机器”不准确

PRD §6.1 把 `协作原文` 放进受限数据，并写所在位置是 `仅 Organizer 机器`。

位置：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md:271`

问题：协作原文更可能在 Rider 本地、队伍本地或 Organizer 本地，不应一概写成 Organizer 机器。这个表述会混淆 Race 源数据和 Riding Record 源素材。

建议：拆分：

- Organizer 受限数据：完整 Race 私有定义、真实数据集、内部评测依据、未公开项目材料。
- Rider 本地素材：完整 session 原文、完整协作历史。
- ARY 可持有：授权摘要、关键事件、公开投影、提交物和受控队伍资料。

### 8. Agent Riding Skill 的证明链还不够具体

PRD 反复强调 Agent Riding Skill，但目前主要是定义和用例，没有给出可审阅样例。

相关位置：

- 核心命题：`ary-grs-001-prd.md:41-43`
- UC-R3：`ary-grs-001-prd.md:194-203`
- 验收项：`ary-grs-001-prd.md:387`

README 原始评分标准对 Agent Riding Skill 的要求很具体，包括 Riding Plan、任务拆解、识别错误、干预、修正、验收、复盘。

位置：`/media/lemonhdl/Shared/Software_Engineering/ary-grs-001-sinbawang/README.original.md:135-148`

风险：评审会认可“要评估 Riding Skill”的方向，但可能追问“从哪里看出人真的在骑行 Agent”。

建议：PRD 中加入一个很短的 Riding Record 样例摘要，展示：目标、关键 prompt、Agent 错误、Rider steering、验证动作、最终交付。不要放完整原文。

### 9. “数据安全保障承诺”语气过强

PRD 定义 ARY 是“一份数据安全保障承诺下的 Agent 赛事平台”。

位置：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md:51`

问题：这是强承诺。当前 PoC 能证明可观察的数据边界行为，但不能证明完整安全性、抗攻击能力、法律合规或生产级安全。

建议：改成更稳的产品定义，例如“围绕数据主权边界设计的 Agent 赛事平台”或“在 Organizer 保留 Race 源数据前提下组织赛事的 Agent Riding 平台”。

### 10. “代码已经平权”表达偏绝对

PRD 写：

`传统比赛平台考核的是代码。代码写得好 = 排名高。但在 AI 时代，这个假设已经失效。`

位置：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md:27-33`

问题：代码能力不是完全失效，而是不再足以单独衡量能力。过强表述容易被反驳。

建议：改成趋势判断：AI 降低了代码生成门槛，因此最终代码之外，目标设定、任务拆解、过程判断和验收能力变得更重要。

### 11. Rider / Participant 命名需要与作业标准对齐

README 原始评分标准使用 `Participant`，PRD 使用 `Rider`。

位置：

- README 原始标准：`README.original.md:35`
- PRD Rider 定义：`ary-grs-001-prd.md:138-149`

问题不大，但首次出现时最好说明：本文中的 Rider 对应评审标准中的 Participant，只是 ARY 产品语境下称为 Rider。

建议：在角色章节或术语说明中补一句，避免评审按标准关键词查找时产生误解。

## P2：表达与提交观感问题

### 12. “满分答案”容易把 ARY 拉回 OJ 语境

PRD §7.3 写：

`提交"满分答案"`

位置：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md:361`

风险：知识库反复强调 ARY 不能退化成 OJ。`满分答案` 会让人联想到刷题平台和标准答案。

建议：改成“示例方案”或“Rider 提交方案”。

### 13. “自我证明，自举建造”像口号

PRD 写：

`自我证明，自举建造。`

位置：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md:75-77`

问题：可以保留 self-dogfood，但要避免用口号替代证据。

建议：补一句具体证据：本次提交同时包含 PRD、PoC、验证输出和 Riding Record，说明团队用 Agent Riding 的方式完成 ARY 的第一版定义与验证。

### 14. 风险应对中“1秒消失”等承诺不稳

PRD 风险应对写：

`修改→实时更新、撤回→1秒消失、清空→无残留`

位置：`/media/lemonhdl/Shared/Software_Engineering/ARY/ary-grs-001-prd.md:399`

问题：这类时间承诺需要真实实现和稳定验证支撑。当前 README 没有把这些作为最终演示项。

建议：删除固定秒数，改成“通过状态切换、验证脚本和手动走查证明平台不复用 Organizer 受限数据”。

## 已经做得较好的部分

1. 核心命题清楚。
   - PRD：`ary-grs-001-prd.md:35-43`
   - README 原始核心句：`README.original.md:263-272`

2. 数据主权方向正确。
   - PRD 已说明 Organizer 持有真实数据，ARY 不持有完整受限数据。
   - 数据流图和权限矩阵能帮助评审理解边界。

3. 用户价值表有效。
   - Organizer、Rider、Audience 三方痛点和价值已经比旧稿清楚。
   - 位置：`ary-grs-001-prd.md:67-73`

4. 展示边界意识清楚。
   - PRD 已写不在页面暴露内部路径、文件名、JSON、服务请求等。
   - 位置：`ary-grs-001-prd.md:322-324`

5. PoC 边界已有诚实表达，只是需要更新到最终实现。
   - PRD §10.2 已说明当前 PoC 是简化实现。
   - 位置：`ary-grs-001-prd.md:419-430`

## 蜂群反思后的共同结论

四个审阅视角的共识是：

1. PRD 不是方向错，而是“最终实现事实”还没同步。
2. 最大扣分风险在 §7 PoC 和 §10 Mock 边界，而不是 §1–§3 的产品定义。
3. 数据主权主张需要把 `Race 源数据`、`Rider 本地完整历史`、`ARY 授权投影` 分开写。
4. 沙箱、排队、自动抓取、防造假可以作为正式系统目标，但不能包装成 GRS 001 PoC 已实现。
5. Agent Riding Skill 要有可见证据，而不只是概念定义。

## 建议下一轮修改顺序

1. 先重写 §7 关键技术 PoC。
   - 以 README 当前最终演示路径为唯一事实来源。
   - 删除旧 `/evidence` 和旧验证输出。
   - 用 `/yard → /race/grs-001 → /organizer → /team/submit → /team/records → /leaderboard` 解释证明链。

2. 同步更新 §2.6、§6.4、§8、§9、§10。
   - 删除“5 个页面”“四段实验”“满分答案”“1秒消失”等旧设想。
   - 区分已实现 PoC 与正式系统目标能力。

3. 收紧 Riding Record 数据口径。
   - 完整 session 原文默认留在 Rider 本地。
   - ARY 只保存摘要、关键事件、授权片段、公开投影。

4. 补一个 Agent Riding Skill 样例。
   - 用 5–8 行摘要展示一个真实 steering 过程。
   - 不放完整日志，不泄露内部路径。

5. 最后做提交前全篇术语扫描。
   - `Rider / Participant`
   - `Race 源数据 / 公开披露数据 / 公开投影 / 受控数据`
   - `PoC 已实现 / 正式系统目标`
   - `Record 摘要 / 完整 session 原文`

## 需要和用户讨论的决策项

1. §7 是否完全按当前 `ary-grs-001-sinbawang/README.md` 重写。
2. 沙箱、排队、代码安全检查是否保留在 PRD 主体，还是移到“后续演进”。
3. Riding Record 是否明确采用“本地完整历史 + ARY 授权投影”的口径。
4. PRD 是否加入一段 Riding Skill 样例摘要。
5. `数据安全保障承诺` 是否改成更稳的产品定义表达。

## 结论

当前 PRD 已经具备提交版的骨架，但还不能直接定稿。下一轮最重要的工作是把 PRD 从旧 PoC 设想切换到当前 README 所描述的最终可运行版本，同时降低过强安全承诺，补强 Riding Record 和 Agent Riding Skill 的证据链。
