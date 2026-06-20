# -*- coding: utf-8 -*-
"""
manage.py —— D 组数据库与数据生命周期统一入口。

命令(对齐 todos/04 §7):
  init     初始化项目内 PostgreSQL 数据目录(source/pgdata)并建库建角色
  start    启动本地 PostgreSQL(127.0.0.1:5433)
  stop     停止本地 PostgreSQL
  status   查看实例状态
  generate 运行确定性生成器,产出 seed.sql / relational-mock.json / authority-mock.json
  load     建表(schema/*.sql)并灌入 seed.sql
  reset    重建 schema 并重新灌数据
  verify   校验 todos/04 §8 的 12 条核心不变量(默认读 relational-mock.json,无需数据库)
  backup   pg_dump 到 backups/
  restore  从 backups/ 恢复
  psql     打开交互式 psql
  destroy  仅删除受控路径(pgdata/seed/exports/backups),绝不触碰 SE 之外内容

设计:generate / verify 不需要运行中的数据库即可执行,保证「authority-mock.json 不以数据库为前置」。
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

try:  # 让 Windows GBK 控制台也能输出中文/符号而不崩
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import config


def _run(cmd, **kw):
    print("    $", " ".join(str(c) for c in cmd))
    return subprocess.run(cmd, **kw)


def _has(binname):
    return shutil.which(binname) is not None


def _need_pg(bins):
    missing = [b for b in bins if not _has(b)]
    if missing:
        print(f"[manage] 缺少 PostgreSQL 命令: {', '.join(missing)}")
        print("[manage] 请先 `conda activate SE` 并安装 postgresql(见 environment.yml)。")
        print("[manage] 提示:第一轮单机 Web 运行只需 authority-mock.json,不强制本地数据库。")
        return False
    return True


# --------------------------------------------------------------------------- #
def cmd_init(_args):
    if not _need_pg(["initdb", "pg_ctl", "psql", "createdb", "createuser"]):
        return 1
    if config.PGDATA_DIR.exists():
        print(f"[manage] {config.PGDATA_DIR} 已存在,跳过 initdb。")
    else:
        _run(["initdb", "-D", str(config.PGDATA_DIR), "-U", config.PG_USER, "--encoding=UTF8"])
    # 写入端口配置,避免污染系统默认 5432
    conf = config.PGDATA_DIR / "postgresql.conf"
    if conf.exists():
        with conf.open("a", encoding="utf-8") as f:
            f.write(f"\nport = {config.PG_PORT}\nlisten_addresses = '127.0.0.1'\n")
    cmd_start(_args)
    _run(["createdb", "-h", config.PG_HOST, "-p", str(config.PG_PORT), "-U", config.PG_USER, config.PG_DB])
    print("[manage] init 完成。下一步: python manage.py load")
    return 0


def cmd_start(_args):
    if not _need_pg(["pg_ctl"]):
        return 1
    return _run(["pg_ctl", "-D", str(config.PGDATA_DIR), "-o", f"-p {config.PG_PORT}",
                 "-l", str(config.SOURCE_DIR / "pg.log"), "start"]).returncode


def cmd_stop(_args):
    if not _need_pg(["pg_ctl"]):
        return 1
    return _run(["pg_ctl", "-D", str(config.PGDATA_DIR), "stop"]).returncode


def cmd_status(_args):
    if not _need_pg(["pg_ctl"]):
        return 1
    return _run(["pg_ctl", "-D", str(config.PGDATA_DIR), "status"]).returncode


def cmd_generate(_args):
    import generate
    generate.main()
    return 0


def cmd_load(_args):
    if not _need_pg(["psql"]):
        return 1
    seed = config.SEED_DIR / "seed.sql"
    if not seed.exists():
        print("[manage] seed.sql 不存在,先运行 generate。")
        cmd_generate(_args)
    base = config.psql_base_args()
    for sql in sorted(config.SCHEMA_DIR.glob("*.sql")):
        rc = _run(base + ["-v", "ON_ERROR_STOP=1", "-f", str(sql)]).returncode
        if rc != 0:
            return rc
    return _run(base + ["-v", "ON_ERROR_STOP=1", "-f", str(seed)]).returncode


def cmd_reset(_args):
    print("[manage] reset = 重建 schema + 重新灌数据")
    cmd_generate(_args)
    return cmd_load(_args)


def cmd_backup(_args):
    if not _need_pg(["pg_dump"]):
        return 1
    config.BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    out = config.BACKUPS_DIR / "ary_data.dump.sql"
    rc = _run(["pg_dump", "-h", config.PG_HOST, "-p", str(config.PG_PORT), "-U", config.PG_USER,
               "-d", config.PG_DB, "-f", str(out)]).returncode
    if rc == 0:
        print(f"[manage] 备份完成: {out}")
    return rc


def cmd_restore(_args):
    if not _need_pg(["psql"]):
        return 1
    src = config.BACKUPS_DIR / "ary_data.dump.sql"
    if not src.exists():
        print(f"[manage] 找不到备份: {src}")
        return 1
    return _run(config.psql_base_args() + ["-f", str(src)]).returncode


def cmd_psql(_args):
    if not _need_pg(["psql"]):
        return 1
    return _run(config.psql_base_args()).returncode


def cmd_destroy(_args):
    print("[manage] destroy 仅删除受控路径(白名单):")
    for p in config.DESTROYABLE_PATHS:
        print(f"    - {p}")
    if "--yes" not in sys.argv:
        print("[manage] 出于安全,需显式确认: python manage.py destroy --yes")
        return 1
    for p in config.DESTROYABLE_PATHS:
        # 安全检查:必须位于 source/ 之下
        if config.SOURCE_DIR not in p.parents and p != config.SOURCE_DIR:
            print(f"[manage] 跳过越界路径: {p}")
            continue
        if p.exists():
            shutil.rmtree(p)
            print(f"[manage] 已删除 {p}")
    print("[manage] destroy 完成。未触碰 SE 之外任何内容。")
    return 0


# --------------------------------------------------------------------------- #
# verify —— 12 条核心不变量(默认对 relational-mock.json 校验,无需数据库)
# --------------------------------------------------------------------------- #
def _load_relational():
    path = config.EXPORTS_DIR / "relational-mock.json"
    if not path.exists():
        print("[manage] relational-mock.json 不存在,先运行 generate。")
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def verify_invariants(rel):
    core = rel["core"]
    results = []

    def check(name, ok, detail=""):
        results.append((name, bool(ok), detail))

    reg = core["registrations"]
    rps = core["race_projects"]
    works = core["works"]
    awards = core["awards"]
    scores = core["scores"]
    jas = {j["id"]: j for j in core["judge_assignments"]}
    sigs = core["riding_signals"]
    sessions = core["sessions"]
    ca = {c["id"]: c for c in core["ca_connections"]}
    reports = core["rider_reports"]
    work_by_id = {w["id"]: w for w in works}
    reg_by_id = {r["id"]: r for r in reg}

    # 1 一人一赛至多一报名
    pairs = [(r["race_id"], r["user_id"]) for r in reg]
    check("1 一个 User 对同一 Race 至多一个 Registration", len(pairs) == len(set(pairs)),
          f"{len(pairs)} 报名 / {len(set(pairs))} 唯一对")

    # 2 approved 报名均已幂等生成 RaceProject
    approved = {r["id"] for r in reg if r["status"] == "approved"}
    rp_regs = [rp["registration_id"] for rp in rps]
    ok2 = approved == set(rp_regs) and len(rp_regs) == len(set(rp_regs))
    check("2 approved 报名幂等生成 RaceProject", ok2,
          f"approved={len(approved)} rp={len(rp_regs)} 唯一={len(set(rp_regs))}")

    # 3 每个 Registration 至多一个主 Work
    primary_regs = [w["registration_id"] for w in works if w["is_primary"]]
    check("3 每个 Registration 至多一个主 Work", len(primary_regs) == len(set(primary_regs)),
          f"主作品 {len(primary_regs)} / 唯一 {len(set(primary_regs))}")

    # 4 rider_report 与 subject_registration_id 同赛事
    ok4 = all(rep["subject_registration_id"] in reg_by_id
              and reg_by_id[rep["subject_registration_id"]]["race_id"] == rep["race_id"]
              for rep in reports)
    check("4 rider_report 与 subject_registration_id 约束", ok4, f"{len(reports)} 报告")

    # 5 Award rank 唯一(同赛事同奖项)
    triples = [(a["race_id"], a["name"], a["rank"]) for a in awards]
    check("5 同赛事同奖项 Award rank 唯一", len(triples) == len(set(triples)),
          f"{len(triples)} 奖项 / {len(set(triples))} 唯一")

    # 6 public 作品不得为 draft 或 hidden
    ok6 = all(w["status"] in ("submitted", "published") for w in works if w["visibility"] == "public")
    check("6 public 作品不得为 draft/hidden", ok6,
          f"public 作品 {sum(1 for w in works if w['visibility']=='public')}")

    # 7 riding_signals 幂等键不重复
    keys = [s["idempotency_key"] for s in sigs]
    check("7 riding_signals 幂等键不重复", len(keys) == len(set(keys)),
          f"{len(keys)} 信号 / {len(set(keys))} 唯一键")

    # 8 评分必源于 JudgeAssignment 且 work 一致
    ok8 = all(s["judge_assignment_id"] in jas and jas[s["judge_assignment_id"]]["work_id"] == s["work_id"]
              for s in scores)
    check("8 评分记录必源于 JudgeAssignment", ok8, f"{len(scores)} 评分")

    # 9 Award 不串场
    ok9 = all(a["work_id"] in work_by_id and work_by_id[a["work_id"]]["race_id"] == a["race_id"]
              for a in awards)
    check("9 Award 不串场(work 同赛事)", ok9, f"{len(awards)} 奖项")

    # 10 有握手才有会话(及快照/事件入证据链)
    ok10 = all(s["ca_connection_id"] in ca and ca[s["ca_connection_id"]]["status"] in ("handshaken", "active")
               for s in sessions)
    check("10 有握手才有会话快照和事件", ok10, f"{len(sessions)} 会话")

    # 11 获奖作品不得为 hidden
    ok11 = all(a["work_id"] in work_by_id and work_by_id[a["work_id"]]["visibility"] != "hidden"
               for a in awards)
    check("11 获奖作品不得为 hidden", ok11, f"{len(awards)} 奖项")

    # 12 已发布 rider_report 必有 published_at
    ok12 = all(rep.get("published_at") for rep in reports if rep["status"] == "published")
    check("12 已发布 rider_report 必有 published_at", ok12,
          f"published 报告 {sum(1 for r in reports if r['status']=='published')}")

    return results


def cmd_verify(_args):
    rel = _load_relational()
    if rel is None:
        return 1
    results = verify_invariants(rel)
    print("[verify] 12 条核心不变量校验(relational-mock.json):\n")
    all_ok = True
    for name, ok, detail in results:
        flag = "PASS" if ok else "FAIL"
        all_ok = all_ok and ok
        print(f"  [{flag}] {name}  ({detail})")
    print("\n[verify] 结论:", "全部通过 (all passed)" if all_ok else "存在失败 (some failed)")
    return 0 if all_ok else 2


COMMANDS = {
    "init": cmd_init, "start": cmd_start, "stop": cmd_stop, "status": cmd_status,
    "generate": cmd_generate, "load": cmd_load, "reset": cmd_reset, "verify": cmd_verify,
    "backup": cmd_backup, "restore": cmd_restore, "psql": cmd_psql, "destroy": cmd_destroy,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        print("可用命令:", ", ".join(COMMANDS))
        return 1
    return COMMANDS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    sys.exit(main() or 0)
