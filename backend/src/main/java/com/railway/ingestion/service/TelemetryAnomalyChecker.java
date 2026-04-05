package com.railway.ingestion.service;

import com.railway.ingestion.dto.TelemetryRawResponse;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class TelemetryAnomalyChecker {

    private static final float BRAKE_PIPE_PRESSURE_MIN_KPA = 310f;
    private static final float BRAKE_PIPE_PRESSURE_MAX_KPA = 1750f;

    private static final float MAIN_RESERVOIR_PRESSURE_MIN_KPA = 414f;
    private static final float MAIN_RESERVOIR_PRESSURE_MAX_KPA = 1138f;

    private static final float ENGINE_RPM_MAX = 1050f;

    private static final float ENGINE_COOLANT_TEMP_MIN_C = 60f;
    private static final float ENGINE_COOLANT_TEMP_MAX_C = 110f;

    private static final float OIL_TEMP_MIN_C = 70f;
    private static final float OIL_TEMP_MAX_C = 110f;

    private static final float ALERTER_TIMER_MAX_SEC = 25f;

    private static final float TRACTIVE_EFFORT_MAX_KN = 800f;

    private static final float DYNAMIC_BRAKE_FORCE_MAX_KN = 534f;

    private static final float FORCE_NOISE_KN = 1f;

    private static final float BRAKE_PIPE_LEAK_MAX_KPA_PER_MIN = 34.5f;

    public String check(TelemetryRawResponse row) {
        List<String> issues = new ArrayList<>();

        if (row.getBrakePipePressureKpa() != null) {
            float v = row.getBrakePipePressureKpa();
            if (v > BRAKE_PIPE_PRESSURE_MAX_KPA) {
                issues.add("brake_pipe_pressure_kpa=" + v + " [макс " + BRAKE_PIPE_PRESSURE_MAX_KPA + " кПа]");
            } else if (v < BRAKE_PIPE_PRESSURE_MIN_KPA && isBrakePipeChargedRange(row.getBrakeStatus())) {
                issues.add("brake_pipe_pressure_kpa=" + v + " [мин " + BRAKE_PIPE_PRESSURE_MIN_KPA + " кПа при заряженной магистрали]");
            }
        }

        if (row.getMainReservoirPressureKpa() != null) {
            float v = row.getMainReservoirPressureKpa();
            if (v < MAIN_RESERVOIR_PRESSURE_MIN_KPA || v > MAIN_RESERVOIR_PRESSURE_MAX_KPA) {
                issues.add("main_reservoir_pressure_kpa=" + v + " [вне " + MAIN_RESERVOIR_PRESSURE_MIN_KPA + "…"
                        + MAIN_RESERVOIR_PRESSURE_MAX_KPA + " кПа]");
            }
        }

        if (row.getEngineRpm() != null && row.getEngineRpm() > ENGINE_RPM_MAX) {
            issues.add("engine_rpm=" + row.getEngineRpm() + " [макс " + ENGINE_RPM_MAX + " об/мин]");
        }

        if (row.getEngineTempC() != null) {
            float v = row.getEngineTempC();
            if (v < ENGINE_COOLANT_TEMP_MIN_C || v > ENGINE_COOLANT_TEMP_MAX_C) {
                issues.add("engine_temp_c=" + v + " [вне " + ENGINE_COOLANT_TEMP_MIN_C + "…"
                        + ENGINE_COOLANT_TEMP_MAX_C + " °C]");
            }
        }

        if (row.getOilTempC() != null) {
            float v = row.getOilTempC();
            if (v < OIL_TEMP_MIN_C || v > OIL_TEMP_MAX_C) {
                issues.add("oil_temp_c=" + v + " [вне " + OIL_TEMP_MIN_C + "…" + OIL_TEMP_MAX_C + " °C]");
            }
        }

        if (row.getAlerterTimerSec() != null && row.getAlerterTimerSec() > ALERTER_TIMER_MAX_SEC) {
            issues.add("alerter_timer_sec=" + row.getAlerterTimerSec() + " [макс " + ALERTER_TIMER_MAX_SEC + " с]");
        }

        if (row.getTractiveEffortKn() != null) {
            float v = row.getTractiveEffortKn();
            if (v < -FORCE_NOISE_KN || v > TRACTIVE_EFFORT_MAX_KN) {
                issues.add("tractive_effort_kn=" + v + " [0…" + TRACTIVE_EFFORT_MAX_KN + " кН]");
            }
        }

        if (row.getDynamicBrakeForceKn() != null) {
            float v = row.getDynamicBrakeForceKn();
            if (v < -FORCE_NOISE_KN || v > DYNAMIC_BRAKE_FORCE_MAX_KN) {
                issues.add("dynamic_brake_force_kn=" + v + " [0…" + DYNAMIC_BRAKE_FORCE_MAX_KN + " кН]");
            }
        }

        if (row.getBrakePipeLeakKpaPerMin() != null
                && row.getBrakePipeLeakKpaPerMin() > BRAKE_PIPE_LEAK_MAX_KPA_PER_MIN) {
            issues.add("brake_pipe_leak_kpa_per_min=" + row.getBrakePipeLeakKpaPerMin()
                    + " [макс " + BRAKE_PIPE_LEAK_MAX_KPA_PER_MIN + " кПа/мин]");
        }

        if (row.getPcsOpen() != null && row.getPcsOpen()) {
            issues.add("pcs_open=true");
        }

        if (row.getFaultCodes() != null && !row.getFaultCodes().isEmpty()) {
            issues.add("fault_codes: " + String.join(", ", row.getFaultCodes()));
        }

        if (issues.isEmpty()) {
            return "OK";
        }
        return "ANOMALY: " + String.join("; ", issues);
    }

    private static boolean isBrakePipeChargedRange(String brakeStatus) {
        if (brakeStatus == null || brakeStatus.isBlank()) {
            return true;
        }
        String s = brakeStatus.trim().toLowerCase();
        if (s.contains("service") || s.contains("apply") || s.contains("emergency")) {
            return false;
        }
        return true;
    }
}
