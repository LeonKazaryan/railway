-- liquibase formatted sql

-- changeset railway:009-drop-foreign-keys

ALTER TABLE telemetry_raw DROP CONSTRAINT IF EXISTS telemetry_raw_locomotive_id_fkey;
ALTER TABLE telemetry_raw DROP CONSTRAINT IF EXISTS telemetry_raw_train_run_id_fkey;
ALTER TABLE telemetry_raw DROP CONSTRAINT IF EXISTS telemetry_raw_route_id_fkey;

ALTER TABLE train_run DROP CONSTRAINT IF EXISTS train_run_locomotive_id_fkey;
ALTER TABLE train_run DROP CONSTRAINT IF EXISTS train_run_route_id_fkey;

ALTER TABLE locomotive_state_current DROP CONSTRAINT IF EXISTS locomotive_state_current_locomotive_id_fkey;

ALTER TABLE event_log DROP CONSTRAINT IF EXISTS event_log_locomotive_id_fkey;
ALTER TABLE event_log DROP CONSTRAINT IF EXISTS event_log_train_run_id_fkey;

ALTER TABLE proximity_event DROP CONSTRAINT IF EXISTS proximity_event_locomotive_id_fkey;