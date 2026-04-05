package com.railway.ingestion.service;

import com.railway.ingestion.dto.TelemetryRawResponse;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Проверяет строку телеметрии на аномалии по параметрам.
 * Возвращает статус "OK" если всё в норме,
 * или "ANOMALY" + перечень отклонений.
 */
@Component
public class TelemetryAnomalyChecker {

    // ── Пороговые значения ──────────────────────────────────────

    private static final float SPEED_MAX_KPH = 200f;

    private static final float ENGINE_TEMP_WARNING_C = 100f;
    private static final float ENGINE_TEMP_CRITICAL_C = 110f;

    private static final float OIL_TEMP_WARNING_C = 90f;
    private static final float OIL_TEMP_CRITICAL_C = 110f;

    private static final float BRAKE_PIPE_PRESSURE_WARNING_KPA = 200f;
    private static final float BRAKE_PIPE_PRESSURE_CRITICAL_KPA = 150f;

    private static final float BRAKE_PIPE_LEAK_WARNING_KPA_MIN = 5f;

    private static final float BATTERY_VOLTAGE_MIN_V = 90f;
    private static final float TRACTION_VOLTAGE_MIN_V = 1800f;
    private static final float TRACTION_VOLTAGE_MAX_V = 4000f;

    private static final float CURRENT_MAX_A = 800f;

    private static final float FUEL_LOW_PCT = 10f;

    private static final float ENGINE_RPM_MAX = 2200f;

    /**
     * @return "OK" или "ANOMALY: описание1; описание2; ..."
     */
    public String check(TelemetryRawResponse row) {
        List<String> issues = new ArrayList<>();

        // Скорость
        if (row.getSpeedKph() != null && row.getSpeedKph() > SPEED_MAX_KPH) {
            issues.add("speed_kph=" + row.getSpeedKph() + " (макс " + SPEED_MAX_KPH + ")");
        }

        // Температура двигателя
        if (row.getEngineTempC() != null) {
            if (row.getEngineTempC() > ENGINE_TEMP_CRITICAL_C) {
                issues.add("engine_temp_c=" + row.getEngineTempC() + " [CRITICAL >110°C]");
            } else if (row.getEngineTempC() > ENGINE_TEMP_WARNING_C) {
                issues.add("engine_temp_c=" + row.getEngineTempC() + " [WARNING >100°C]");
            }
        }

        // Температура масла
        if (row.getOilTempC() != null) {
            if (row.getOilTempC() > OIL_TEMP_CRITICAL_C) {
                issues.add("oil_temp_c=" + row.getOilTempC() + " [CRITICAL >110°C]");
            } else if (row.getOilTempC() > OIL_TEMP_WARNING_C) {
                issues.add("oil_temp_c=" + row.getOilTempC() + " [WARNING >90°C]");
            }
        }

        // Давление тормозной магистрали
        if (row.getBrakePipePressureKpa() != null) {
            if (row.getBrakePipePressureKpa() < BRAKE_PIPE_PRESSURE_CRITICAL_KPA) {
                issues.add("brake_pipe_pressure_kpa=" + row.getBrakePipePressureKpa() + " [CRITICAL <150]");
            } else if (row.getBrakePipePressureKpa() < BRAKE_PIPE_PRESSURE_WARNING_KPA) {
                issues.add("brake_pipe_pressure_kpa=" + row.getBrakePipePressureKpa() + " [WARNING <200]");
            }
        }

        // Утечка тормозной магистрали
        if (row.getBrakePipeLeakKpaPerMin() != null && row.getBrakePipeLeakKpaPerMin() > BRAKE_PIPE_LEAK_WARNING_KPA_MIN) {
            issues.add("brake_pipe_leak_kpa_per_min=" + row.getBrakePipeLeakKpaPerMin() + " [утечка >5 кПа/мин]");
        }

        // Напряжение батареи
        if (row.getBatteryVoltageV() != null && row.getBatteryVoltageV() < BATTERY_VOLTAGE_MIN_V) {
            issues.add("battery_voltage_v=" + row.getBatteryVoltageV() + " [низкое <" + BATTERY_VOLTAGE_MIN_V + "V]");
        }

        // Тяговое напряжение
        if (row.getTractionVoltageV() != null) {
            if (row.getTractionVoltageV() < TRACTION_VOLTAGE_MIN_V) {
                issues.add("traction_voltage_v=" + row.getTractionVoltageV() + " [низкое <" + TRACTION_VOLTAGE_MIN_V + "V]");
            } else if (row.getTractionVoltageV() > TRACTION_VOLTAGE_MAX_V) {
                issues.add("traction_voltage_v=" + row.getTractionVoltageV() + " [высокое >" + TRACTION_VOLTAGE_MAX_V + "V]");
            }
        }

        // Ток
        if (row.getCurrentA() != null && row.getCurrentA() > CURRENT_MAX_A) {
            issues.add("current_a=" + row.getCurrentA() + " [перегрузка >" + CURRENT_MAX_A + "A]");
        }

        // Обороты двигателя
        if (row.getEngineRpm() != null && row.getEngineRpm() > ENGINE_RPM_MAX) {
            issues.add("engine_rpm=" + row.getEngineRpm() + " [превышение >" + ENGINE_RPM_MAX + "]");
        }

        // Уровень топлива
        if (row.getFuelLevelPct() != null && row.getFuelLevelPct() < FUEL_LOW_PCT) {
            issues.add("fuel_level_pct=" + row.getFuelLevelPct() + "% [критически низкий <10%]");
        }

        // Статус тревоги
        if (row.getAlarmStatus() != null) {
            String alarm = row.getAlarmStatus().toUpperCase();
            if ("CRITICAL".equals(alarm)) {
                issues.add("alarm_status=CRITICAL");
            } else if ("WARNING".equals(alarm)) {
                issues.add("alarm_status=WARNING");
            }
        }

        // Состояние связи
        if (row.getCommState() != null) {
            String comm = row.getCommState().toUpperCase();
            if ("OFFLINE".equals(comm)) {
                issues.add("comm_state=OFFLINE");
            } else if ("DEGRADED".equals(comm)) {
                issues.add("comm_state=DEGRADED");
            }
        }

        // PCS (автостоп) открыт
        if (row.getPcsOpen() != null && row.getPcsOpen()) {
            issues.add("pcs_open=true [автостоп активирован]");
        }

        // Коды неисправностей
        if (row.getFaultCodes() != null && !row.getFaultCodes().isEmpty()) {
            issues.add("fault_codes: " + String.join(", ", row.getFaultCodes()));
        }

        // Health index
        if (row.getHealthIndex() != null && row.getHealthIndex() < 50) {
            issues.add("health_index=" + row.getHealthIndex() + " [низкий <50]");
        }

        if (issues.isEmpty()) {
            return "OK";
        }
        return "ANOMALY: " + String.join("; ", issues);
    }
}
