-- liquibase formatted sql

-- changeset railway:001-locomotive
CREATE TABLE IF NOT EXISTS locomotive (
    locomotive_id     UUID PRIMARY KEY,
    model             TEXT NOT NULL,
    serial_number     TEXT,
    operator_name     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- changeset railway:002-route
CREATE TABLE IF NOT EXISTS route (
    route_id       UUID PRIMARY KEY,
    name           TEXT NOT NULL,
    waypoints      JSONB,
    route_geom     JSONB,
    speed_profile  JSONB
);

-- changeset railway:003-train-run
CREATE TABLE IF NOT EXISTS train_run (
    train_run_id    UUID PRIMARY KEY,
    train_id        TEXT,
    locomotive_id   UUID REFERENCES locomotive(locomotive_id),
    route_id        UUID REFERENCES route(route_id),
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    status          TEXT
);

-- changeset railway:004-telemetry-raw
CREATE TABLE IF NOT EXISTS telemetry_raw (
    ts                          TIMESTAMPTZ        NOT NULL,
    locomotive_id               UUID               NOT NULL REFERENCES locomotive(locomotive_id),
    seq                         BIGINT             NOT NULL,

    train_run_id                UUID               REFERENCES train_run(train_run_id),
    route_id                    UUID               REFERENCES route(route_id),

    lat                         DOUBLE PRECISION,
    lon                         DOUBLE PRECISION,
    alt_m                       DOUBLE PRECISION,
    speed_kph                   REAL,
    heading_deg                 REAL,

    voltage_v                   REAL,
    current_a                   REAL,
    motor_temp_c                REAL,
    brake_pressure_kpa          REAL,

    fuel_level_pct              REAL,
    energy_level_pct            REAL,

    doors_state                 SMALLINT,
    alarm_status                SMALLINT,
    comm_state                  SMALLINT,

    fault_codes                 TEXT[],
    driver_state                JSONB,

    PRIMARY KEY (ts, locomotive_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_raw_loco_ts ON telemetry_raw (locomotive_id, ts DESC);

-- changeset railway:005-locomotive-state-current
CREATE TABLE IF NOT EXISTS locomotive_state_current (
    locomotive_id               UUID PRIMARY KEY REFERENCES locomotive(locomotive_id),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_ts                     TIMESTAMPTZ,
    lat                         DOUBLE PRECISION,
    lon                         DOUBLE PRECISION,
    alt_m                       DOUBLE PRECISION,
    speed_kph                   REAL,
    heading_deg                 REAL,
    brake_pressure_kpa          REAL,
    motor_temp_c                REAL,
    fuel_level_pct              REAL,
    health_index                SMALLINT,
    comm_state                  SMALLINT,
    alarm_status                SMALLINT,
    active_faults               TEXT[]
);

-- changeset railway:006-alert-rule
CREATE TABLE IF NOT EXISTS alert_rule (
    alert_rule_id   UUID PRIMARY KEY,
    metric_code     TEXT NOT NULL,
    condition_expr  TEXT NOT NULL,
    context_severity TEXT,
    title           TEXT NOT NULL,
    description     TEXT,
    action_hint     TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE
);
-- changeset railway:007-event-log
CREATE TABLE IF NOT EXISTS event_log (
    event_id        UUID PRIMARY KEY,
    ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locomotive_id   UUID REFERENCES locomotive(locomotive_id),
    train_run_id    UUID REFERENCES train_run(train_run_id),
    event_type      TEXT NOT NULL,
    severity        TEXT NOT NULL,
    code            TEXT,
    message         TEXT,
    payload         JSONB
);

CREATE INDEX IF NOT EXISTS idx_event_log_loco_ts ON event_log (locomotive_id, ts DESC);

-- changeset railway:008-proximity-event
CREATE TABLE IF NOT EXISTS proximity_event (
    proximity_event_id  UUID PRIMARY KEY,
    ts                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locomotive_id       UUID REFERENCES locomotive(locomotive_id),
    other_locomotive_id UUID,
    distance_m          REAL,
    rel_bearing_deg     REAL,
    severity            TEXT
);
