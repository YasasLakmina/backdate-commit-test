-- M3 XAI & Decision Support: PostgreSQL schema (PostgreSQL 13+; gen_random_uuid is built in).
-- Apply with:  cd backend && npm run db:init
-- Safe to re-run: every object uses IF NOT EXISTS.

-- ---------------------------------------------------------------------------
-- Decision-prompt rule catalogue and expert review
-- Rules are defined in backend/src/rules/catalogue.js and synced here on start-up.
-- A rule stays DRAFT until a real reviewer has reviewed it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_rules (
    rule_id       TEXT PRIMARY KEY,
    version       TEXT NOT NULL,
    title         TEXT NOT NULL,
    family        TEXT NOT NULL,
    severity      TEXT NOT NULL CHECK (severity IN ('info', 'review', 'caution')),
    trigger_text  TEXT NOT NULL,
    limitation    TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEWED', 'RETIRED')),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rule_reviews (
    review_id          BIGSERIAL PRIMARY KEY,
    rule_id            TEXT NOT NULL REFERENCES decision_rules (rule_id),
    rule_version       TEXT NOT NULL,
    reviewer_role      TEXT NOT NULL,          -- e.g. 'tea broker', 'export manager'; no names
    verdict            TEXT NOT NULL CHECK (verdict IN ('agree', 'partly', 'disagree')),
    suggested_wording  TEXT,
    comment            TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rule_reviews_rule_idx ON rule_reviews (rule_id);

-- ---------------------------------------------------------------------------
-- Audit log of explanation and scenario runs (anonymous session id only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analysis_runs (
    run_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_id      TEXT,
    kind            TEXT NOT NULL CHECK (kind IN ('explain', 'scenario')),
    origin_period   TEXT NOT NULL,
    target_period   TEXT NOT NULL,
    overrides       JSONB NOT NULL DEFAULT '{}'::jsonb,
    baseline_value  DOUBLE PRECISION NOT NULL,
    scenario_value  DOUBLE PRECISION,
    model_id        TEXT NOT NULL,
    support_status  TEXT,
    prompt_ids      TEXT[] NOT NULL DEFAULT '{}',
    latency_ms      DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS analysis_runs_session_idx ON analysis_runs (session_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- TAM evaluation study (static vs interactive explanation)
-- The API refuses writes unless STUDY_MODE_ENABLED=true, which must only be set
-- after supervisor and ethics approval. Anonymous participant codes only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_participants (
    participant_code  TEXT PRIMARY KEY,
    participant_type  TEXT NOT NULL CHECK (participant_type IN ('expert', 'proxy')),
    role              TEXT,
    years_experience  INTEGER CHECK (years_experience >= 0),
    condition_order   TEXT NOT NULL CHECK (condition_order IN ('static_first', 'interactive_first')),
    consent_given     BOOLEAN NOT NULL CHECK (consent_given),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS study_vignette_responses (
    response_id            BIGSERIAL PRIMARY KEY,
    participant_code       TEXT NOT NULL REFERENCES study_participants (participant_code),
    vignette_id            TEXT NOT NULL,
    condition              TEXT NOT NULL CHECK (condition IN ('static', 'interactive')),
    decision               TEXT NOT NULL CHECK (decision IN ('increase', 'hold', 'reduce')),
    reference_decision     TEXT CHECK (reference_decision IN ('increase', 'hold', 'reduce')),
    agrees_with_reference  BOOLEAN,            -- "vignette decision agreement", a proxy, not true accuracy
    confidence             SMALLINT CHECK (confidence BETWEEN 1 AND 7),
    completion_seconds     DOUBLE PRECISION CHECK (completion_seconds >= 0),
    interaction_count      INTEGER NOT NULL DEFAULT 0 CHECK (interaction_count >= 0),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (participant_code, vignette_id, condition)
);

CREATE TABLE IF NOT EXISTS study_questionnaire_responses (
    response_id       BIGSERIAL PRIMARY KEY,
    participant_code  TEXT NOT NULL REFERENCES study_participants (participant_code),
    condition         TEXT NOT NULL CHECK (condition IN ('static', 'interactive')),
    construct         TEXT NOT NULL CHECK (construct IN ('perceived_usefulness', 'perceived_ease_of_use',
                                                         'trust', 'explanation_satisfaction')),
    item_code         TEXT NOT NULL,           -- e.g. PU1, PEOU2, TR3 (instrument defined in the approved protocol)
    score             SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 7),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (participant_code, condition, item_code)
);
