# -*- coding: utf-8 -*-
"""
generate.py —— D 组确定性数据生成器(单一事实来源)。

一次生成,三份产物(全部写入 source/ 下,再由交付流程复制到 deliverables/d-data/):
  1. seed/seed.sql                —— 可直接灌 PostgreSQL 的 INSERT
  2. exports/relational-mock.json —— core + read_model 的关系数据 JSON 镜像
  3. exports/authority-mock.json  —— 前端兼容、单机 Web 运行时主入口(11 个共享 View)

设计原则:
  * 确定性:固定随机种子、固定时间基准、固定 ID 分配;可重复、可提交、可 diff。
  * 不变量先行:所有事实链按 todos/04 §8 的 12 条不变量「构造即满足」。
  * 不依赖运行中的数据库即可产出 authority-mock.json(对齐 todos/19 §3.4、todos/04 §12.1)。
  * 内容来源:全部文案由 content.py 的确定性内容池驱动。Faker 仅作「预留可选依赖」按需加载并种子化,
    当前生成路径不使用任何 Faker 派生内容,缺失也不影响产物(可在不破坏确定性的前提下后续接入)。

运行:  python generate.py        (无需 PostgreSQL / conda 也能跑)
"""
import json
import random
import sys
from datetime import datetime, timedelta, timezone

try:  # 让 Windows GBK 控制台也能输出中文而不崩
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import config
import content

# 预留可选 Faker 钩子:加载并种子化,但当前生成不消费它(内容全部来自 content.py 确定性内容池)。
# 保留它是为了对齐 todos/04 §4「纯 Python + Faker」的技术选型并便于将来按需接入,缺失不影响任何产物。
try:
    from faker import Faker
    _faker = Faker("zh_CN")
    _faker.seed_instance(config.FAKER_SEED)  # 一旦未来启用,固定种子以维持确定性
except Exception:  # pragma: no cover - Faker 非硬依赖
    _faker = None

RNG = random.Random(config.RANDOM_SEED)
TZ = timezone(timedelta(hours=8))
BASE = datetime.fromisoformat(content.TIME_BASE)  # 2026-06-14T13:58:00+08:00


def ts(days=0, hours=0, minutes=0):
    """相对统一时间基准的确定性时间戳(ISO8601,+08:00)。"""
    return (BASE + timedelta(days=days, hours=hours, minutes=minutes)).isoformat()


# --------------------------------------------------------------------------- #
# 赛事花名册:显式声明每位骑手在每场赛事中的状态,使「特殊样本」可读、可核对。
# 仅用确定性内容,绝不引入运行期随机决定结构。
# work: (status, visibility)   ca: 当前 CAConnection 状态
# --------------------------------------------------------------------------- #
ROSTERS = {
    "bay-area-happy-trip": [  # running:实时主赛事
        dict(rider="rider-mira", reg="approved", ca="active", progress=78, cost=24.6, risk="low", sessions=5, active=True, work=("draft", "private")),
        dict(rider="rider-ana", reg="approved", ca="active", progress=72, cost=19.3, risk="low", sessions=4, active=True, work=("submitted", "review")),
        dict(rider="rider-jun", reg="approved", ca="active", progress=61, cost=38.4, risk="cost_watch", sessions=6, active=True, work=("draft", "private")),  # 成本与风险样本
        dict(rider="rider-rae", reg="approved", ca="handshaken", progress=49, cost=17.8, risk="idle", sessions=1, active=False, work=("draft", "hidden")),  # hidden 作品样本 + 空闲
    ],
    "smart-investment-analyst": [  # running:安全敏感域(金融)
        dict(rider="rider-owen", reg="approved", ca="active", progress=69, cost=31.2, risk="safety_boundary", sessions=5, active=True, work=("submitted", "review")),  # 安全敏感风险样本
        dict(rider="rider-nina", reg="approved", ca="active", progress=64, cost=22.1, risk="low", sessions=4, active=True, work=("draft", "private")),
        dict(rider="rider-leo", reg="approved", ca="handshaken", progress=51, cost=15.0, risk="low", sessions=3, active=True, work=("draft", "private")),
    ],
    "media-ops-agent": [  # judging:评审中
        dict(rider="rider-sara", reg="approved", ca="active", progress=100, cost=27.5, risk="low", sessions=6, active=False, work=("submitted", "review"), judged=True),
        dict(rider="rider-iris", reg="approved", ca="failed", progress=0, cost=4.2, risk="safety_boundary", sessions=0, active=False, work=("submitted", "review"), judged=True),  # CA failed 但仍提交作品 + 空骑行
    ],
    "merchant-copilot": [  # registration:仅报名,无 RaceProject / Session
        dict(rider="rider-tom", reg="pending", ca="not_configured", applicant_only=True),
    ],
    "health-habit-coach": [  # registration:安全敏感(健康)
        dict(rider="rider-kai", reg="pending", ca="not_configured", applicant_only=True),
    ],
    "gov-service-navigator": [  # completed:已发布赛果
        dict(rider="rider-owen", reg="approved", ca="active", progress=100, cost=33.0, risk="low", sessions=5, active=False, work=("published", "public"), judged=True, award=("最佳可信流程", 1), report="published"),
        dict(rider="rider-leo", reg="approved", ca="active", progress=96, cost=28.7, risk="low", sessions=4, active=False, work=("published", "public"), judged=True, report="published"),
    ],
    "genesis-dogfood-race": [  # archived:已归档但保留公开资产
        dict(rider="rider-sara", reg="approved", ca="active", progress=100, cost=30.0, risk="low", sessions=6, active=False, work=("published", "public"), judged=True, award=("最佳自举作品", 1), report="published"),
        dict(rider="rider-mira", reg="approved", ca="active", progress=100, cost=26.0, risk="low", sessions=5, active=False, work=("published", "public"), judged=True, report="published"),
    ],
    "medical-followup-assistant": [],  # upcoming:空骑行样本(仅 watchers,无报名/会话)
}

USERS_BY_ID = {r[0]: r for r in content.RIDER_POOL}


class Model:
    """承载 core / read_model 全部表行的容器,顺序即 FK 依赖顺序(便于生成 seed.sql)。"""

    def __init__(self):
        self.core = {name: [] for name in CORE_TABLES}
        self.read_model = {name: [] for name in READ_MODEL_TABLES}

    def add(self, layer, table, row):
        getattr(self, layer)[table].append(row)


CORE_TABLES = [
    "users", "user_roles", "races", "race_organizers", "registrations", "race_projects",
    "ca_connections", "sessions", "riding_signals", "riding_session_snapshots", "riding_metrics",
    "works", "work_evidence", "judge_assignments", "scores", "awards", "rider_reports",
    "announcements", "evidence_chain",
]
READ_MODEL_TABLES = [
    "projections", "leaderboard_read_model", "rider_profiles", "screen_displays",
    "projection_status", "published_artifacts", "ca_connection_status",
    "dashboard_overview", "audit_log",
]

PROJECTION_HEALTH = {  # 演示 ProjectionHealth 四态;registration/upcoming 无 projection
    "bay-area-happy-trip": "healthy",
    "smart-investment-analyst": "degraded",
    "media-ops-agent": "failed",
    "gov-service-navigator": "healthy",
    "genesis-dogfood-race": "stale",
}


def build_model():
    m = Model()
    seen_users = set()

    # 1) 组委会 / 评委 / 管理员 / 骑手 —— users + roles
    def put_user(rec, roles):
        uid, login, disp, real, org = rec
        if uid in seen_users:
            return
        seen_users.add(uid)
        m.add("core", "users", {
            "id": uid, "github_login": login, "display_name": disp, "real_name": real,
            "organization": org, "email": f"{login}@ary.dev", "avatar_url": f"mock://avatar/{login}",
            "created_at": ts(days=-40),
        })
        for role in roles:
            m.add("core", "user_roles", {"user_id": uid, "role": role})

    put_user(content.ORGANIZER, ["organizer", "admin"])
    put_user(content.ADMIN, ["admin"])
    for j in content.JUDGES:
        put_user(j, ["judge"])
    for r in content.RIDER_POOL:
        put_user(r, ["rider"])

    # 2) 赛事 + 组织者
    race_by_id = {}
    for race in content.RACES:
        race_by_id[race["id"]] = race
        display = {k: race[k] for k in ("stageLabel", "primaryCta", "secondaryCta", "heroUse", "awards") if k in race}
        for opt in ("live", "safetyNotes", "notes", "featured"):
            if opt in race:
                display[opt] = race[opt]
        m.add("core", "races", {
            "id": race["id"], "slug": race["slug"], "title": race["title"], "domain": race["domain"],
            "status": race["status"], "stage_label": race.get("stageLabel"),
            "summary": race.get("summary"), "challenge": race.get("challenge"),
            "schedule": race.get("schedule", {}), "metrics": race.get("metrics", {}),
            "display": display, "safety_sensitive": bool(race.get("safetySensitive")),
            "created_at": ts(days=-35), "archived_at": race.get("archivedAt"),
        })
        m.add("core", "race_organizers", {"race_id": race["id"], "user_id": content.ORGANIZER[0]})

    # 3) 报名链 —— 逐场逐骑手构造事实
    counters = {"reg": 0, "rp": 0, "ca": 0, "ses": 0, "sig": 0, "snap": 0, "work": 0,
                "ev": 0, "ja": 0, "score": 0, "award": 0, "report": 0, "ann": 0, "ech": 0}

    def nid(kind, prefix):
        counters[kind] += 1
        return f"{prefix}-{counters[kind]:03d}"

    for race in content.RACES:
        rid = race["id"]
        roster = ROSTERS.get(rid, [])
        for idx, slot in enumerate(roster):
            uid = slot["rider"]
            reg_id = nid("reg", f"reg-{rid}")
            m.add("core", "registrations", {
                "id": reg_id, "race_id": rid, "user_id": uid, "status": slot["reg"],
                "created_at": ts(days=-30, hours=idx),
            })

            if slot.get("applicant_only") or slot["reg"] != "approved":
                # invariant 2:仅 approved 才生成 RaceProject;报名期/未通过不建工作区
                # CAConnectionStatus 记 not_configured(报名样本)
                m.add("read_model", "ca_connection_status", {
                    "id": nid("ca", f"cas-{rid}"), "race_id": rid, "rider_user_id": uid,
                    "rider_name": USERS_BY_ID[uid][2], "provider": "ary-ca",
                    "health": "not_configured", "last_signal_at": None,
                    "risk_note": "报名待审核,尚未配置 CA",
                })
                continue

            # invariant 2:approved -> 幂等生成 RaceProject(一一对应)
            rp_id = nid("rp", f"rp-{rid}")
            m.add("core", "race_projects", {
                "id": rp_id, "registration_id": reg_id, "race_id": rid, "user_id": uid,
                "created_at": ts(days=-30, hours=idx, minutes=5),
            })

            # CAConnection
            ca_id = nid("ca", f"ca-{rid}")
            ca_status = slot["ca"]
            handshaken = ca_status in ("handshaken", "active")
            m.add("core", "ca_connections", {
                "id": ca_id, "race_project_id": rp_id, "provider": "ary-ca", "status": ca_status,
                "public_key_fingerprint": f"sha256:{uid}-{rid}"[:48],
                "registered_at": ts(days=-29, hours=idx) if ca_status != "not_configured" else None,
                "handshaken_at": ts(days=-29, hours=idx, minutes=20) if handshaken else None,
                "last_signal_at": ts(hours=-2, minutes=idx * 7) if ca_status == "active" else None,
                "failure_reason": "握手后连接中断,等待重连" if ca_status == "failed" else None,
                "created_at": ts(days=-29, hours=idx),
            })

            # invariant 10:仅当握手成功才产生 Session / riding 信号 / 快照
            n_sessions = slot.get("sessions", 0) if handshaken else 0
            signals_count = 0
            for s in range(n_sessions):
                ses_id = nid("ses", f"ses-{rid}")
                m.add("core", "sessions", {
                    "id": ses_id, "race_project_id": rp_id, "ca_connection_id": ca_id,
                    "started_at": ts(days=-3, hours=s), "ended_at": ts(days=-3, hours=s, minutes=45),
                    "summary": f"{USERS_BY_ID[uid][2]} 第 {s + 1} 段骑行会话",
                })
                # riding_signals(幂等键唯一)
                for k in range(2):
                    sig_id = nid("sig", f"sig-{rid}")
                    idem = f"{ca_id}:{ses_id}:{k}"
                    m.add("core", "riding_signals", {
                        "id": sig_id, "session_id": ses_id, "idempotency_key": idem,
                        "seq": k, "kind": "session_summary" if k == 0 else "metric",
                        "payload": {"progress": slot.get("progress", 0), "note": "脱敏过程信号"},
                        "signature": f"sig::{idem}", "signed_at": ts(days=-3, hours=s, minutes=k * 10),
                    })
                    signals_count += 1
                    m.add("core", "evidence_chain", {
                        "id": nid("ech", f"ech-{rid}"), "race_id": rid, "ref_type": "riding_signal",
                        "ref_id": sig_id, "session_id": ses_id, "created_at": ts(days=-3, hours=s, minutes=k * 10),
                    })
                # snapshot
                snap_id = nid("snap", f"snap-{rid}")
                m.add("core", "riding_session_snapshots", {
                    "id": snap_id, "session_id": ses_id, "snapshot_at": ts(days=-3, hours=s, minutes=44),
                    "state": "active" if slot.get("active") else "ended",
                    "metrics": {"progress": slot.get("progress", 0), "cost": slot.get("cost", 0)},
                })
                m.add("core", "evidence_chain", {
                    "id": nid("ech", f"ech-{rid}"), "race_id": rid, "ref_type": "session_snapshot",
                    "ref_id": snap_id, "session_id": ses_id, "created_at": ts(days=-3, hours=s, minutes=44),
                })

            # riding_metrics(空骑行 => sessions_count=0)
            m.add("core", "riding_metrics", {
                "race_project_id": rp_id, "progress": slot.get("progress", 0),
                "cost": slot.get("cost", 0), "risk": slot.get("risk", "low"),
                "is_active": bool(slot.get("active")), "sessions_count": n_sessions,
                "signals_count": signals_count, "updated_at": ts(hours=-1),
            })

            # CAConnectionStatusView 行
            risk_note = None
            if ca_status == "failed":
                risk_note = "CA failed:连接失败但仍提交作品,需人工复核"
            elif slot.get("risk") == "cost_watch":
                risk_note = "成本超阈值,进入 cost watch"
            elif slot.get("risk") == "safety_boundary":
                risk_note = "高敏边界:仅信息整理,禁止越界输出"
            elif slot.get("risk") == "idle":
                risk_note = "长时间无新 Session,空闲风险"
            m.add("read_model", "ca_connection_status", {
                "id": nid("ca", f"cas-{rid}"), "race_id": rid, "rider_user_id": uid,
                "rider_name": USERS_BY_ID[uid][2], "provider": "ary-ca",
                "health": ca_status, "last_signal_at": ts(hours=-2, minutes=idx * 7) if ca_status == "active" else None,
                "risk_note": risk_note,
            })

            # Work(主作品;invariant 3:每个 registration 至多一个 is_primary)
            if "work" in slot:
                w_status, w_vis = slot["work"]
                work_id = nid("work", f"work-{rid}")
                published_at = ts(days=-1) if w_status == "published" else None
                submitted_at = ts(days=-2) if w_status in ("submitted", "published") else None
                m.add("core", "works", {
                    "id": work_id, "race_id": rid, "registration_id": reg_id, "rider_user_id": uid,
                    "title": _work_title(rid, uid), "status": w_status, "visibility": w_vis,
                    "summary": _work_summary(rid, uid), "demo_url": f"mock://demo/{work_id}",
                    "repo_url": f"mock://repo/{work_id}", "is_primary": True,
                    "submitted_at": submitted_at, "published_at": published_at,
                })
                # 证据引用
                for e in range(2):
                    m.add("core", "work_evidence", {
                        "id": nid("ev", f"ev-{rid}"), "work_id": work_id,
                        "ref": f"ev-{rid}-{e + 1:03d}", "kind": "evidence",
                        "session_id": None, "created_at": ts(days=-2, minutes=e * 5),
                    })

                # PublishedArtifactStatus(作品维度)
                m.add("read_model", "published_artifacts", {
                    "id": nid("ech", f"pa-{rid}-w"), "race_id": rid, "artifact_type": "work",
                    "ref_id": work_id, "status": w_status if w_status != "draft" else "draft",
                    "published_at": published_at,
                })

                # 评审链(judging/completed/archived):invariant 8 评分必源于 JudgeAssignment
                if slot.get("judged"):
                    judge = content.JUDGES[idx % len(content.JUDGES)]
                    ja_id = nid("ja", f"ja-{rid}")
                    m.add("core", "judge_assignments", {
                        "id": ja_id, "race_id": rid, "work_id": work_id, "judge_user_id": judge[0],
                        "assigned_at": ts(days=-2, hours=2),
                    })
                    for crit, base_score in (("creativity", 88), ("execution", 90), ("evidence", 86)):
                        m.add("core", "scores", {
                            "id": nid("score", f"score-{rid}"), "judge_assignment_id": ja_id,
                            "work_id": work_id, "criterion": crit,
                            "score": round(base_score + RNG.uniform(-3, 6), 1),
                            "comment": f"{crit} 维度评语", "scored_at": ts(days=-1, hours=3),
                        })

                # 奖项(invariant 5/9/11:rank 唯一、同赛事、作品非 hidden)
                if "award" in slot:
                    aname, arank = slot["award"]
                    m.add("core", "awards", {
                        "id": nid("award", f"award-{rid}"), "race_id": rid, "work_id": work_id,
                        "name": aname, "rank": arank, "rider_name": USERS_BY_ID[uid][2],
                        "reason": content.AWARD_REASONS.get(rid, "评委一致认可的代表作品。"),
                        "awarded_at": ts(days=-1, hours=5), "work_visibility": w_vis,
                    })

            # rider_report(invariant 4/12:subject 同赛事、published 必有 published_at)
            if slot.get("report") == "published":
                m.add("core", "rider_reports", {
                    "id": nid("report", f"rpt-{rid}"), "subject_registration_id": reg_id,
                    "race_id": rid, "rider_user_id": uid, "status": "published",
                    "summary": f"{USERS_BY_ID[uid][2]} 在「{race['title']}」的骑行复盘报告。",
                    "published_at": ts(days=-1, hours=6),
                })
                m.add("read_model", "published_artifacts", {
                    "id": nid("ech", f"pa-{rid}-r"), "race_id": rid, "artifact_type": "report",
                    "ref_id": reg_id, "status": "published", "published_at": ts(days=-1, hours=6),
                })

    # 4) 公告
    for race in content.RACES:
        if race["status"] in ("running", "judging", "completed", "archived"):
            m.add("core", "announcements", {
                "id": nid("ann", f"ann-{race['id']}"), "race_id": race["id"],
                "title": f"{race['title']} 阶段公告", "body": f"{race.get('stageLabel')} —— 关注赛事进度与作品上墙。",
                "published_at": ts(days=-2),
            })

    # 5) read_model 派生
    _build_read_models(m, race_by_id)
    return m


def _work_title(rid, uid):
    table = {
        ("bay-area-happy-trip", "rider-mira"): "GBA WanderMate",
        ("bay-area-happy-trip", "rider-ana"): "LocalJoy Agent",
        ("bay-area-happy-trip", "rider-jun"): "RouteCost Planner",
        ("bay-area-happy-trip", "rider-rae"): "QuietTrip Draft",
        ("smart-investment-analyst", "rider-owen"): "RiskLens Analyst",
        ("smart-investment-analyst", "rider-nina"): "FinNote Reader",
        ("smart-investment-analyst", "rider-leo"): "TermClarity Agent",
        ("media-ops-agent", "rider-sara"): "Media Loop Pilot",
        ("media-ops-agent", "rider-iris"): "BrandVoice Keeper",
        ("gov-service-navigator", "rider-owen"): "Civic Path Navigator",
        ("gov-service-navigator", "rider-leo"): "DocChecklist Agent",
        ("genesis-dogfood-race", "rider-sara"): "ARY Forge Console",
        ("genesis-dogfood-race", "rider-mira"): "Genesis Recap Studio",
    }
    return table.get((rid, uid), f"{USERS_BY_ID[uid][2]} 的参赛作品")


def _work_summary(rid, uid):
    table = {
        ("bay-area-happy-trip", "rider-mira"): "三条湾区路线已经上墙:早茶、海岸、夜景,预算和交通都标清。",
        ("bay-area-happy-trip", "rider-ana"): "周末短途游作品,节奏轻快,适合第一次来湾区的朋友。",
        ("bay-area-happy-trip", "rider-rae"): "保持私有草稿:作者主动隐藏,不进入公开端。",
        ("media-ops-agent", "rider-iris"): "CA 连接失败但仍手工提交作品,等待人工复核与重连。",
        ("gov-service-navigator", "rider-owen"): "政务材料清单与流程解释 Agent,突出可信来源和官方入口回链。",
        ("genesis-dogfood-race", "rider-sara"): "第一场创世赛的指挥席作品,把赛道节奏、作品上墙和赛后播报放在同一块大屏里。",
    }
    return table.get((rid, uid), "参赛作品摘要。")


def _build_read_models(m, race_by_id):
    # leaderboard + projections(仅过程展示;脱敏事件流)
    by_race_rider = {}
    for rmrow in m.core["riding_metrics"]:
        by_race_rider[rmrow["race_project_id"]] = rmrow
    rp_meta = {rp["id"]: rp for rp in m.core["race_projects"]}

    # 用每场赛事内骑手的进度构造过程榜
    race_riders = {}
    for rp in m.core["race_projects"]:
        race_riders.setdefault(rp["race_id"], []).append(rp)

    for rid, rps in race_riders.items():
        scored = []
        for rp in rps:
            rm = by_race_rider.get(rp["id"])
            if not rm:
                continue
            uid = rp["user_id"]
            scored.append((rm["progress"], uid, rm))
        scored.sort(key=lambda x: -x[0])
        for rank, (prog, uid, rm) in enumerate(scored[:5], start=1):
            m.add("read_model", "leaderboard_read_model", {
                "race_id": rid, "rank": rank, "rider_user_id": uid,
                "name": USERS_BY_ID[uid][2], "score": round(prog + RNG.uniform(8, 16), 1),
                "label": content.SKILL_TAGS.get(race_by_id[rid]["domain"], ["reasoning"])[rank % 4],
            })

    # projections / projection_status(ProjectionHealth 四态)
    for rid, health in PROJECTION_HEALTH.items():
        race = race_by_id[rid]
        metrics = race.get("metrics", {})
        live = race.get("live", {})
        lb = [r for r in m.read_model["leaderboard_read_model"] if r["race_id"] == rid][:3]
        m.add("read_model", "projections", {
            "race_id": rid, "health": health, "updated_at": ts(minutes=-5),
            "headline_metrics": {
                "ridingSignal": live.get("ridingSignal", 0),
                "activeRiders": metrics.get("activeRiders", 0),
                "sessions": metrics.get("sessions", 0),
                "submittedWorks": metrics.get("submittedWorks", 0),
                "totalCost": live.get("totalCost", "$0.00"),
                "riskSignals": live.get("riskSignals", 0),
            },
            "event_stream": _event_stream(rid, race),
        })
        m.add("read_model", "projection_status", {
            "race_id": rid, "health": health, "last_update": ts(minutes=-5),
            "note": {"healthy": "实时投影正常", "degraded": "部分指标延迟,过程展示降级",
                     "failed": "投影失败,不影响事实数据与评审", "stale": "赛事已结束,投影为归档快照"}[health],
        })

    # screen_displays(Live / Results / Review 三模式)
    for rid, health in PROJECTION_HEALTH.items():
        m.add("read_model", "screen_displays", {
            "race_id": rid, "mode": "live" if race_by_id[rid]["status"] == "running" else "results",
            "payload": {"title": race_by_id[rid]["title"], "stage": race_by_id[rid].get("stageLabel")},
        })

    # PublishedArtifactStatus:results / reviews(基于已发布赛事)
    for race in content.RACES:
        rid = race["id"]
        results_published = race["status"] in ("completed", "archived")
        m.add("read_model", "published_artifacts", {
            "id": f"pa-{rid}-result", "race_id": rid, "artifact_type": "result",
            "ref_id": f"result-{rid}", "status": "published" if results_published else ("review" if race["status"] == "judging" else "draft"),
            "published_at": ts(days=-1, hours=5) if results_published else None,
        })
        m.add("read_model", "published_artifacts", {
            "id": f"pa-{rid}-review", "race_id": rid, "artifact_type": "review",
            "ref_id": f"review-{rid}", "status": "published" if results_published else ("review" if race["status"] == "judging" else "draft"),
            "published_at": ts(days=-1, hours=6) if results_published else None,
        })

    # rider_profiles(只公开 is_public=true 的档案;不含原始 RidingRecord / CA Session)
    public_profiles = {
        "rider-sara": dict(headline="Agent Rider / Product systems builder", races=["genesis-dogfood-race", "media-ops-agent"], works=["work-genesis-dogfood-race-001"], stats={"projects": 12, "sessions": 41, "completion": "95%", "ranking": "Top 8%"}),
        "rider-mira": dict(headline="Agent Rider / Local-life builder", races=["bay-area-happy-trip", "genesis-dogfood-race"], works=["work-genesis-dogfood-race-002"], stats={"projects": 8, "sessions": 26, "completion": "92%", "ranking": "Top 15%"}),
        "rider-owen": dict(headline="Agent Rider / Trust & risk explainer", races=["gov-service-navigator"], works=["work-gov-service-navigator-001"], stats={"projects": 6, "sessions": 18, "completion": "90%", "ranking": "Top 20%"}),
    }
    # 公开档案的 featured works 仅取 public 作品
    public_work_ids = {(w["rider_user_id"], w["race_id"]): w["id"] for w in m.core["works"] if w["visibility"] == "public"}
    for uid, p in public_profiles.items():
        feats = [public_work_ids[(uid, r)] for r in p["races"] if (uid, r) in public_work_ids]
        m.add("read_model", "rider_profiles", {
            "rider_user_id": uid, "display_name": USERS_BY_ID[uid][2], "headline": p["headline"],
            "featured_race_ids": p["races"], "featured_work_ids": feats,
            "skill_tags": content.SKILL_TAGS.get(race_by_id[p["races"][0]]["domain"], [])[:4],
            "stats": p["stats"], "is_public": True,
        })

    # audit_log(治理样例:角色、可见性、发布、风险、CA、维护)
    audits = [
        ("audit-001", ts(days=-30), content.ADMIN[2], "grant_role", "rider-mira:rider", "info", "授予 rider 角色"),
        ("audit-002", ts(days=-2), content.ORGANIZER[2], "publish_result", "gov-service-navigator", "notice", "发布政务赛赛果"),
        ("audit-003", ts(days=-1), content.ORGANIZER[2], "publish_review", "genesis-dogfood-race", "notice", "发布创世赛复盘并归档"),
        ("audit-004", ts(hours=-6), content.ADMIN[2], "set_visibility", "work-bay-area-happy-trip-004:hidden", "warning", "作者将作品设为 hidden,不进入公开端"),
        ("audit-005", ts(hours=-3), "system", "ca_failed", "rider-iris@media-ops-agent", "danger", "CA 连接失败,作品仍提交,触发人工复核"),
        ("audit-006", ts(hours=-2), "system", "risk_flag", "rider-jun@bay-area-happy-trip", "warning", "成本进入 cost watch"),
        ("audit-007", ts(hours=-2), "system", "risk_flag", "rider-owen@smart-investment-analyst", "warning", "安全敏感域边界提示"),
        ("audit-008", ts(hours=-1), content.ADMIN[2], "maintenance", "projection:media-ops-agent", "notice", "投影失败,事实数据未受影响"),
    ]
    for a in audits:
        m.add("read_model", "audit_log", {
            "id": a[0], "at": a[1], "actor": a[2], "action": a[3], "target": a[4],
            "severity": a[5], "detail": a[6],
        })

    # dashboard_overview(单例)
    m.add("read_model", "dashboard_overview", {
        "id": "singleton", "generated_at": content.GENERATED_AT,
        "payload": _dashboard_payload(m),
    })


def _event_stream(rid, race):
    if rid == "bay-area-happy-trip":
        return [
            {"time": "10:42", "type": "session_summary", "text": "Mira 完成偏好建模和路线生成 checkpoint。"},
            {"time": "11:16", "type": "risk", "text": "Jun 进入 cost watch,但仍保持 active。"},
            {"time": "11:28", "type": "work", "text": "LocalJoy Agent 提交第一版 Demo。"},
            {"time": "11:47", "type": "idle", "text": "Rae 42 分钟无新 Session Summary。"},
        ]
    if rid == "smart-investment-analyst":
        return [
            {"time": "10:31", "type": "safety", "text": "系统提示:不得输出直接买卖建议。"},
            {"time": "11:08", "type": "session_summary", "text": "Owen 完成财报摘要和风险点解释。"},
        ]
    return [{"time": "—", "type": "info", "text": f"{race['title']} 投影为归档/降级快照。"}]


def _dashboard_payload(m):
    works = m.core["works"]
    return {
        "totalUsers": len(m.core["users"]),
        "totalRaces": len(m.core["races"]),
        "activeRaces": sum(1 for r in m.core["races"] if r["status"] in ("running", "judging")),
        "runningRaces": sum(1 for r in m.core["races"] if r["status"] == "running"),
        "registrationOpenRaces": sum(1 for r in m.core["races"] if r["status"] == "registration"),
        "totalRiders": sum(1 for u in m.core["user_roles"] if u["role"] == "rider"),
        "totalWorks": len(works),
        "publishedWorks": sum(1 for w in works if w["visibility"] == "public"),
        "hiddenWorks": sum(1 for w in works if w["visibility"] == "hidden"),
        "totalAwards": len(m.core["awards"]),
        "pendingJudgements": sum(1 for r in m.core["races"] if r["status"] == "judging"),
        "riskSignals": sum(1 for c in m.read_model["ca_connection_status"] if c.get("risk_note")),
        "caFailed": sum(1 for c in m.read_model["ca_connection_status"] if c["health"] == "failed"),
        "projectionHealth": {p["race_id"]: p["health"] for p in m.read_model["projection_status"]},
        "systemHealth": "healthy",
    }


# --------------------------------------------------------------------------- #
# authority-mock.json:把 read_model + core 投影成 11 个共享 View(前端兼容)
# --------------------------------------------------------------------------- #
def build_authority_mock(m):
    races_view = []
    works_by_race = {}
    for w in m.core["works"]:
        works_by_race.setdefault(w["race_id"], []).append(w)

    for race in content.RACES:
        rv = {k: race[k] for k in race}  # 透传全部前端展示字段(零改动消费)
        rv["publicWorkCount"] = sum(1 for w in works_by_race.get(race["id"], []) if w["visibility"] == "public")
        races_view.append(rv)

    # LiveProjectionView(含过程榜 + 脱敏事件流)
    lb_by_race = {}
    for r in m.read_model["leaderboard_read_model"]:
        lb_by_race.setdefault(r["race_id"], []).append(
            {"rank": r["rank"], "riderId": r["rider_user_id"], "name": r["name"], "score": r["score"], "label": r["label"]}
        )
    live_projections = []
    for p in m.read_model["projections"]:
        if race_status(m, p["race_id"]) not in ("running",):
            continue  # Live Hall 主路径只展示进行中赛事的实时投影
        live_projections.append({
            "raceId": p["race_id"], "updatedAt": p["updated_at"], "status": p["health"],
            "headlineMetrics": p["headline_metrics"],
            "processLeaderboard": sorted(lb_by_race.get(p["race_id"], []), key=lambda x: x["rank"]),
            "eventStream": p["event_stream"],
        })

    # PublishedWorkView(全量作品 + 可见性字段;公开端必须按 visibility==public 过滤)
    works_view = []
    for w in m.core["works"]:
        works_view.append({
            "id": w["id"], "raceId": w["race_id"], "riderId": w["rider_user_id"],
            "title": w["title"], "status": w["status"], "visibility": w["visibility"],
            "published": w["status"] == "published", "publishedAt": w["published_at"],
            "summary": w["summary"], "demo": w["demo_url"], "repo": w["repo_url"],
            "isPublic": w["visibility"] == "public",
        })

    # 奖项(= PublishedResultView 的颗粒来源)
    awards_view = [{
        "id": a["id"], "raceId": a["race_id"], "name": a["name"], "rank": a["rank"],
        "workId": a["work_id"], "riderName": a["rider_name"], "reason": a["reason"],
    } for a in m.core["awards"]]

    # PublishedResultView:按赛事聚合的已发布赛果(只含已发布/已归档赛事)
    results_view = []
    for race in content.RACES:
        if race["status"] not in ("completed", "archived"):
            continue
        race_awards = [a for a in awards_view if a["raceId"] == race["id"]]
        results_view.append({
            "raceId": race["id"], "title": race["title"], "status": race["status"],
            "published": True, "publicationStatus": "published",
            "awards": sorted(race_awards, key=lambda x: x["rank"]),
            "leaderboard": sorted(lb_by_race.get(race["id"], []), key=lambda x: x["rank"]),
        })

    # PublishedReviewView(只含已发布)
    reviews_view = []
    for race in content.RACES:
        if race["status"] not in ("completed", "archived"):
            continue
        rid = race["id"]
        reviews_view.append({
            "raceId": rid, "status": "published", "published": True,
            "summary": content.REVIEW_SUMMARY.get(rid, f"{race['title']} 已发布复盘摘要。"),
            "featuredCases": [w["title"] for w in works_by_race.get(rid, []) if w["visibility"] == "public"][:3],
            "judgeComments": content.JUDGE_COMMENTS.get(rid, ["评委一致认可的代表赛事。"]),
        })

    # PublicRiderProfileView(只公开档案;无原始骑行/CA Session)
    profiles_view = [{
        "riderId": p["rider_user_id"], "displayName": p["display_name"], "headline": p["headline"],
        "featuredRaceIds": p["featured_race_ids"], "featuredWorkIds": p["featured_work_ids"],
        "skillTags": p["skill_tags"], "stats": p["stats"], "isPublic": p["is_public"],
    } for p in m.read_model["rider_profiles"] if p["is_public"]]

    # CAConnectionStatusView
    ca_view = [{
        "raceId": c["race_id"], "riderId": c["rider_user_id"], "riderName": c["rider_name"],
        "provider": c["provider"], "health": c["health"], "lastSignalAt": c["last_signal_at"],
        "riskNote": c["risk_note"],
    } for c in m.read_model["ca_connection_status"]]

    # ProjectionStatus
    proj_status_view = [{
        "raceId": p["race_id"], "health": p["health"], "lastUpdate": p["last_update"], "note": p["note"],
    } for p in m.read_model["projection_status"]]

    # PublishedArtifactStatus
    artifacts_view = [{
        "id": a["id"], "raceId": a["race_id"], "type": a["artifact_type"], "refId": a["ref_id"],
        "status": a["status"], "published": a["status"] == "published", "publishedAt": a["published_at"],
    } for a in m.read_model["published_artifacts"]]

    # AuditLogEntry
    audit_view = [{
        "id": a["id"], "at": a["at"], "actor": a["actor"], "action": a["action"],
        "target": a["target"], "severity": a["severity"], "detail": a["detail"],
    } for a in m.read_model["audit_log"]]

    dashboard = m.read_model["dashboard_overview"][0]["payload"]

    return {
        "metadata": {
            "source": "ary-d-data-generator",
            "dataVersion": content.DATA_VERSION,
            "contractVersion": content.CONTRACT_VERSION,
            "generatedAt": content.GENERATED_AT,
            "deterministic": True,
            "seed": config.RANDOM_SEED,
            "note": "唯一权威 mock;第一轮单机 Web 运行时主入口。公开端必须按 11-Publication-Visibility-Rules 过滤。",
        },
        "races": races_view,
        "liveProjections": live_projections,
        "works": works_view,
        "results": results_view,
        "awards": awards_view,
        "reviews": reviews_view,
        "profiles": profiles_view,
        "dashboard": dashboard,
        "caStatuses": ca_view,
        "projectionStatuses": proj_status_view,
        "publishedArtifacts": artifacts_view,
        "auditLogs": audit_view,
    }


def race_status(m, rid):
    for r in m.core["races"]:
        if r["id"] == rid:
            return r["status"]
    return None


# --------------------------------------------------------------------------- #
# relational-mock.json + seed.sql
# --------------------------------------------------------------------------- #
def build_relational(m):
    return {
        "metadata": {"source": "ary-d-data-generator", "generatedAt": content.GENERATED_AT,
                     "dataVersion": content.DATA_VERSION, "deterministic": True, "seed": config.RANDOM_SEED},
        "core": m.core,
        "read_model": m.read_model,
    }


def _sql_value(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (dict, list)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def build_seed_sql(m):
    lines = [
        "-- seed.sql —— 由 generate.py 确定性生成,请勿手改。",
        "-- 加载顺序遵循 FK 依赖。先建表(schema/*.sql),再执行本文件。",
        "BEGIN;",
        "SET search_path TO core, read_model, public;",
        "",
    ]
    for layer, tables in (("core", CORE_TABLES), ("read_model", READ_MODEL_TABLES)):
        store = getattr(m, layer)
        for table in tables:
            rows = store[table]
            if not rows:
                continue
            cols = list(rows[0].keys())
            lines.append(f"-- {layer}.{table} ({len(rows)} 行)")
            for row in rows:
                vals = ", ".join(_sql_value(row.get(c)) for c in cols)
                col_list = ", ".join(cols)
                lines.append(f"INSERT INTO {layer}.{table} ({col_list}) VALUES ({vals});")
            lines.append("")
    lines.append("COMMIT;")
    return "\n".join(lines)


def main():
    config.SEED_DIR.mkdir(parents=True, exist_ok=True)
    config.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

    m = build_model()
    authority = build_authority_mock(m)
    relational = build_relational(m)
    seed_sql = build_seed_sql(m)

    authority_json = json.dumps(authority, ensure_ascii=False, indent=2) + "\n"
    (config.EXPORTS_DIR / "authority-mock.json").write_text(authority_json, encoding="utf-8")
    (config.EXPORTS_DIR / "relational-mock.json").write_text(
        json.dumps(relational, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (config.SEED_DIR / "seed.sql").write_text(seed_sql + "\n", encoding="utf-8")

    # 同步发布到交付根:deliverables/d-data/authority-mock.json 是第一轮运行时主入口(单一来源,杜绝漂移)
    (config.DELIVERABLE_DIR / "authority-mock.json").write_text(authority_json, encoding="utf-8")

    counts = {f"core.{t}": len(m.core[t]) for t in CORE_TABLES}
    counts.update({f"read_model.{t}": len(m.read_model[t]) for t in READ_MODEL_TABLES})
    print("[generate] 写出 exports/authority-mock.json, exports/relational-mock.json, seed/seed.sql")
    print("[generate] 同步发布 deliverables/d-data/authority-mock.json")
    print("[generate] 行数统计:")
    for k, v in counts.items():
        print(f"    {k:38s} {v}")
    print(f"[generate] authority-mock 顶层键: {list(authority.keys())}")


if __name__ == "__main__":
    main()
