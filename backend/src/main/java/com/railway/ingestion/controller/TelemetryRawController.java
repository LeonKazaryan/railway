package com.railway.ingestion.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.railway.ingestion.dto.IngestionAckResponse;
import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.ingestion.dto.TelemetryRawResponse;
import com.railway.ingestion.port.TelemetryRawPersistencePort;
import com.railway.ingestion.service.TelemetryAnomalyChecker;
import com.railway.ingestion.service.TelemetryIngestionService;
import com.railway.util.DurationParser;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
public class TelemetryRawController {

    private final TelemetryIngestionService telemetryIngestionService;
    private final TelemetryRawPersistencePort telemetryRawPersistencePort;
    private final TelemetryAnomalyChecker anomalyChecker;
    private final ObjectMapper objectMapper;

    @PostMapping("/raw")
    public IngestionAckResponse ingest(@Valid @RequestBody TelemetryRawRequest request) {
        return telemetryIngestionService.ingest(request);
    }

    /**
     * Выгрузка данных из telemetry_raw за последний период (JSON).
     */
    @GetMapping("/raw")
    public List<TelemetryRawResponse> getRecentTelemetry(
            @RequestParam(value = "window", required = false) String window,
            @RequestParam(value = "trainId", required = false) String trainId) {

        Duration duration = DurationParser.parseWindow(window, Duration.ofHours(24));
        Instant from = Instant.now().minus(duration);

        if (trainId != null && !trainId.isBlank()) {
            return telemetryRawPersistencePort.findRecentByTrainId(trainId, from);
        }
        return telemetryRawPersistencePort.findRecent(from);
    }

    /**
     * Выгрузка данных из telemetry_raw в CSV-файл с колонкой статуса аномалий.
     *
     * @param window  временное окно, например "24h", "72h", "30m" (по умолчанию 24h)
     * @param trainId опциональный идентификатор поезда
     */
    @GetMapping(value = "/raw/csv", produces = "text/csv")
    public void exportCsv(
            @RequestParam(value = "window", required = false) String window,
            @RequestParam(value = "trainId", required = false) String trainId,
            HttpServletResponse response) throws IOException {

        Duration duration = DurationParser.parseWindow(window, Duration.ofHours(24));
        Instant from = Instant.now().minus(duration);

        List<TelemetryRawResponse> data;
        if (trainId != null && !trainId.isBlank()) {
            data = telemetryRawPersistencePort.findRecentByTrainId(trainId, from);
        } else {
            data = telemetryRawPersistencePort.findRecent(from);
        }

        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"telemetry_raw.csv\"");

        try (PrintWriter writer = response.getWriter()) {
            // header
            writer.println(String.join(",",
                    "ts", "locomotive_id", "seq",
                    "serial_number", "train_id", "line_id", "line_name",
                    "train_run_id", "route_id", "geofence_id", "active_geofences",
                    "lat", "lon", "alt_m",
                    "speed_kph", "heading_deg",
                    "brake_pipe_pressure_kpa", "main_reservoir_pressure_kpa",
                    "brake_cylinder_pressure_kpa", "brake_pipe_leak_kpa_per_min",
                    "brake_status",
                    "battery_voltage_v", "traction_voltage_v", "current_a",
                    "engine_rpm", "engine_temp_c", "oil_temp_c",
                    "fuel_level_pct", "fuel_consumption_rate_lph",
                    "tractive_effort_kn", "dynamic_brake_force_kn",
                    "alerter_timer_sec", "pcs_open", "eab_status",
                    "comm_state", "alarm_status",
                    "fault_codes", "health_index",
                    "driver_state",
                    "weather_factor", "track_grade_pct", "current_mode",
                    "status"
            ));

            // rows
            for (TelemetryRawResponse row : data) {
                String status = anomalyChecker.check(row);

                writer.println(String.join(",",
                        safe(row.getTs()),
                        safe(row.getLocomotiveId()),
                        safe(row.getSeq()),
                        safe(row.getSerialNumber()),
                        safe(row.getTrainId()),
                        safe(row.getLineId()),
                        safe(row.getLineName()),
                        safe(row.getTrainRunId()),
                        safe(row.getRouteId()),
                        safe(row.getGeofenceId()),
                        safeList(row.getActiveGeofences()),
                        safe(row.getLat()),
                        safe(row.getLon()),
                        safe(row.getAltM()),
                        safe(row.getSpeedKph()),
                        safe(row.getHeadingDeg()),
                        safe(row.getBrakePipePressureKpa()),
                        safe(row.getMainReservoirPressureKpa()),
                        safe(row.getBrakeCylinderPressureKpa()),
                        safe(row.getBrakePipeLeakKpaPerMin()),
                        safe(row.getBrakeStatus()),
                        safe(row.getBatteryVoltageV()),
                        safe(row.getTractionVoltageV()),
                        safe(row.getCurrentA()),
                        safe(row.getEngineRpm()),
                        safe(row.getEngineTempC()),
                        safe(row.getOilTempC()),
                        safe(row.getFuelLevelPct()),
                        safe(row.getFuelConsumptionRateLph()),
                        safe(row.getTractiveEffortKn()),
                        safe(row.getDynamicBrakeForceKn()),
                        safe(row.getAlerterTimerSec()),
                        safe(row.getPcsOpen()),
                        safe(row.getEabStatus()),
                        safe(row.getCommState()),
                        safe(row.getAlarmStatus()),
                        safeFaultCodes(row.getFaultCodes()),
                        safe(row.getHealthIndex()),
                        safeDriverState(row.getDriverState()),
                        safe(row.getWeatherFactor()),
                        safe(row.getTrackGradePct()),
                        safe(row.getCurrentMode()),
                        csvQuote(status)
                ));
            }
            writer.flush();
        }
    }

    private String safe(Object value) {
        return value == null ? "" : value.toString();
    }

    private String csvQuote(String value) {
        if (value == null || value.isEmpty()) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private String safeList(List<String> items) {
        if (items == null || items.isEmpty()) return "";
        return "\"" + String.join(";", items) + "\"";
    }

    private String safeFaultCodes(List<String> codes) {
        if (codes == null || codes.isEmpty()) return "";
        return "\"" + String.join(";", codes) + "\"";
    }

    private String safeDriverState(java.util.Map<String, Object> map) {
        if (map == null || map.isEmpty()) return "";
        try {
            return "\"" + objectMapper.writeValueAsString(map).replace("\"", "\"\"") + "\"";
        } catch (Exception e) {
            return "";
        }
    }
}