-- liquibase formatted sql

-- changeset railway:010-rename-telemetry-raw-columns
ALTER TABLE telemetry_raw RENAME COLUMN voltage_v TO battery_voltage_v;
ALTER TABLE telemetry_raw RENAME COLUMN motor_temp_c TO engine_temp_c;
ALTER TABLE telemetry_raw RENAME COLUMN brake_pressure_kpa TO brake_pipe_pressure_kpa;

-- changeset railway:011-drop-obsolete-telemetry-raw-columns
ALTER TABLE telemetry_raw DROP COLUMN IF EXISTS energy_level_pct;
ALTER TABLE telemetry_raw DROP COLUMN IF EXISTS doors_state;

-- changeset railway:012-convert-telemetry-raw-enums-to-text
ALTER TABLE telemetry_raw ALTER COLUMN alarm_status TYPE TEXT USING
    CASE alarm_status
        WHEN 0 THEN 'normal'
        WHEN 1 THEN 'warning'
        WHEN 2 THEN 'critical'
        ELSE alarm_status::TEXT
    END;

ALTER TABLE telemetry_raw ALTER COLUMN comm_state TYPE TEXT USING
    CASE comm_state
        WHEN 0 THEN 'offline'
        WHEN 1 THEN 'online'
        WHEN 2 THEN 'intermittent'
        ELSE comm_state::TEXT
    END;

-- changeset railway:013-convert-route-id-to-text
ALTER TABLE telemetry_raw ALTER COLUMN route_id TYPE TEXT USING route_id::TEXT;

-- changeset railway:014-add-new-telemetry-raw-columns
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS train_id TEXT;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS line_id TEXT;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS line_name TEXT;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS geofence_id UUID;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS active_geofences TEXT[];
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS main_reservoir_pressure_kpa REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS brake_cylinder_pressure_kpa REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS brake_pipe_leak_kpa_per_min REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS brake_status TEXT;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS traction_voltage_v REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS engine_rpm REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS oil_temp_c REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS fuel_consumption_rate_lph REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS tractive_effort_kn REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS dynamic_brake_force_kn REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS alerter_timer_sec REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS pcs_open BOOLEAN;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS eab_status TEXT;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS health_index SMALLINT;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS weather_factor REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS track_grade_pct REAL;
ALTER TABLE telemetry_raw ADD COLUMN IF NOT EXISTS current_mode TEXT;

-- changeset railway:015-update-locomotive-table
ALTER TABLE locomotive ADD COLUMN IF NOT EXISTS manufactured_year INTEGER;
ALTER TABLE locomotive ADD COLUMN IF NOT EXISTS line_id TEXT;
ALTER TABLE locomotive ADD COLUMN IF NOT EXISTS line_name TEXT;

-- changeset railway:016-update-train-run-table
ALTER TABLE train_run ADD COLUMN IF NOT EXISTS line_id TEXT;
ALTER TABLE train_run ALTER COLUMN route_id TYPE TEXT USING route_id::TEXT;

-- changeset railway:017-update-locomotive-state-current
ALTER TABLE locomotive_state_current RENAME COLUMN motor_temp_c TO engine_temp_c;
ALTER TABLE locomotive_state_current RENAME COLUMN brake_pressure_kpa TO brake_pipe_pressure_kpa;

ALTER TABLE locomotive_state_current ALTER COLUMN comm_state TYPE TEXT USING
    CASE comm_state
        WHEN 0 THEN 'offline'
        WHEN 1 THEN 'online'
        WHEN 2 THEN 'intermittent'
        ELSE comm_state::TEXT
    END;

ALTER TABLE locomotive_state_current ALTER COLUMN alarm_status TYPE TEXT USING
    CASE alarm_status
        WHEN 0 THEN 'normal'
        WHEN 1 THEN 'warning'
        WHEN 2 THEN 'critical'
        ELSE alarm_status::TEXT
    END;

ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS train_id TEXT;
ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS line_id TEXT;
ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS line_name TEXT;
ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS brake_status TEXT;
ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS eab_status TEXT;
ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS active_geofences TEXT[];
ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS current_mode TEXT;
ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS engine_rpm REAL;
ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS direction TEXT;
ALTER TABLE locomotive_state_current ADD COLUMN IF NOT EXISTS segment_name TEXT;
