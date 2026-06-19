-- 01_core.sql —— core 事实源表
-- 不变量编号对应 todos/04 §8 的 verify 清单。能用 UNIQUE / FK / CHECK 落库强制的,在此强制;
-- 跨表语义(如 award 不串场、获奖作品不得 hidden、score 必源于 JudgeAssignment)见 03_triggers.sql。

-- ── 身份与账号 ────────────────────────────────────────────────────────────
CREATE TABLE core.users (
    id            text PRIMARY KEY,
    github_login  text NOT NULL UNIQUE,          -- GitHub 登录数据进入 core.users
    display_name  text NOT NULL,
    real_name     text,
    organization  text,
    email         text,
    avatar_url    text,
    created_at    timestamptz NOT NULL
);
COMMENT ON TABLE core.users IS 'GitHub 登录用户;MVP 以 github_login 为登录身份';

CREATE TABLE core.user_roles (
    user_id  text NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    role     text NOT NULL CHECK (role IN ('rider','organizer','judge','admin','audience')),
    PRIMARY KEY (user_id, role)
);
COMMENT ON TABLE core.user_roles IS 'User.roles 多角色维护';

-- ── 赛事 ──────────────────────────────────────────────────────────────────
CREATE TABLE core.races (
    id            text PRIMARY KEY,
    slug          text NOT NULL UNIQUE,
    title         text NOT NULL,
    domain        text NOT NULL,
    status        text NOT NULL CHECK (status IN ('registration','running','judging','completed','archived','upcoming')),
    stage_label   text,
    summary       text,
    challenge     text,
    schedule      jsonb NOT NULL DEFAULT '{}'::jsonb,
    metrics       jsonb NOT NULL DEFAULT '{}'::jsonb,
    display       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- cta / heroUse / live / awards 名单等前端展示字段
    safety_sensitive boolean NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL,
    archived_at   timestamptz,
    -- 供 awards 复合外键引用,保证 award 不串场(invariant 9)
    UNIQUE (id, status)
);

CREATE TABLE core.race_organizers (
    race_id  text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    user_id  text NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    PRIMARY KEY (race_id, user_id)
);

-- ── 报名 / 工作区 / CA 接入 / 会话 ────────────────────────────────────────
CREATE TABLE core.registrations (
    id          text PRIMARY KEY,
    race_id     text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    user_id     text NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    status      text NOT NULL CHECK (status IN ('pending','approved','rejected','withdrawn')),
    created_at  timestamptz NOT NULL,
    -- invariant 1:一个 User 对同一 Race 至多一个 Registration
    UNIQUE (race_id, user_id),
    -- 供 race_projects / works 复合外键引用同赛事
    UNIQUE (id, race_id)
);
COMMENT ON CONSTRAINT registrations_race_id_user_id_key ON core.registrations
    IS 'invariant 1: 一人一赛至多一报名';

CREATE TABLE core.race_projects (
    id               text PRIMARY KEY,
    -- invariant 2:approved 报名幂等生成 RaceProject(registration_id 唯一 => 幂等)
    registration_id  text NOT NULL UNIQUE REFERENCES core.registrations(id) ON DELETE CASCADE,
    race_id          text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    user_id          text NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    created_at       timestamptz NOT NULL,
    UNIQUE (id, race_id)
);
COMMENT ON CONSTRAINT race_projects_registration_id_key ON core.race_projects
    IS 'invariant 2: 每个 approved 报名至多/恰好一个 RaceProject(幂等)';

CREATE TABLE core.ca_connections (
    id                 text PRIMARY KEY,
    race_project_id    text NOT NULL REFERENCES core.race_projects(id) ON DELETE CASCADE,
    provider           text NOT NULL,
    status             text NOT NULL CHECK (status IN ('not_configured','registered','handshaken','active','failed','disabled')),
    public_key_fingerprint text,                 -- 实现扩展字段(见 todos/04 §10.4)
    registered_at      timestamptz,
    handshaken_at      timestamptz,
    last_signal_at     timestamptz,
    failure_reason     text,
    created_at         timestamptz NOT NULL
);
COMMENT ON COLUMN core.ca_connections.public_key_fingerprint IS '实现扩展字段,非前端必需';

CREATE TABLE core.sessions (
    id               text PRIMARY KEY,
    race_project_id  text NOT NULL REFERENCES core.race_projects(id) ON DELETE CASCADE,
    ca_connection_id text NOT NULL REFERENCES core.ca_connections(id) ON DELETE CASCADE,
    started_at       timestamptz NOT NULL,
    ended_at         timestamptz,
    summary          text
);
COMMENT ON TABLE core.sessions IS 'invariant 10: 仅当 CA 已握手才允许产生 Session(由 03_triggers 强制)';

-- ── 骑行记录 ──────────────────────────────────────────────────────────────
CREATE TABLE core.riding_signals (
    id              text PRIMARY KEY,
    session_id      text NOT NULL REFERENCES core.sessions(id) ON DELETE CASCADE,
    -- invariant 7:riding_signals 幂等键不重复
    idempotency_key text NOT NULL UNIQUE,
    seq             integer NOT NULL,
    kind            text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    signature       text,                        -- 防伪签名(来自 A 组消息签名)
    signed_at       timestamptz NOT NULL
);
COMMENT ON CONSTRAINT riding_signals_idempotency_key_key ON core.riding_signals
    IS 'invariant 7: riding_signals 幂等键全局唯一,防重放';

CREATE TABLE core.riding_session_snapshots (
    id           text PRIMARY KEY,
    session_id   text NOT NULL REFERENCES core.sessions(id) ON DELETE CASCADE,
    snapshot_at  timestamptz NOT NULL,
    state        text NOT NULL,
    metrics      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE core.riding_metrics (
    race_project_id text PRIMARY KEY REFERENCES core.race_projects(id) ON DELETE CASCADE,
    progress        integer NOT NULL DEFAULT 0,
    cost            numeric(10,2) NOT NULL DEFAULT 0,
    risk            text NOT NULL DEFAULT 'low',
    is_active       boolean NOT NULL DEFAULT false,
    sessions_count  integer NOT NULL DEFAULT 0,
    signals_count   integer NOT NULL DEFAULT 0,
    updated_at      timestamptz NOT NULL
);
COMMENT ON TABLE core.riding_metrics IS '骑手聚合指标;sessions_count=0 即空骑行样本';

-- ── 作品 / 评审 / 奖项 / 报告 / 公告 ──────────────────────────────────────
CREATE TABLE core.works (
    id              text PRIMARY KEY,
    race_id         text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    registration_id text NOT NULL REFERENCES core.registrations(id) ON DELETE CASCADE,
    rider_user_id   text NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    title           text NOT NULL,
    status          text NOT NULL CHECK (status IN ('draft','submitted','published')),
    visibility      text NOT NULL CHECK (visibility IN ('private','review','public','hidden')),
    summary         text,
    demo_url        text,
    repo_url        text,
    is_primary      boolean NOT NULL DEFAULT true,
    submitted_at    timestamptz,
    published_at    timestamptz,
    -- invariant 6:public 作品不得为 draft(public 与 hidden 互斥已由枚举保证)
    CHECK (visibility <> 'public' OR status IN ('submitted','published')),
    -- 供 awards 复合外键:保证奖项与作品同赛事(invariant 9)
    UNIQUE (id, race_id),
    -- 供「获奖作品不得 hidden」复合外键(invariant 11)
    UNIQUE (id, visibility)
);
COMMENT ON CONSTRAINT works_visibility_check ON core.works
    IS 'invariant 6: public 作品不得为 draft/hidden';

-- invariant 3:每个 Registration 至多一个主 Work
CREATE UNIQUE INDEX works_one_primary_per_registration
    ON core.works (registration_id) WHERE is_primary;

CREATE TABLE core.work_evidence (
    id          text PRIMARY KEY,
    work_id     text NOT NULL REFERENCES core.works(id) ON DELETE CASCADE,
    ref         text NOT NULL,
    kind        text NOT NULL DEFAULT 'evidence',
    session_id  text REFERENCES core.sessions(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL
);

CREATE TABLE core.judge_assignments (
    id            text PRIMARY KEY,
    race_id       text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    work_id       text NOT NULL REFERENCES core.works(id) ON DELETE CASCADE,
    judge_user_id text NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    assigned_at   timestamptz NOT NULL,
    UNIQUE (race_id, work_id, judge_user_id),
    UNIQUE (id, race_id)
);

CREATE TABLE core.scores (
    id                  text PRIMARY KEY,
    -- invariant 8:评分记录必源于 JudgeAssignment
    judge_assignment_id text NOT NULL REFERENCES core.judge_assignments(id) ON DELETE CASCADE,
    work_id             text NOT NULL REFERENCES core.works(id) ON DELETE CASCADE,
    criterion           text NOT NULL,
    score               numeric(5,2) NOT NULL,
    comment             text,
    scored_at           timestamptz NOT NULL
);
COMMENT ON COLUMN core.scores.judge_assignment_id IS 'invariant 8: 评分必须挂在 JudgeAssignment 上';

CREATE TABLE core.awards (
    id          text PRIMARY KEY,
    race_id     text NOT NULL,
    work_id     text NOT NULL,
    name        text NOT NULL,
    rank        integer NOT NULL,
    rider_name  text,
    reason      text,
    awarded_at  timestamptz NOT NULL,
    work_visibility text NOT NULL,
    -- invariant 5:同赛事同奖项 rank 唯一
    UNIQUE (race_id, name, rank),
    -- invariant 9:award 不串场 —— work 必须属于同一 race
    FOREIGN KEY (work_id, race_id) REFERENCES core.works(id, race_id),
    -- invariant 11:获奖作品不得为 hidden(复合外键 + CHECK 锁定 visibility)
    FOREIGN KEY (work_id, work_visibility) REFERENCES core.works(id, visibility),
    CHECK (work_visibility <> 'hidden')
);
COMMENT ON CONSTRAINT awards_race_id_name_rank_key ON core.awards IS 'invariant 5: 同赛事同奖项 rank 唯一';

CREATE TABLE core.rider_reports (
    id                      text PRIMARY KEY,
    -- invariant 4:rider_report 与 subject_registration_id 约束
    subject_registration_id text NOT NULL REFERENCES core.registrations(id) ON DELETE CASCADE,
    race_id                 text NOT NULL,
    rider_user_id           text NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    status                  text NOT NULL CHECK (status IN ('draft','published')),
    summary                 text,
    published_at            timestamptz,
    -- invariant 4:report 的 subject 必须属于同一 race(复合外键)
    FOREIGN KEY (subject_registration_id, race_id) REFERENCES core.registrations(id, race_id),
    -- invariant 12:已发布 rider_report 必有 published_at
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);
COMMENT ON CONSTRAINT rider_reports_status_check ON core.rider_reports IS 'invariant 12: 已发布 report 必有 published_at';

CREATE TABLE core.announcements (
    id           text PRIMARY KEY,
    race_id      text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    title        text NOT NULL,
    body         text,
    published_at timestamptz NOT NULL
);

-- invariant 10 证据链:握手会话产生的快照/事件入证据链
CREATE TABLE core.evidence_chain (
    id          text PRIMARY KEY,
    race_id     text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    ref_type    text NOT NULL,            -- session_snapshot / riding_signal / work_submit ...
    ref_id      text NOT NULL,
    session_id  text REFERENCES core.sessions(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL
);
COMMENT ON TABLE core.evidence_chain IS 'invariant 10: 只有握手会话事件能进入证据链';
