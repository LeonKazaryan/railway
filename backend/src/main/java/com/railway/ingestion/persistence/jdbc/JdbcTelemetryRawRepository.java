package com.railway.ingestion.persistence.jdbc;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.ingestion.enumtype.AlarmStatus;
import com.railway.ingestion.enumtype.CommState;
import com.railway.ingestion.enumtype.DoorsState;
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
            insert into telemetry_raw (
                ts,
                locomotive_id,
                seq,
                train_run_id,
                route_id,
                lat,
                lon,
                alt_m,
                speed_kph,
                heading_deg,
                voltage_v,
                current_a,
                motor_temp_c,
                brake_pressure_kpa,
                fuel_level_pct,
                energy_level_pct,
                doors_state,
                alarm_status,
                comm_state,
                fault_codes,
                driver_state
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict (ts, locomotive_id, seq) do nothing
            """;

    @Override
    public boolean insert(TelemetryRawRequest request, Integer healthIndex) {
        try (Connection connection = dataSource.getConnection();
             PreparedStatement ps = connection.prepareStatement(SQL)) {

            ps.setObject(1, OffsetDateTime.ofInstant(request.getTs(), ZoneOffset.UTC));
            ps.setObject(2, request.getLocomotiveId());
            ps.setLong(3, request.getSeq());

            ps.setObject(4, request.getTrainRunId());
            ps.setObject(5, request.getRouteId());

            ps.setObject(6, request.getLat(), Types.DOUBLE);
            ps.setObject(7, request.getLon(), Types.DOUBLE);
            ps.setObject(8, request.getAltM(), Types.DOUBLE);

            ps.setObject(9, request.getSpeedKph(), Types.REAL);
            ps.setObject(10, request.getHeadingDeg(), Types.REAL);
            ps.setObject(11, request.getVoltageV(), Types.REAL);
            ps.setObject(12, request.getCurrentA(), Types.REAL);
            ps.setObject(13, request.getMotorTempC(), Types.REAL);
            ps.setObject(14, request.getBrakePressureKpa(), Types.REAL);
            ps.setObject(15, request.getFuelLevelPct(), Types.REAL);
            ps.setObject(16, request.getEnergyLevelPct(), Types.REAL);

            ps.setObject(17, toSmallInt(request.getDoorsState()), Types.SMALLINT);
            ps.setObject(18, toSmallInt(request.getAlarmStatus()), Types.SMALLINT);
            ps.setObject(19, toSmallInt(request.getCommState()), Types.SMALLINT);

            Array faultCodesArray = connection.createArrayOf(
                    "text",
                    request.getFaultCodes() == null
                            ? new String[0]
                            : request.getFaultCodes().toArray(new String[0])
            );
            ps.setArray(20, faultCodesArray);

            PGobject jsonbObject = new PGobject();
            jsonbObject.setType("jsonb");
            jsonbObject.setValue(toJson(request.getDriverState()));
            ps.setObject(21, jsonbObject);

            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to insert telemetry_raw: " + e.getMessage(), e);
        }
    }

    private short toSmallInt(DoorsState state) {
        return switch (state) {
            case CLOSED -> 0;
            case OPEN -> 1;
        };
    }

    private short toSmallInt(AlarmStatus status) {
        return switch (status) {
            case NORMAL -> 0;
            case WARNING -> 1;
            case CRITICAL -> 2;
        };
    }

    private short toSmallInt(CommState state) {
        return switch (state) {
            case OFFLINE -> 0;
            case ONLINE -> 1;
            case DEGRADED -> 2;
        };
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? java.util.Map.of() : value);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize driverState", e);
        }
    }
}