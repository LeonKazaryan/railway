package com.railway.health;

import com.railway.health.dto.HealthFactor;
import com.railway.health.dto.HealthResult;
import com.railway.health.dto.HealthStatus;
import com.railway.normalization.dto.NormalizedTelemetry;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class HealthEngine {

    // Thresholds (could be externalized to Config Service)
    private static final float MOTOR_TEMP_WARN = 95f;
    private static final float MOTOR_TEMP_CRIT = 105f;
    private static final float BRAKE_PRESS_WARN = 250f;
    private static final float BRAKE_PRESS_CRIT = 150f;
    private static final float FUEL_WARN = 20f;
    private static final float FUEL_CRIT = 10f;

    public HealthResult compute(NormalizedTelemetry t) {
        int base = 100;
        List<HealthFactor> factors = new ArrayList<>();

        // Motor temperature penalties
        if (t.getMotorTempC() != null) {
            float temp = t.getMotorTempC();
            if (temp > MOTOR_TEMP_WARN) {
                int impact = (int) Math.min(30, (temp - MOTOR_TEMP_WARN) * 0.8f);
                factors.add(new HealthFactor("motor_temp_c", -impact));
                base -= impact;
            }
            if (temp > MOTOR_TEMP_CRIT) {
                int extra = (int) Math.min(25, (temp - MOTOR_TEMP_CRIT));
                factors.add(new HealthFactor("motor_temp_critical", -extra));
                base -= extra;
            }
        }

        // Brake pressure low penalties
        if (t.getBrakePressureKpaEma() != null) {
            float b = t.getBrakePressureKpaEma();
            if (b < BRAKE_PRESS_WARN) {
                int impact = (int) Math.min(25, (BRAKE_PRESS_WARN - b) * 0.05f);
                factors.add(new HealthFactor("brake_pressure_low", -impact));
                base -= impact;
            }
            if (b < BRAKE_PRESS_CRIT) {
                int extra = (int) Math.min(25, (BRAKE_PRESS_CRIT - b) * 0.08f);
                factors.add(new HealthFactor("brake_pressure_critical", -extra));
                base -= extra;
            }
        }

        // Fuel low penalties
        if (t.getFuelLevelPct() != null) {
            float f = t.getFuelLevelPct();
            if (f < FUEL_WARN) {
                int impact = (int) Math.min(10, (FUEL_WARN - f) * 0.2f);
                factors.add(new HealthFactor("fuel_low", -impact));
                base -= impact;
            }
            if (f < FUEL_CRIT) {
                int extra = (int) Math.min(10, (FUEL_CRIT - f) * 0.3f);
                factors.add(new HealthFactor("fuel_critical", -extra));
                base -= extra;
            }
        }

        // Communication state penalty hint
        if (t.getCommState() != null) {
            switch (t.getCommState()) {
                case DEGRADED -> {
                    factors.add(new HealthFactor("comm_degraded", -5));
                    base -= 5;
                }
                case OFFLINE -> {
                    factors.add(new HealthFactor("comm_offline", -15));
                    base -= 15;
                }
                default -> {}
            }
        }

        // Build top-5 factors
        factors.sort(Comparator.comparingInt(HealthFactor::getImpact)); // most negative first
        List<HealthFactor> top = factors.size() > 5 ? factors.subList(0, 5) : factors;

        HealthStatus status = base >= 80 ? HealthStatus.NORMAL
                : base >= 60 ? HealthStatus.WARNING
                : HealthStatus.CRITICAL;

        String reason = buildReason(top);

        return HealthResult.builder()
                .health(Math.max(0, Math.min(100, base)))
                .status(status)
                .topFactors(new ArrayList<>(top))
                .reason(reason)
                .build();
    }

    private String buildReason(List<HealthFactor> factors) {
        if (factors.isEmpty()) return "All key parameters within nominal ranges";
        StringBuilder sb = new StringBuilder();
        sb.append("Top factors: ");
        for (int i = 0; i < factors.size(); i++) {
            var f = factors.get(i);
            sb.append(f.getName()).append(" (").append(f.getImpact()).append(")");
            if (i < factors.size() - 1) sb.append(", ");
        }
        return sb.toString();
    }
}
