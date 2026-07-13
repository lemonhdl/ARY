# ARY 数据层完整说明(data/ 目录做了什么)

> 本文是 ARY MVP 数据的完整说明文档:讲清楚 `data/` 目录做了哪些事、生成了哪些数据、数据库怎么设计的、怎么用、怎么和其它端对接,以及有哪些已知差异需要如实知会。
>

---

## 0. 一句话总览

`data/` 把 ARY 赛事平台 MVP 需要的**全套事实数据**,生成进了一个**完全本地化、可一键清除的 PostgreSQL 数据库**,并同时导出一份**前端原型可零改动消费的 JSON**。

- **是什么**:一套"确定性数据生成器 + PostgreSQL 数据库生命周期管理"的 Python 工程。
- **产出**:22 张表、2742 行覆盖赛事全生命周期的样例数据;3 份可提交可 diff 的产物文件;1 个可一键起停/重置/销毁的本地数据库。
- **给谁用**:平台后台、Rider 客户端、前端展示、整合联调四端,通过 `.env` 里的连接串直接连库消费。

---

## 1. 这一项要做的两件事

任务本身分两块,目录就是围绕这两块组织的:

### A. 数据生成 —— 为多场比赛生成"所有完整的数据"
- 覆盖赛事全生命周期:`registration / running / judging / completed / archived` 每个状态至少一场。
- 每场赛事生成完整关联事实链:报名 → RaceProject → CA 接入 → Session → 骑行记录 → 作品 → 评审分配 → 评分 → 奖项 → 证据 → 报告。
- 严格遵守领域不变量(一人一报名、approved 幂等生成 RaceProject、CA 接入非硬门禁、未发布不公开等,依据 [`../docs/ary-domain-analysis.v0.3.md`](../docs/ary-domain-analysis.v0.3.md))。
- 内容是**真实风格的中文** Agentic Development 赛事(赛题、骑手、作品、评语、骑行过程摘要)。
- 同时导出一份**前端兼容 JSON**(对齐 [`../design-prototype/data/sample-races.json`](../design-prototype/data/sample-races.json) 结构),让前端零改动也能用。

### B. 数据库管理 —— 把数据装进真正的数据库并管好它
- **数据库**:PostgreSQL,装在 conda 的 `SE` 虚拟环境里,数据目录放本项目内,**不污染系统、可一键清除**。
- **连接(IP / 端口 / 用户 / 密码)**:集中在 `.env` 管理(`.env.example` 是模板)。这就是任务里说的"数据库的 IP、密码"。
- **GitHub 登录数据**:`core.users` 表存 GitHub 账号身份(github id / login / 头像 / 显示名 / 角色集合)。
- **骑行记录(riding-record)**:`core.riding_signals`(实时事件流)+ `core.riding_session_snapshots`(快照,权威指标)+ `core.sessions`(会话)。
- **生命周期管理**:初始化、启停、建表、灌数据、重置、备份、恢复,全部由 [`manage.py`](manage.py) 一条命令搞定。

---

## 2. 目录结构(逐文件作用)

```
data/
├── README.md            # 快速上手手册(起库 + 灌数据 5 步)
├── DATA-GUIDE.md        # 本文:完整介绍与交付说明
├── environment.yml      # SE conda 环境定义(PostgreSQL 18 + Python 3.12 + 库)
├── requirements.txt     # pip 依赖(psycopg2-binary / Faker / python-dotenv)
├── .env.example         # 连接配置模板(已提交,复制成 .env 后填密码)
├── .env                 # 实际连接配置,含密码(.gitignore 忽略,不提交)
├── config.py            # 读取 .env,统一提供连接参数与路径
├── manage.py            # 数据库生命周期 CLI(见 §6)
├── generate.py          # 确定性数据生成器(1069 行,产出下面三份产物)
├── content.py           # 中文领域内容素材(~218 行:赛事/作品/评语/会话模板…)
├── schema/
│   ├── 01_schema.sql    # DDL:core(事实)+ read_model(投影),全部表/约束/索引
│   └── 99_drop.sql      # 清库脚本(reset / load 前用)
├── seed/
│   ├── seed.sql         # 生成的全量 INSERT(约 2.30 MiB,可直接 psql 灌库)
│   └── ary-data.json    # 关系数据的 JSON 镜像(约 2.89 MiB,整合/调试用)
├── exports/
│   └── sample-races.generated.json  # 前端兼容导出(约 68.5 KiB,对齐原型结构)
├── pgdata/              # 本地 PostgreSQL 集群数据目录(.gitignore 忽略,约 74 MB)
└── backups/             # pg_dump 备份产物(.gitignore 忽略)
```

> `pgdata/` 是一个**完整的 PostgreSQL 物理数据目录**(`base/`、`global/`、`pg_wal/`、`postgresql.conf` 等),由 `manage.py init` 用 `initdb` 在本地创建,不入 git。删除整个 `data/pgdata` 即彻底清除数据库,不留系统痕迹。

---

## 3. 技术选型与本地化设计

| 维度 | 选择 | 原因 |
|---|---|---|
| 数据库 | PostgreSQL 18(conda `conda-forge` 提供) | 强约束 / JSONB / 复合外键,能把领域不变量落成 DB 约束;DDL 兼容 PG 14+ |
| 运行环境 | conda 环境 `SE`(`environment.yml`) | 服务端 + Python 库全装环境内,**不依赖系统安装的 PG**,不污染系统 |
| 监听 | `127.0.0.1:5433` | 仅本地回环 + 非默认端口,**避免和系统 PostgreSQL(5432)冲突** |
| 数据目录 | `data/pgdata/`(项目内) | 可移植、可一键 `destroy` 清除 |
| 生成器 | 纯 Python + Faker(`generate.py`) | 确定性、可重复、产物可提交可 diff;生成时**不连库**,纯写文件 |
| 连接凭证 | `.env`(`config.py` 读取) | host/port/user/password 集中管理,`.env` 不入 git |

**安全边界(写进 `manage.py` 的硬约束)**:不安装系统服务、不写系统环境变量、不动 `SE` 之外任何东西;`destroy` 删除前校验路径必须是 `data/pgdata` 才允许删,绝不误删其它目录。

依赖清单(`requirements.txt`,装在 SE 环境内):`psycopg2-binary>=2.9`(连库)、`Faker>=25.0`(造中文姓名/登录名)、`python-dotenv>=1.0`(读 `.env`)。PostgreSQL 服务端本体由 conda 提供,不在 pip 列表。

---

## 4. 数据库设计

### 4.1 两层 schema —— 事实源 vs 可重算投影

对应领域文档"事实源 vs 可重算投影"的硬要求,DDL 把表分成两个 schema:

- **`core`(18 张)** —— **事实源表**,权威,不可被派生数据覆盖。
- **`read_model`(4 张)** —— **派生读取模型**,可整体重算、可丢弃,每张带 `last_rebuilt_at`,**不是最终事实源**。最终结果读 `core.awards` / `core.reports` / `read_model.leaderboard_read_model`。

### 4.2 全部 22 张表(分组 + 职责 + 实际行数)

> 行数为对 `seed/ary-data.json` 各数组逐一统计、并与 `seed.sql` 的 INSERT 计数交叉核对一致的结果。

**身份 / 账号**

| 表 | 行数 | 职责 |
|---|---:|---|
| `core.users` | 73 | GitHub 登录身份(github_id/login/头像/显示名/slug/资料);ARY 不存密码/token,凭证委托 GitHub |
| `core.user_roles` | 72 | 角色集合(rider/judge/organizer/admin),身份用 `User.roles` 表达,不建独立角色实体 |

**赛事**

| 表 | 行数 | 职责 |
|---|---:|---|
| `core.races` | 8 | 赛事主表(status 9 态 / domain / 五阶段 schedule / 评审标准 / 奖项设置 / 前端兼容 metrics) |
| `core.race_organizers` | 8 | 主办方 N:M 关系 |

**报名 → 工作区 → CA 接入 → 会话**

| 表 | 行数 | 职责 |
|---|---:|---|
| `core.registrations` | 63 | 报名(submitted/approved/rejected/withdrawn);`UNIQUE(race_id,user_id)` 强制一人一报名 |
| `core.race_projects` | 57 | 参赛工作区;`registration_id UNIQUE` 强制 approved 幂等生成且仅一个 |
| `core.ca_connections` | 70 | CA 接入连接(codex/claude_code);`handshake_completed` 是进入证据链的门禁 |
| `core.sessions` | 160 | CA 会话(消息数/工具调用数/tokens 等累计指标) |

**骑行记录(riding-record,三种存储形态)**

| 表 | 行数 | 职责 |
|---|---:|---|
| `core.riding_signals` | **1625** | 实时推送事件流,append-only,`idempotency_key` 去重(数据量最大的表) |
| `core.riding_session_snapshots` | 160 | Session 快照,**权威累计指标来源**,按 `fetched_at` 单调更新 |
| `core.riding_metrics` | 106 | 派生汇总(分 RaceProject 聚合层与 CAConnection 层),每方至多一条(部分唯一索引强制) |

**作品 / 评审 / 奖项 / 证据 / 报告 / 公告**

| 表 | 行数 | 职责 |
|---|---:|---|
| `core.works` | 37 | 作品(draft/submitted/locked/hidden);`registration_id UNIQUE` 强制单主作品 |
| `core.judge_assignments` | 81 | 评委分配(含分配人审计字段) |
| `core.judging_records` | 81 | 评分记录(作品维度 + 骑行维度 jsonb);必源于一个 JudgeAssignment |
| `core.awards` | 16 | 奖项;**复合外键**强制 `Award.race_id = Registration.race_id`,杜绝串场 |
| `core.evidence` | 67 | 证据(session_summary/work/commit_pr/screenshot/judge_comment/…) |
| `core.reports` | 24 | 报告(rider_report/race_report/review_summary);CHECK 强制仅 rider_report 带 subject |
| `core.announcements` | 3 | 赛事公告 |

**read_model —— 派生/可重算投影**

| 表 | 行数 | 职责 |
|---|---:|---|
| `read_model.projections` | 15 | 过程投影(race_progress/cost/risk/current_leaderboard/screen_feed/…) |
| `read_model.leaderboard_read_model` | 2 | 最终榜单(由 Award 按 rank 排列形成,弱依赖 Award) |
| `read_model.rider_profiles` | 10 | 骑手公开档案(技能标签/统计/精选赛事与作品) |
| `read_model.screen_displays` | 4 | 大屏展示(jumbotron/billboard/live/leaderboard/works/announcement) |

**合计:2742 行**(core 18 张 = 2711 行 + read_model 4 张 = 31 行)。

### 4.3 主键策略:可读字符串 ID

主键用**可读字符串 ID** 而非 uuid:`race_genesis`、`reg_0007`、`conn_codex_001`、`sess_0001`、`sig_00001` 等。理由(schema 头注已说明):既匹配 CA 契约里 `idempotencyKey` 的样例格式,也方便前端与各端联调。领域文档把 PK 推断为 uuid,这里为演示/整合清晰**有意改用可读 ID**(已声明的口径偏离)。ID 命名规则见 §5.4。

### 4.4 把不变量落成数据库约束

关键领域不变量不只靠生成器自觉,更**由 DDL 约束在数据库层强制**:

- `UNIQUE(race_id, user_id)` —— 一人一报名
- `race_projects.registration_id UNIQUE` —— approved 幂等(唯一即幂等键)
- `works.registration_id UNIQUE` —— 单主作品
- `awards` 复合外键 `(registration_id, race_id) REFERENCES registrations(registration_id, race_id)` —— Award 不串场
- `awards UNIQUE(race_id, award_name, rank)` —— 同赛事同奖项 rank 唯一
- `riding_metrics` 部分唯一索引 —— RaceProject / CAConnection 各至多一条
- `reports` CHECK —— `subject_registration_id` 仅 rider_report 非空
- 枚举统一用 `text + CHECK`(而非原生 enum),便于契约草案演进

### 4.5 CA 接入的"实现扩展字段"

`core.ca_connections` 上的 `endpoint_host / endpoint_port / auth_token_hash` 是**领域文档与 CA 契约都未建模的实现扩展字段**,为 Rider 客户端 ↔ 平台端到端联调预留(CA 端点地址与握手密钥的落点)。

- `auth_token_hash` **只存 SHA-256 摘要**(`sha('demo-secret:{conn_id}')`),样例均为假数据,**绝不存明文 / 真实 secret**。
- schema 第 125–133 行、README §3/§6 三处都如实声明了这一点。

> 注意区分"两处 IP/密码":数据库连接的 host/port/user/password 在 `.env`;CA 端点地址在 `ca_connections` 上 —— 两者含义不同。

---

## 5. 生成了哪些数据,怎么生成的

### 5.1 八场赛事:刻意铺满全生命周期

复用原型里已有的 8 场赛事身份(保证前端可识别),并补足全生命周期覆盖:

| 赛事 | slug | domain | 状态 | 骑手数 | 主要驱动页面 |
|---|---|---|---|---:|---|
| 创世骑行挑战赛 | `genesis-dogfood-race` | self-dogfood | completed | 12 | Results / Review / Works / Rider Profile |
| 政务办事导航 Agent | `gov-service-navigator` | e-government | archived | 8 | Past Races / 案例资产 |
| 自媒体运营 Agent | `media-ops-agent` | content-ops | judging | 10 | Race Page 评审态 / Judge View |
| 湾区开心游 | `bay-area-happy-trip` | travel-local-life | running ⭐featured | 10 | Live Hall / Screen / 首页 Live 切换 |
| 智能投研助理 | `smart-investment-analyst` | finance | running | 8 | Live Hall(高风险样本) |
| 网商经营 Copilot | `merchant-copilot` | e-commerce | registration | 8 | 报名态 / 报名 CTA |
| 健康习惯教练 | `health-habit-coach` | health | registration | 7 | 报名态 |
| 医疗随访助手 | `medical-followup-assistant` | medical | registration(upcoming=即将开赛) | 5 | 首页"即将开放" |

其中 5 场(政务/投研/健康/医疗等安全敏感域)标 `risk_profile=safety`,生成器会向它们倾斜风险样本。

### 5.2 确定性生成:每次跑出来逐字节一致

`generate.py` 是**确定性**生成器 —— 同一份代码 + 同一种子 → 完全相同的产物,因此 `seed.sql` 可提交、可 diff、可重复重建。靠四个固定点保证:

1. `SEED = 20260614` → `random.seed(SEED)` 固定 Python 全局随机序列;
2. `Faker.seed(SEED)` 固定 Faker(`zh_CN` 造中文姓名、`en_US` 造 GitHub login 基名);
3. 时间基准 `BASE_TIME = "2026-06-14T10:00:00+08:00"`(content.py),所有时间相对它推导,**不读系统时钟**;
4. 可读 ID 由 `Ids` 类确定性递增分配,与随机无关。

> 防时区漂移:写进 `idempotency_key` 的时间戳先 `astimezone(timezone.utc)` 再贴 `Z` 后缀,与运行机器时区无关。
> 注意:因为全局共享同一个 `random` 序列,**生成流程的调用顺序本身也是确定性契约的一部分**,改动顺序会影响后续所有随机值。

### 5.3 生成流程(generate.py 主干)

```
main()
└─ Generator.generate()
   ├─ build_staff()          # 1 admin + 2 organizer + 5 judge + 2 空角色用户(覆盖身份三态)
   └─ for race in RACES:     # content.py 里 8 场固定赛事
      └─ gen_race(idx, race)
         ├─ 写 races + race_organizers(metrics 先占位)
         ├─ gen_registrations()                         # 造骑手 + 报名(状态计划:approved/submitted/rejected/withdrawn)
         └─ 按状态分层展开下游:
            ├─ registration → gen_bare_projects()        # approved 即幂等生成裸 RaceProject(尚无 CA)
            ├─ running+      → gen_projects_and_riding()  # RaceProject + CA 连接 + 会话 + 骑行信号 + 快照 + metrics
            │                  + gen_works()
            ├─ judging+      → gen_judging()              # 每作品分配 3 评委 + 评分
            └─ completed+    → gen_awards_reports_profiles()  # 奖项 + 榜单 + 三类报告 + 获奖者档案
         └─ gen_projections() + gen_announcements() + fill_race_metrics()
```

**对象生成规则要点**(都对齐领域不变量):
- **一人一报名**:每条报名都新建独立 `usr_r` 用户,天然满足 `UNIQUE(race_id,user_id)`。
- **approved 幂等单 RaceProject**:每个 approved 用 `ids.next('rp')` 生成且仅生成一个,对应 `registration_id UNIQUE`。
- **CA 画像覆盖**:同一场内按 approved 下标分配 `empty`(空骑行/无数据)/ `failed`(接入失败,带原因码 + 一条失败信号)/ `active` 三种画像,保证每场覆盖 4 种 ingestion 状态 + 风险样本,**验证"CA 接入失败仍可参赛/评审/获奖"**。
- **骑行信号剧本**:每会话按固定剧本发事件 `riding_started → task_started → validation_run → task_blocked → task_progress → [risk_detected] → cost_updated → milestone_reached → artifact_linked → (会话结束才) riding_finished / session_completed`;counter_* 用"迄今峰值"保证随 sequence 单调非减(累计观测语义)。
- **风险样本**:空骑行者保留 `draft` 不出作品(验证 CA 失败仍在册);部分作品造 `hidden`("疑似违规"样本);safety 赛事按概率产 `risk_detected` / `safety_boundary`。
- **成本模型**:每会话 tokens 随机 30k–260k,成本按 `tokens/1000 * 0.012` 美元粗估累加;`cost > 2.5` 触发 `cost_watch` 风险。

### 5.4 可读 ID 命名规则速查

| 对象 | 前缀/格式 | 示例 |
|---|---|---|
| admin / organizer / judge / 空角色 / rider | `usr_a_` / `usr_o_` / `usr_j_` / `usr_n_` / `usr_r_`(4 位) | `usr_r_0001` |
| 报名 / 工作区 | `reg_` / `rp_`(4 位) | `reg_0007` / `rp_0012` |
| CA 连接 | `conn_{ca_type}_`(3 位,按类型分桶) | `conn_codex_001` |
| 会话(内部/外部) | `sess_`(4 位)/ `{ca_type}_session_NNN` | `sess_0001` / `codex_session_001` |
| 骑行信号 / 快照 / 指标 | `sig_` / `snap_` / `met_`(5 位) | `sig_00001` |
| 作品/证据/分配/评审/奖项/报告/公告/大屏 | `work_`/`ev_`/`asg_`/`jr_`/`awd_`/`rep_`/`ann_`/`scr_` | `work_0001` |
| 投影 | `proj_{type}_`(3 位,按类型分桶) | `proj_cost_001` |
| 赛事 | 直接复用固定 slug(`race_id = slug`) | `genesis-dogfood-race` |

### 5.5 中文内容素材(content.py)

`content.py`(~218 行 / ~12KB)是数据的**中文素材库**,用"模板 + 占位符"组合放大而非穷举。包含 18 类素材,主要有:

- **RACES**:8 场赛事完整定义(标题/domain/状态/骑手数/赛题/风险画像)。
- **WORKS_BY_DOMAIN**:按 8 个 domain 各 3 件作品,共 **24 件**(中英混搭命名:`ARY Forge` / `CivicPath` / 研报速读 / 随访通…),技术方案突出 Agent 编排 + RAG/规则/约束求解,安全域显式写边界(finance 不给投资建议、medical 严守免责)。
- **AFFILIATIONS**:14 条单位(偏粤港澳大湾区高校 + 云生态/初创开发者)。
- **SKILL_TAGS**:18 个 Riding Skill 标签(任务拆解/提示工程/成本控制/合规边界…)。
- **评审/报告/公告/事件流文案池**:5+5 条评审评语、3 个报告段落模板 + 4 语气词、6 复盘要点、4 条公告、5 类 Live Hall 事件流文案。
- **风险素材**:`RISK_REASONS`(low/medium/high 三档)、`CA_FAILURE_CODES`(4 个失败原因码,如 `connector_handshake_timeout`)。

> 骑手姓名不在 content.py 里穷举,而是运行时由 Faker(`zh_CN`)按各场 `rider_count` 动态生成(单场 5~12 人,合计约 68 名 approved 骑手)。

### 5.6 三份产物的分工

| 产物 | 大小 | 格式 | 用途 |
|---|---:|---|---|
| [`seed/seed.sql`](seed/seed.sql) | ~2.30 MiB | 带 `BEGIN/COMMIT` 的逐行 `INSERT`,UTF8 声明,jsonb 列 `'…'::jsonb` | 直接 `psql` 灌库(权威 SQL 种子) |
| [`seed/ary-data.json`](seed/ary-data.json) | ~2.89 MiB | `{ "schema.table": [行…] }` 扁平镜像,22 个键 | 关系数据镜像,整合/调试用 |
| [`exports/sample-races.generated.json`](exports/sample-races.generated.json) | ~68.5 KiB | 重塑成原型视图(11 个顶层键) | **前端原型零改动消费** |

三份都由 `generate.py` 末尾一次性写出,统一 UTF-8、`ensure_ascii=False`;内存辅助字段(`_` 前缀)不进任何产物。`emit_sql` / `emit_relational_json` / `emit_frontend` 分别负责三份。

---

## 6. 数据库怎么用

所有命令在 `SE` 环境里跑(PostgreSQL 与 Python 库都在该环境内,不依赖系统安装)。

### 6.1 首次完整流程(5 步起库 + 灌数据)

```bash
# 0) 一次性:复制连接配置模板并按需改密码
cp data/.env.example data/.env

# 1) 初始化本地数据库集群 + 角色 + 数据库(只需一次)
conda run -n SE python data/manage.py init

# 2) 启动数据库(后台进程,监听 127.0.0.1:5433)
conda run -n SE python data/manage.py start

# 3) 生成样例数据(产出 seed/seed.sql 与 JSON 导出;确定性,可重复)
conda run -n SE python data/manage.py generate

# 4) 建表(drop + create)+ 灌入数据
conda run -n SE python data/manage.py load

# 5) 验证(打印各表行数 + 19 条不变量 + 风险样本统计)
conda run -n SE python data/manage.py verify
```

> 环境本身首次需 `conda env create -f data/environment.yml`(创建 SE 环境,含 PostgreSQL 18 + Python 库)。

### 6.2 全部命令

| 命令 | 作用 |
|---|---|
| `manage.py init` | 初始化本地集群(`initdb`)+ 写监听/稳定性配置 + 创建角色与库 |
| `manage.py start` / `stop` | 启动 / 停止数据库进程 |
| `manage.py status` | 查看集群目录、运行状态、端口、连接串 |
| `manage.py generate` | 生成样例数据(`seed.sql` + 两份 JSON) |
| `manage.py load` | 重建 schema(drop + create)并灌入 `seed.sql` |
| `manage.py reset` | 清空并重建空表(不灌数据) |
| `manage.py verify` | 行数 + 19 条不变量 + 风险样本统计校验(有 FAIL 即非零退出) |
| `manage.py backup` | `pg_dump -Fc` 备份到 `backups/`(对应运维计划赛前/赛中备份) |
| `manage.py restore <file>` | 从备份恢复(`--clean --if-exists --no-owner`) |
| `manage.py psql` | 打开交互式 `psql` |
| `manage.py destroy` | 停库并删除整个 `pgdata/`(一键清除,保留 `backups/`) |

### 6.3 连接信息(给队友/其它端)

连接凭证集中在 `.env`(模板 `.env.example`):

```ini
ARY_PG_HOST=127.0.0.1
ARY_PG_PORT=5433
ARY_PG_DBNAME=ary
ARY_DB_USER=ary               # 应用角色:后台/前端/Rider 客户端/整合都用它
ARY_DB_PASSWORD=ary_dev_pwd_change_me
ARY_PG_SUPERUSER=postgres     # 超级用户:仅 manage.py 初始化时用
ARY_PG_SUPERPASSWORD=ary_super_pwd_change_me
```

**任意语言连接串**:`postgresql://ary:<password>@127.0.0.1:5433/ary`(密码见各自 `.env`)。
`config.py` 提供 `app_dsn()` / `app_conn_kwargs()` / `super_conn_kwargs()` 三个辅助,供 Python 端直接复用。

### 6.4 `verify` 校验的 19 条领域不变量

`manage.py verify` 把下列不变量写成"违例计数应为 0"的 SQL 断言,任一非零即失败退出:

1. 一个 User 对同一 Race 至多一个 Registration
2. approved 报名均已幂等生成 RaceProject
3. RaceProject 与 Registration 一一对应(无重复生成)
4. 每个 Registration 至多一个主 Work
5. rider_report 必有 `subject_registration_id`
6. 非 rider_report 必无 `subject_registration_id`
7. 同一赛事同一奖项内 rank 唯一
8. public 作品不得为 draft/hidden
9. `riding_signals` 幂等键无重复
10. 评分记录必源于一个 JudgeAssignment
11. `Award.race_id` 必与其 Registration 的 race_id 一致
12. 有握手才有会话快照
13. 未握手连接不得产生会话(证据链门禁)
14. 未握手连接不得有 event 类骑行信号入证据链
15. 连接层 RidingMetrics 的来源连接必已握手
16. Award 必授予 approved 的 Registration
17. 获奖作品不得为 hidden
18. 已发布 rider_report 必有 `published_at`
19. 未发布 rider_report 不得有 `published_at`(默认不公开)

此外 `verify` 还打印**风险样本/覆盖统计**(展示性,非断言):空骑行/未接入 CA 的项目数、CA failed 的项目数、CA failed 但仍提交作品的报名数(验证非硬门禁)、hidden 作品数、产生过骑行事件的赛事数、已发布奖项数,以及赛事状态分布。

---

## 7. 与各端对接

### 7.1 前端(展示项)零改动消费

`exports/sample-races.generated.json` 面向原型 `design-prototype/data/sample-races.json` 生成:

- ✅ **顶层 11 键完全一致且同序**:`metadata / series / raceGroups / races / riders / works / liveProjections / awards / reviews / profiles / consoleTasks`。
- ✅ **`liveProjections[].headlineMetrics` 的 6 键一字不差**:`ridingSignal / activeRiders / sessions / submittedWorks / totalCost / riskSignals`(值不同属样例差异)。
- ✅ **前端实际读取的字段都对齐** —— `script.js` 只从 `raceGroups` 读 `featuredRaceId` / `liveRaceIds`,这些都在。

> **如实标注(措辞别读成"逐键全等")**:生成文件的单场 race 对象是原型的"子集 + 局部替换"——省略了原型展示性的 `heroUse` / `notes` / `safetyNotes` 键;`raceGroups` 改用 `completedRaceIds`(收窄为 1)+ 新增 `pastRaceIds` 的二分。这些键 `script.js` 全不读取,**不影响渲染**,故"前端零改动可用"在功能层面成立;但"结构对齐"应理解为"前端实际读取字段对齐 + headlineMetrics 6 键全等",而非整对象逐键相同。

> **已知前端既有问题(不是数据层的锅)**:`design-prototype/script.js` 的 `domainText` 映射表缺 `travel-local-life` / `e-government` 两个键(只有 `travel` / `government`),导致"湾区开心游""政务办事导航"两场会显示英文 domain。这对原型自带数据同样存在。**修复应由前端在 `script.js` 补这两个映射,不要改数据**(数据 domain 值与原型权威数据刻意保持一致)。

### 7.2 CA 接入(Rider 客户端 / 整合项)

- `ca_connections` / `sessions` / `riding_signals` 三张表的字段与 [`../docs/ary-ca-integration-spec.md`](../docs/ary-ca-integration-spec.md) 契约**逐一对应**,命名只做 camelCase → snake_case 转换(如 `caType→ca_type`、`idempotencyKey→idempotency_key`、`messageCount→message_count`)。
- `endpoint_host / endpoint_port / auth_token_hash` 是为联调预留的**实现扩展字段**(契约未建模),`auth_token_hash` 只存 SHA-256 摘要、样例为假数据。
- 骑行记录幂等键时间戳统一 UTC(`…Z`),与运行机器时区无关。

### 7.3 确定性可重建

`seed.sql` 与两份 JSON 由固定种子生成,可提交、可 diff、可重复重建(`python manage.py generate`)。任何端都能从仓库一键重建出**逐字节一致**的同一份数据。

---

## 8. 设计取舍与已知差异(诚实清单)

写进文档以免误读,均为**已声明的有意取舍或前端既有问题**,不是缺陷遗留:

1. **PK 用可读字符串 ID 而非 uuid** —— 领域文档推断 uuid,这里为演示/整合清晰有意偏离(schema 头注、README §3 已声明)。
2. **前端导出是"对齐前端实际读取字段",非整对象逐键全等** —— 详见 §7.1,省略了 `heroUse` 等展示性键,不影响渲染。
3. **`verify` 的 19 条覆盖的是"可落库强制"的核心不变量** —— 报名唯一性、RaceProject 幂等、握手门禁、单主作品、Award 不串场/rank 唯一、rider_report 约束等都已硬校验;但几条偏**流程/语义**的不变量未纳入硬断言:
   - "CA 接入状态不改变 Registration 资格(非硬门禁)"在 `verify` 里是**统计展示**(`_SPOTLIGHTS`)而非 PASS/FAIL 断言;
   - "事后 Session Summary 不得伪造实时证据""Award 可追溯到 decisionReason""Projection 非最终事实源"等,靠 DDL 约束 / `read_model` 分层 / schema CHECK **间接保证**,未单列断言。
4. **`ca_connections` 的 endpoint_*/auth_token_hash 是契约未建模的实现扩展字段** —— 已在 schema、README 三处声明;只存摘要不存明文。
5. **截图与录屏可能过期** —— 原型 `*.png` / `recordings/` 是 UX-1 验收证据,反映的是原型旧样例,其具体数值(metrics、riders 数)与本数据层生成值不同,引用时注意区分。

---

## 9. 一页速查

- **数据库**:PostgreSQL 18,本地 `127.0.0.1:5433`,库/角色都叫 `ary`,数据目录 `data/pgdata`,可一键 `destroy`。
- **规模**:22 张表(core 18 + read_model 4),**2742 行**,覆盖 8 场赛事全生命周期;`riding_signals` 最大(1625 行)。
- **产物**:`seed.sql`(2.30 MiB,灌库)+ `ary-data.json`(2.89 MiB,镜像)+ `sample-races.generated.json`(68.5 KiB,前端)。
- **怎么跑**:`init → start → generate → load → verify`,全在 `conda run -n SE python data/manage.py <cmd>`。
- **怎么连**:`postgresql://ary:<password>@127.0.0.1:5433/ary`。
- **底线**:确定性可重建、不变量由 DB 强制、不污染系统、密钥只存摘要。

> 字段级权威以 [`schema/01_schema.sql`](schema/01_schema.sql)、[`../docs/ary-domain-analysis.v0.3.md`](../docs/ary-domain-analysis.v0.3.md)、[`../docs/ary-ca-integration-spec.md`](../docs/ary-ca-integration-spec.md) 为准。
