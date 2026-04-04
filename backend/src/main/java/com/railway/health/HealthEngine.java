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

    private static final float ENGINE_TEMP_WARN = 95f;
    private static final float ENGINE_TEMP_CRIT = 105f;
    private static final float BRAKE_PIPE_PRESS_WARN = 400f;
    private static final float BRAKE_PIPE_PRESS_CRIT = 310f;
    private static final float OIL_TEMP_WARN = 100f;
    private static final float OIL_TEMP_CRIT = 110f;
    private static final float FUEL_WARN = 20f;
    private static final float FUEL_CRIT = 10f;
    private static final float LEAK_WARN = 25f;
    private static final float LEAK_CRIT = 34.5f;

    public HealthResult compute(NormalizedTelemetry t) {
        int base = 100;
        List<HealthFactor> factors = new ArrayList<>();

        if (t.getEngineTempC() != null) {
            float temp = t.getEngineTempC();
            if (temp > ENGINE_TEMP_WARN) {
                int impact = (int) Math.min(30, (temp - ENGINE_TEMP_WARN) * 0.8f);
                factors.add(new HealthFactor("engine_temp_c", -impact));
                base -= impact;
            }
            if (temp > ENGINE_TEMP_CRIT) {
                int extra = (int) Math.min(25, (temp - ENGINE_TEMP_CRIT));
                factors.add(new HealthFactor("engine_temp_critical", -extra));
                base -= extra;
            }
        }

        if (t.getOilTempC() != null) {
            float temp = t.getOilTempC();
            if (temp > OIL_TEMP_WARN) {
                int impact = (int) Math.min(20, (temp - OIL_TEMP_WARN) * 0.6f);
                factors.add(new HealthFactor("oil_temp_c", -impact));
                base -= impact;
            }
            if (temp > OIL_TEMP_CRIT) {
                int extra = (int) Math.min(20, (temp - OIL_TEMP_CRIT));
                factors.add(new HealthFactor("oil_temp_critical", -extra));
                base -= extra;
            }
        }

        if (t.getBrakePipePressureKpaEma() != null) {
            float b = t.getBrakePipePressureKpaEma();
            if (b < BRAKE_PIPE_PRESS_WARN) {
                int impact = (int) Math.min(25, (BRAKE_PIPE_PRESS_WARN - b) * 0.05f);
                factors.add(new HealthFactor("brake_pipe_pressure_low", -impact));
                base -= impact;
            }
            if (b < BRAKE_PIPE_PRESS_CRIT) {
                int extra = (int) Math.min(25, (BRAKE_PIPE_PRESS_CRIT - b) * 0.08f);
                factors.add(new HealthFactor("brake_pipe_pressure_critical", -extra));
                base -= extra;
            }
        }

        if (t.getBrakePipeLeakKpaPerMin() != null) {
            float leak = t.getBrakePipeLeakKpaPerMin();
            if (leak > LEAK_WARN) {
                int impact = (int) Math.min(15, (leak - LEAK_WARN) * 0.5f);
                factors.add(new HealthFactor("brake_pipe_leak", -impact));
                base -= impact;
            }
            if (leak > LEAK_CRIT) {
                int extra = (int) Math.min(15, (leak - LEAK_CRIT) * 0.8f);
                factors.add(new HealthFactor("brake_pipe_leak_critical", -extra));
                base -= extra;
            }
        }

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

        if (t.getCommState() != null) {
            String cs = t.getCommState();
            if ("intermittent".equalsIgnoreCase(cs)) {
                factors.add(new HealthFactor("comm_intermittent", -5));
                base -= 5;
            } else if ("offline".equalsIgnoreCase(cs)) {
                factors.add(new HealthFactor("comm_offline", -15));
                base -= 15;
            }
        }

        if (t.getEabStatus() != null) {
            String eab = t.getEabStatus();
            if ("degraded".equalsIgnoreCase(eab)) {
                factors.add(new HealthFactor("eab_degraded", -8));
                base -= 8;
            } else if ("lost".equalsIgnoreCase(eab)) {
                factors.add(new HealthFactor("eab_lost", -20));
                base -= 20;
            }
        }

        factors.sort(Comparator.comparingInt(HealthFactor::getImpact));
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
