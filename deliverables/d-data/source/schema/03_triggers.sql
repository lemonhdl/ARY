-- 03_triggers.sql —— 用触发器强制「无法仅靠 UNIQUE/FK/CHECK 落库」的跨表不变量。
-- 这里只覆盖 todos/04 §8 中需要跨行/跨表判断的项;其余已在 01_core.sql 用约束强制。

-- invariant 10:有握手才有会话(Session 必须挂在已握手/活跃的 CAConnection 上)
CREATE OR REPLACE FUNCTION core.assert_session_requires_handshake()
RETURNS trigger AS $$
DECLARE
    ca_status text;
BEGIN
    SELECT status INTO ca_status FROM core.ca_connections WHERE id = NEW.ca_connection_id;
    IF ca_status NOT IN ('handshaken','active') THEN
        RAISE EXCEPTION 'invariant 10 violated: session % requires handshaken CA, got %', NEW.id, ca_status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_session_requires_handshake
    BEFORE INSERT OR UPDATE ON core.sessions
    FOR EACH ROW EXECUTE FUNCTION core.assert_session_requires_handshake();

-- invariant 8(强化):score 关联的 work 必须与其 JudgeAssignment 的 work 一致
CREATE OR REPLACE FUNCTION core.assert_score_matches_assignment()
RETURNS trigger AS $$
DECLARE
    ja_work text;
BEGIN
    SELECT work_id INTO ja_work FROM core.judge_assignments WHERE id = NEW.judge_assignment_id;
    IF ja_work IS DISTINCT FROM NEW.work_id THEN
        RAISE EXCEPTION 'invariant 8 violated: score % work_id % != assignment work_id %', NEW.id, NEW.work_id, ja_work;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_score_matches_assignment
    BEFORE INSERT OR UPDATE ON core.scores
    FOR EACH ROW EXECUTE FUNCTION core.assert_score_matches_assignment();

-- invariant 10(证据链):进入证据链的事件若声明了 session,该 session 必须存在(FK 已保证),
-- 且其 CA 已握手(由 sessions 触发器传递保证)。此处再校验 ref_type 合法。
CREATE OR REPLACE FUNCTION core.assert_evidence_ref()
RETURNS trigger AS $$
BEGIN
    IF NEW.ref_type NOT IN ('session_snapshot','riding_signal','work_submit','score','award') THEN
        RAISE EXCEPTION 'invalid evidence ref_type: %', NEW.ref_type;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evidence_ref
    BEFORE INSERT ON core.evidence_chain
    FOR EACH ROW EXECUTE FUNCTION core.assert_evidence_ref();
