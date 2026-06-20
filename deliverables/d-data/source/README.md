# ARY 数据层（source/）—— 快速上手

D 组数据工程的「离线工具层」。一次确定性生成,产出三份权威产物;PostgreSQL 仅用于离线灌库与校验,
**不是第一轮单机 Web 应用的启动前置**(对齐 `todos/19` §3.4、`todos/04` §12.1)。

## 一分钟跑通(无需数据库)

```bash
cd deliverables/d-data/source
python generate.py          # 生成 seed.sql + relational-mock.json + authority-mock.json
python manage.py verify     # 校验 12 条核心不变量(读 relational-mock.json)
```

产物:

| 文件 | 用途 |
|---|---|
| `exports/authority-mock.json` | 前端兼容、单机 Web 运行时主入口(11 个共享 View) |
| `exports/relational-mock.json` | core + read_model 的关系数据 JSON 镜像 |
| `seed/seed.sql` | 可直接灌 PostgreSQL 的 INSERT |
| `../authority-mock.json` | 同一份 authority-mock,发布到交付根(单一来源,杜绝漂移) |

> `generate.py` 纯标准库即可运行;文案全部来自 content.py 确定性内容池。Faker 仅为预留可选依赖,当前不消费,缺失不影响产物。

## 完整数据库生命周期(需 conda SE + PostgreSQL)

```bash
conda env create -f environment.yml   # 或 conda activate SE
cp .env.example .env

python manage.py init      # 在 source/pgdata 初始化本地实例(127.0.0.1:5433)
python manage.py start     # 启动
python manage.py generate  # 生成产物
python manage.py load      # 建表(schema/*.sql)并灌入 seed.sql
python manage.py verify    # 不变量校验
python manage.py backup    # pg_dump 到 backups/
python manage.py psql      # 交互式 psql
python manage.py stop      # 停止
python manage.py destroy --yes  # 仅删除受控路径(pgdata/seed/exports/backups)
```

完整命令、schema、不变量与设计取舍见 [DATA-GUIDE.md](DATA-GUIDE.md)。

## 目录

```text
source/
├─ README.md          本文件
├─ DATA-GUIDE.md      完整介绍与交付说明
├─ config.py          读取 .env 的连接与受控路径配置
├─ content.py         确定性内容池 + 八场赛事定义(单一素材来源)
├─ generate.py        确定性生成器(单一事实来源,产出三份产物)
├─ manage.py          数据库与生命周期统一入口 + verify
├─ schema/            两层 schema DDL(core / read_model)+ 不变量约束
├─ seed/              生成的 seed.sql(可提交、可 diff)
├─ exports/           生成的 JSON 产物(可提交、可 diff)
├─ pgdata/            本地 PostgreSQL 数据目录(git 忽略,可一键清除)
├─ backups/           pg_dump 备份(git 忽略)
├─ .env.example       环境变量样例
├─ environment.yml    conda SE 环境
└─ requirements.txt   可选 Python 依赖
```
