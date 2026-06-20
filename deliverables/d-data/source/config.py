# -*- coding: utf-8 -*-
"""
config.py —— 集中读取 .env 的连接凭证与受控路径配置。

硬约束(对齐 todos/04 §4):
1. 数据库使用 PostgreSQL,监听 127.0.0.1:5433,避免污染系统默认实例。
2. 数据目录放项目内(source/pgdata),允许一键清除。
3. 连接凭证集中在 .env;本文件只负责读取,不写系统环境变量。
4. destroy 只能删除「受控路径」白名单内的目录。
"""
import os
from pathlib import Path

SOURCE_DIR = Path(__file__).resolve().parent          # deliverables/d-data/source
DELIVERABLE_DIR = SOURCE_DIR.parent                    # deliverables/d-data
REPO_ROOT = DELIVERABLE_DIR.parent.parent              # 仓库根

SCHEMA_DIR = SOURCE_DIR / "schema"
SEED_DIR = SOURCE_DIR / "seed"
EXPORTS_DIR = SOURCE_DIR / "exports"
PGDATA_DIR = SOURCE_DIR / "pgdata"
BACKUPS_DIR = SOURCE_DIR / "backups"

# destroy 的受控路径白名单:只允许删除这些目录,绝不触碰 SE 之外的任何内容
DESTROYABLE_PATHS = [PGDATA_DIR, SEED_DIR, EXPORTS_DIR, BACKUPS_DIR]


def _load_dotenv(path: Path) -> None:
    """极简 .env 读取:KEY=VALUE,忽略空行与 # 注释。不引入第三方依赖。"""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv(SOURCE_DIR / ".env")


def env(key: str, default: str) -> str:
    return os.environ.get(key, default)


# PostgreSQL 连接配置(本地化、独立端口)
PG_HOST = env("ARY_PG_HOST", "127.0.0.1")
PG_PORT = int(env("ARY_PG_PORT", "5433"))
PG_DB = env("ARY_PG_DB", "ary_data")
PG_USER = env("ARY_PG_USER", "ary")
PG_PASSWORD = env("ARY_PG_PASSWORD", "ary_local_dev")
CONDA_ENV = env("ARY_CONDA_ENV", "SE")

# 确定性种子:固定后整套数据可重复、可 diff
RANDOM_SEED = int(env("ARY_RANDOM_SEED", "20260614"))
FAKER_SEED = int(env("ARY_FAKER_SEED", "20260614"))


def dsn() -> str:
    return f"host={PG_HOST} port={PG_PORT} dbname={PG_DB} user={PG_USER} password={PG_PASSWORD}"


def psql_base_args() -> list:
    return ["psql", "-h", PG_HOST, "-p", str(PG_PORT), "-U", PG_USER, "-d", PG_DB]
