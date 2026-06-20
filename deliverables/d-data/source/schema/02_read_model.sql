-- 02_read_model.sql —— read_model 派生读取模型
-- 这些表可由 core 整体重算;它们是 authority-mock.json 各 View 的直接来源,但不是事实源。

CREATE TABLE read_model.projections (
    race_id          text PRIMARY KEY REFERENCES core.races(id) ON DELETE CASCADE,
    health           text NOT NULL CHECK (health IN ('healthy','degraded','failed','stale')),
    updated_at       timestamptz NOT NULL,
    headline_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
    event_stream     jsonb NOT NULL DEFAULT '[]'::jsonb   -- 脱敏事件流,可进 Live Hall
);
COMMENT ON TABLE read_model.projections IS 'LiveProjectionView 来源;只服务过程展示,非最终事实源';

CREATE TABLE read_model.leaderboard_read_model (
    race_id       text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    rank          integer NOT NULL,
    rider_user_id text,
    name          text NOT NULL,
    score         numeric(5,2) NOT NULL,
    label         text,
    PRIMARY KEY (race_id, rank)
);

CREATE TABLE read_model.rider_profiles (
    rider_user_id     text PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
    display_name      text NOT NULL,
    headline          text,
    featured_race_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    featured_work_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    skill_tags        jsonb NOT NULL DEFAULT '[]'::jsonb,
    stats             jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_public         boolean NOT NULL DEFAULT false   -- 只有公开档案才进公开端
);
COMMENT ON COLUMN read_model.rider_profiles.is_public IS 'PublicRiderProfileView 公开判定字段';

CREATE TABLE read_model.screen_displays (
    race_id  text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    mode     text NOT NULL,            -- live / results / review
    payload  jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (race_id, mode)
);

CREATE TABLE read_model.projection_status (
    race_id     text PRIMARY KEY REFERENCES core.races(id) ON DELETE CASCADE,
    health      text NOT NULL CHECK (health IN ('healthy','degraded','failed','stale')),
    last_update timestamptz NOT NULL,
    note        text
);
COMMENT ON TABLE read_model.projection_status IS 'ProjectionStatus[] 来源(管理端可见)';

CREATE TABLE read_model.published_artifacts (
    id           text PRIMARY KEY,
    race_id      text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    artifact_type text NOT NULL CHECK (artifact_type IN ('result','review','report','work')),
    ref_id       text NOT NULL,
    status       text NOT NULL CHECK (status IN ('draft','review','published')),
    published_at timestamptz
);
COMMENT ON TABLE read_model.published_artifacts IS 'PublishedArtifactStatus[] 来源;status=published 才进公开端';

CREATE TABLE read_model.ca_connection_status (
    id             text PRIMARY KEY,
    race_id        text NOT NULL REFERENCES core.races(id) ON DELETE CASCADE,
    rider_user_id  text REFERENCES core.users(id) ON DELETE CASCADE,
    rider_name     text,
    provider       text,
    health         text NOT NULL CHECK (health IN ('not_configured','registered','handshaken','active','failed','disabled')),
    last_signal_at timestamptz,
    risk_note      text
);
COMMENT ON TABLE read_model.ca_connection_status IS 'CAConnectionStatusView[] 来源';

CREATE TABLE read_model.dashboard_overview (
    id          text PRIMARY KEY DEFAULT 'singleton',
    payload     jsonb NOT NULL,
    generated_at timestamptz NOT NULL
);
COMMENT ON TABLE read_model.dashboard_overview IS 'DashboardOverview 单例';

CREATE TABLE read_model.audit_log (
    id        text PRIMARY KEY,
    at        timestamptz NOT NULL,
    actor     text NOT NULL,
    action    text NOT NULL,
    target    text,
    severity  text NOT NULL CHECK (severity IN ('info','notice','warning','danger')),
    detail    text
);
COMMENT ON TABLE read_model.audit_log IS 'AuditLogEntry[] 来源';
