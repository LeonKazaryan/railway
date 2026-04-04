package com.railway.alert;

import com.railway.alert.model.Alert;
import com.railway.alert.model.Severity;
import com.railway.normalization.dto.NormalizedTelemetry;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class AlertEngine {

    public List<Alert> evaluate(NormalizedTelemetry t) {
        List<Alert> out = new ArrayList<>();
        Instant now = t.getTs() != null ? t.getTs() : Instant.now();

        if (t.getMotorTempC() != null && t.getMotorTempC() > 100f) {
            out.add(Alert.builder()
                    .locomotiveId(t.getLocomotiveId())
                    .code("HIGH_COOLANT_TEMP")
                    .title("High coolant/motor temperature")
                    .severity(t.getMotorTempC() > 110f ? Severity.CRITICAL : Severity.WARNING)
                    .suggestedAction("Reduce load, check cooling system")
                    .ts(now)
                    .open(true)
                    .build());
        }

        if (t.getBrakePressureKpaEma() != null && t.getBrakePressureKpaEma() < 200f) {
            out.add(Alert.builder()
                    .locomotiveId(t.getLocomotiveId())
                    .code("BRAKE_PRESSURE_DROP")
                    .title("Brake pressure drop")
                    .severity(t.getBrakePressureKpaEma() < 150f ? Severity.CRITICAL : Severity.WARNING)
                    .suggestedAction("Inspect pneumatic system for leaks")
                    .ts(now)
                    .open(true)
                    .build());
        }

        if (t.isDelayed() || t.isStale()) {
            out.add(Alert.builder()
                    .locomotiveId(t.getLocomotiveId())
                    .code("NO_LIVE_SIGNAL")
                    .title("No live signal")
                    .severity(Severity.WARNING)
                    .suggestedAction("Check connectivity and antenna")
                    .ts(now)
                    .open(true)
                    .build());
        }

        if (t.getFuelLevelPct() != null && t.getFuelLevelPct() < 10f) {
            out.add(Alert.builder()
                    .locomotiveId(t.getLocomotiveId())
                    .code("LOW_FUEL")
                    .title("Fuel level critically low")
                    .severity(Severity.CRITICAL)
                    .suggestedAction("Plan immediate refuel")
                    .ts(now)
                    .open(true)
                    .build());
        }

        return out;
    }
}
