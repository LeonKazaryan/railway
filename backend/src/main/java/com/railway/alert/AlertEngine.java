package com.railway.alert;

import com.railway.alert.model.Alert;
import com.railway.alert.model.Severity;
import com.railway.health.ParameterZoneService.Zone;
import com.railway.ingestion.dto.TelemetryRawRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class AlertEngine {

    private static final Map<String, AlertMeta> RED_ALERT_META = Map.ofEntries(
            Map.entry("engine_temp_c", new AlertMeta(
                    "HIGH_ENGINE_TEMP", "Engine temperature critical",
                    "Reduce load, check cooling system")),
            Map.entry("oil_temp_c", new AlertMeta(
                    "HIGH_OIL_TEMP", "Oil temperature critical",
                    "Check lubrication system")),
            Map.entry("brake_pipe_pressure_kpa", new AlertMeta(
                    "BRAKE_PRESSURE_DROP", "Brake pipe pressure critically low",
                    "Inspect pneumatic system for leaks")),
            Map.entry("main_reservoir_pressure_kpa", new AlertMeta(
                    "MAIN_RESERVOIR_LOW", "Main reservoir pressure critically low",
                    "Check compressor and air system")),
            Map.entry("brake_pipe_leak_kpa_per_min", new AlertMeta(
                    "BRAKE_PIPE_LEAK", "Excessive brake pipe leak rate",
                    "Inspect pipe connections and seals")),
            Map.entry("current_a", new AlertMeta(
                    "OVERCURRENT", "Electrical current dangerously high",
                    "Reduce traction load, check electrical system")),
            Map.entry("fuel_level_pct", new AlertMeta(
                    "LOW_FUEL", "Fuel level critically low",
                    "Plan immediate refuel")),
            Map.entry("tractive_effort_kn", new AlertMeta(
                    "TRACTIVE_EFFORT_HIGH", "Tractive effort exceeds safe limit",
                    "Reduce throttle, check traction motor")),
            Map.entry("engine_rpm", new AlertMeta(
                    "ENGINE_OVERSPEED", "Engine RPM critically high",
                    "Reduce throttle immediately")),
            Map.entry("comm_state", new AlertMeta(
                    "COMM_OFFLINE", "Communication lost",
                    "Check antenna and connectivity"))
    );

    public List<Alert> evaluate(Map<String, Zone> zones, TelemetryRawRequest request) {
        List<Alert> out = new ArrayList<>();
        Instant ts = request.getTs() != null ? request.getTs() : Instant.now();

        for (Map.Entry<String, Zone> entry : zones.entrySet()) {
            if (entry.getValue() != Zone.RED) continue;

            AlertMeta meta = RED_ALERT_META.get(entry.getKey());
            if (meta == null) continue;

            out.add(Alert.builder()
                    .locomotiveId(request.getLocomotiveId())
                    .code(meta.code())
                    .title(meta.title())
                    .severity(Severity.CRITICAL)
                    .suggestedAction(meta.suggestedAction())
                    .ts(ts)
                    .open(true)
                    .build());
        }

        return out;
    }

    private record AlertMeta(String code, String title, String suggestedAction) {}
}
