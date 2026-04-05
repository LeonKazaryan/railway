package com.railway.ingestion.persistence.jdbc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.ingestion.dto.TelemetryRawResponse;
import com.railway.ingestion.port.TelemetryRawPersistencePort;
import lombok.RequiredArgsConstructor;
import org.postgresql.util.PGobject;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.*;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Component
@RequiredArgsConstructor
public class JdbcTelemetryRawRepository implements TelemetryRawPersistencePort {

    private final DataSource dataSource;
    private final ObjectMapper objectMapper;

    private static final String SQL = """
            INSERT INTO telemetry_raw (
                ts, locomotive_id, seq,
                serial_number, train_id, line_id, line_name,
                train_run_id, route_id, geofence_id, active_geofences,
                lat, lon, alt_m,
                speed_kph, heading_deg,
                brake_pipe_pressure_kpa, main_reservoir_pressure_kpa,
                brake_cylinder_pressure_kpa, brake_pipe_leak_kpa_per_min,
                brake_status,
                battery_voltage_v, traction_voltage_v, current_a,
                engine_rpm, engine_temp_c, oil_temp_c,
                fuel_level_pct, fuel_consumption_rate_lph,
                tractive_effort_kn, dynamic_brake_force_kn,
                alerter_timer_sec, pcs_open, eab_status,
                comm_state, alarm_status,
                fault_codes, health_index,
                driver_state,
                weather_factor, track_grade_pct, current_mode
            ) VALUES (
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?,
                ?, ?,
                ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?,
                ?, ?,
                ?,
                ?, ?, ?
            )
            ON CONFLICT (ts, locomotive_id, seq) DO NOTHING
            """;

    private static final String SELECT_RECENT_SQL = """
            SELECT ts, locomotive_id, seq,
                   serial_number, train_id, line_id, line_name,
                   train_run_id, route_id, geofence_id, active_geofences,
                   lat, lon, alt_m,
                   speed_kph, heading_deg,
                   brake_pipe_pressure_kpa, main_reservoir_pressure_kpa,
                   brake_cylinder_pressure_kpa, brake_pipe_leak_kpa_per_min,
                   brake_status,
                   battery_voltage_v, traction_voltage_v, current_a,
                   engine_rpm, engine_temp_c, oil_temp_c,
                   fuel_level_pct, fuel_consumption_rate_lph,
                   tractive_effort_kn, dynamic_brake_force_kn,
                   alerter_timer_sec, pcs_open, eab_status,
                   comm_state, alarm_status,
                   fault_codes, health_index,
                   driver_state,
                   weather_factor, track_grade_pct, current_mode
            FROM telemetry_raw
            WHERE ts >= ?
            ORDER BY ts DESC
            """;

    private static final String SELECT_RECENT_BY_TRAIN_ID_SQL = """
            SELECT ts, locomotive_id, seq,
                   serial_number, train_id, line_id, line_name,
                   train_run_id, route_id, geofence_id, active_geofences,
                   lat, lon, alt_m,
                   speed_kph, heading_deg,
                   brake_pipe_pressure_kpa, main_reservoir_pressure_kpa,
                   brake_cylinder_pressure_kpa, brake_pipe_leak_kpa_per_min,
                   brake_status,
                   battery_voltage_v, traction_voltage_v, current_a,
                   engine_rpm, engine_temp_c, oil_temp_c,
                   fuel_level_pct, fuel_consumption_rate_lph,
                   tractive_effort_kn, dynamic_brake_force_kn,
                   alerter_timer_sec, pcs_open, eab_status,
                   comm_state, alarm_status,
                   fault_codes, health_index,
                   driver_state,
                   weather_factor, track_grade_pct, current_mode
            FROM telemetry_raw
            WHERE train_id = ? AND ts >= ?
            ORDER BY ts DESC
            """;

    @Override
    public boolean insert(TelemetryRawRequest r, Integer healthIndex) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement ps = connection.prepareStatement(SQL)) {

            int i = 1;

            ps.setObject(i++, OffsetDateTime.ofInstant(r.getTs(), ZoneOffset.UTC));
            ps.setObject(i++, r.getLocomotiveId());
            ps.setLong(i++, r.getSeq());

            ps.setString(i++, r.getSerialNumber());
            ps.setString(i++, r.getTrainId());
            ps.setString(i++, r.getLineId());
            ps.setString(i++, r.getLineName());

            ps.setObject(i++, r.getTrainRunId());
            ps.setString(i++, r.getRouteId());
            ps.setObject(i++, r.getGeofenceId());

            Array geofencesArray = connection.createArrayOf(
                    "text",
                    r.getActiveGeofences() == null
                            ? new String[0]
                            : r.getActiveGeofences().toArray(new String[0])
            );
            ps.setArray(i++, geofencesArray);

            ps.setObject(i++, r.getLat(), Types.DOUBLE);
            ps.setObject(i++, r.getLon(), Types.DOUBLE);
            ps.setObject(i++, r.getAltM(), Types.DOUBLE);

            ps.setObject(i++, r.getSpeedKph(), Types.REAL);
            ps.setObject(i++, r.getHeadingDeg(), Types.REAL);

            ps.setObject(i++, r.getBrakePipePressureKpa(), Types.REAL);
            ps.setObject(i++, r.getMainReservoirPressureKpa(), Types.REAL);
            ps.setObject(i++, r.getBrakeCylinderPressureKpa(), Types.REAL);
            ps.setObject(i++, r.getBrakePipeLeakKpaPerMin(), Types.REAL);
            ps.setString(i++, r.getBrakeStatus());

            ps.setObject(i++, r.getBatteryVoltageV(), Types.REAL);
            ps.setObject(i++, r.getTractionVoltageV(), Types.REAL);
            ps.setObject(i++, r.getCurrentA(), Types.REAL);

            ps.setObject(i++, r.getEngineRpm(), Types.REAL);
            ps.setObject(i++, r.getEngineTempC(), Types.REAL);
            ps.setObject(i++, r.getOilTempC(), Types.REAL);

            ps.setObject(i++, r.getFuelLevelPct(), Types.REAL);
            ps.setObject(i++, r.getFuelConsumptionRateLph(), Types.REAL);

            ps.setObject(i++, r.getTractiveEffortKn(), Types.REAL);
            ps.setObject(i++, r.getDynamicBrakeForceKn(), Types.REAL);

            ps.setObject(i++, r.getAlerterTimerSec(), Types.REAL);
            ps.setObject(i++, r.getPcsOpen(), Types.BOOLEAN);
            ps.setString(i++, r.getEabStatus());

            ps.setString(i++, r.getCommState());
            ps.setString(i++, r.getAlarmStatus());

            Array faultCodesArray = connection.createArrayOf(
                    "text",
                    r.getFaultCodes() == null
                            ? new String[0]
                            : r.getFaultCodes().toArray(new String[0])
            );
            ps.setArray(i++, faultCodesArray);
            ps.setObject(i++, r.getHealthIndex() != null ? r.getHealthIndex() : healthIndex, Types.SMALLINT);

            PGobject jsonbObject = new PGobject();
            jsonbObject.setType("jsonb");
            jsonbObject.setValue(toJson(r.getDriverState()));
            ps.setObject(i++, jsonbObject);

            ps.setObject(i++, r.getWeatherFactor(), Types.REAL);
            ps.setObject(i++, r.getTrackGradePct(), Types.REAL);
            ps.setString(i++, r.getCurrentMode());

            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to insert telemetry_raw: " + e.getMessage(), e);
        }
    }

    @Override
    public List<TelemetryRawResponse> findRecent(Instant from) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement ps = connection.prepareStatement(SELECT_RECENT_SQL)) {

            ps.setObject(1, OffsetDateTime.ofInstant(from, ZoneOffset.UTC));

            return executeQuery(ps);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to query telemetry_raw: " + e.getMessage(), e);
        }
    }

    @Override
    public List<TelemetryRawResponse> findRecentByTrainId(String trainId, Instant from) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement ps = connection.prepareStatement(SELECT_RECENT_BY_TRAIN_ID_SQL)) {

            ps.setString(1, trainId);
            ps.setObject(2, OffsetDateTime.ofInstant(from, ZoneOffset.UTC));

            return executeQuery(ps);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to query telemetry_raw by train_id: " + e.getMessage(), e);
        }
    }

    private List<TelemetryRawResponse> executeQuery(PreparedStatement ps) throws SQLException {
        List<TelemetryRawResponse> results = new ArrayList<>();
        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                results.add(mapRow(rs));
            }
        }
        return results;
    }

    private TelemetryRawResponse mapRow(ResultSet rs) throws SQLException {
        // fault_codes
        Array faultArray = rs.getArray("fault_codes");
        List<String> faultCodes = List.of();
        if (faultArray != null) {
            String[] arr = (String[]) faultArray.getArray();
            faultCodes = arr != null ? List.of(arr) : List.of();
        }

        // active_geofences
        Array geoArray = rs.getArray("active_geofences");
        List<String> activeGeofences = List.of();
        if (geoArray != null) {
            String[] arr = (String[]) geoArray.getArray();
            activeGeofences = arr != null ? List.of(arr) : List.of();
        }

        // driver_state
        Map<String, Object> driverState = Map.of();
        String driverJson = rs.getString("driver_state");
        if (driverJson != null && !driverJson.isBlank()) {
            try {
                driverState = objectMapper.readValue(driverJson, new TypeReference<>() {});
            } catch (JsonProcessingException e) {
                // leave as empty map
            }
        }

        // nullable UUIDs
        UUID trainRunId = rs.getObject("train_run_id") != null
                ? rs.getObject("train_run_id", UUID.class) : null;
        UUID geofenceId = rs.getObject("geofence_id") != null
                ? rs.getObject("geofence_id", UUID.class) : null;

        return TelemetryRawResponse.builder()
                .ts(rs.getObject("ts", OffsetDateTime.class).toInstant())
                .locomotiveId(rs.getObject("locomotive_id", UUID.class))
                .seq(rs.getLong("seq"))
                .serialNumber(rs.getString("serial_number"))
                .trainId(rs.getString("train_id"))
                .lineId(rs.getString("line_id"))
                .lineName(rs.getString("line_name"))
                .trainRunId(trainRunId)
                .routeId(rs.getString("route_id"))
                .geofenceId(geofenceId)
                .activeGeofences(activeGeofences)
                .lat(getDoubleOrNull(rs, "lat"))
                .lon(getDoubleOrNull(rs, "lon"))
                .altM(getDoubleOrNull(rs, "alt_m"))
                .speedKph(getFloatOrNull(rs, "speed_kph"))
                .headingDeg(getFloatOrNull(rs, "heading_deg"))
                .brakePipePressureKpa(getFloatOrNull(rs, "brake_pipe_pressure_kpa"))
                .mainReservoirPressureKpa(getFloatOrNull(rs, "main_reservoir_pressure_kpa"))
                .brakeCylinderPressureKpa(getFloatOrNull(rs, "brake_cylinder_pressure_kpa"))
                .brakePipeLeakKpaPerMin(getFloatOrNull(rs, "brake_pipe_leak_kpa_per_min"))
                .brakeStatus(rs.getString("brake_status"))
                .batteryVoltageV(getFloatOrNull(rs, "battery_voltage_v"))
                .tractionVoltageV(getFloatOrNull(rs, "traction_voltage_v"))
                .currentA(getFloatOrNull(rs, "current_a"))
                .engineRpm(getFloatOrNull(rs, "engine_rpm"))
                .engineTempC(getFloatOrNull(rs, "engine_temp_c"))
                .oilTempC(getFloatOrNull(rs, "oil_temp_c"))
                .fuelLevelPct(getFloatOrNull(rs, "fuel_level_pct"))
                .fuelConsumptionRateLph(getFloatOrNull(rs, "fuel_consumption_rate_lph"))
                .tractiveEffortKn(getFloatOrNull(rs, "tractive_effort_kn"))
                .dynamicBrakeForceKn(getFloatOrNull(rs, "dynamic_brake_force_kn"))
                .alerterTimerSec(getFloatOrNull(rs, "alerter_timer_sec"))
                .pcsOpen(getBooleanOrNull(rs, "pcs_open"))
                .eabStatus(rs.getString("eab_status"))
                .commState(rs.getString("comm_state"))
                .alarmStatus(rs.getString("alarm_status"))
                .faultCodes(faultCodes)
                .healthIndex(getShortOrNull(rs, "health_index"))
                .driverState(driverState)
                .weatherFactor(getFloatOrNull(rs, "weather_factor"))
                .trackGradePct(getFloatOrNull(rs, "track_grade_pct"))
                .currentMode(rs.getString("current_mode"))
                .build();
    }

    private Double getDoubleOrNull(ResultSet rs, String col) throws SQLException {
        double v = rs.getDouble(col);
        return rs.wasNull() ? null : v;
    }

    private Float getFloatOrNull(ResultSet rs, String col) throws SQLException {
        float v = rs.getFloat(col);
        return rs.wasNull() ? null : v;
    }

    private Short getShortOrNull(ResultSet rs, String col) throws SQLException {
        short v = rs.getShort(col);
        return rs.wasNull() ? null : v;
    }

    private Boolean getBooleanOrNull(ResultSet rs, String col) throws SQLException {
        boolean v = rs.getBoolean(col);
        return rs.wasNull() ? null : v;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? java.util.Map.of() : value);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize driverState", e);
        }
    }
}
