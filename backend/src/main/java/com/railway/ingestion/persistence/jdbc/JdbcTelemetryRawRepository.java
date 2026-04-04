package com.railway.ingestion.persistence.jdbc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.ingestion.port.TelemetryRawPersistencePort;
import lombok.RequiredArgsConstructor;
import org.postgresql.util.PGobject;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Array;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

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

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? java.util.Map.of() : value);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize driverState", e);
        }
    }
}
