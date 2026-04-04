package com.railway.health;

import com.railway.ingestion.dto.TelemetryRawRequest;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ParameterZoneService {

    public enum Zone { GREEN, YELLOW, RED }

    public enum Direction { HIGH_BAD, LOW_BAD }

    public record NumericRule(String param, float yellowThreshold, float redThreshold,
                              int weight, Direction direction) {}

    public record EnumRule(String param, List<String> yellowValues, List<String> redValues, int weight) {}

    private static final List<NumericRule> NUMERIC_RULES = List.of(
            new NumericRule("engine_temp_c",   88f,  100f, 15, Direction.HIGH_BAD),
            new NumericRule("oil_temp_c",      85f,  100f, 10, Direction.HIGH_BAD),
            new NumericRule("brake_pipe_pressure_kpa", 450f, 380f, 15, Direction.LOW_BAD),
            new NumericRule("main_reservoir_pressure_kpa", 700f, 500f, 10, Direction.LOW_BAD),
            new NumericRule("brake_pipe_leak_kpa_per_min", 15f, 30f, 12, Direction.HIGH_BAD),
            new NumericRule("current_a",       1200f, 1500f, 8, Direction.HIGH_BAD),
            new NumericRule("fuel_level_pct",  25f,   15f,   8, Direction.LOW_BAD),
            new NumericRule("tractive_effort_kn", 500f, 700f, 5, Direction.HIGH_BAD),
            new NumericRule("engine_rpm",      900f, 1050f,  7, Direction.HIGH_BAD)
    );

    private static final EnumRule COMM_STATE_RULE =
            new EnumRule("comm_state", List.of("intermittent"), List.of("offline"), 10);

    public Map<String, Zone> evaluate(TelemetryRawRequest r) {
        Map<String, Zone> zones = new LinkedHashMap<>();

        putIfPresent(zones, "engine_temp_c", r.getEngineTempC());
        putIfPresent(zones, "oil_temp_c", r.getOilTempC());
        putIfPresent(zones, "brake_pipe_pressure_kpa", r.getBrakePipePressureKpa());
        putIfPresent(zones, "main_reservoir_pressure_kpa", r.getMainReservoirPressureKpa());
        putIfPresent(zones, "brake_pipe_leak_kpa_per_min", r.getBrakePipeLeakKpaPerMin());
        putIfPresent(zones, "current_a", r.getCurrentA());
        putIfPresent(zones, "fuel_level_pct", r.getFuelLevelPct());
        putIfPresent(zones, "tractive_effort_kn", r.getTractiveEffortKn());
        putIfPresent(zones, "engine_rpm", r.getEngineRpm());

        if (r.getCommState() != null) {
            zones.put("comm_state", evaluateEnum(r.getCommState()));
        }

        return zones;
    }

    public static List<NumericRule> numericRules() {
        return NUMERIC_RULES;
    }

    public static EnumRule commStateRule() {
        return COMM_STATE_RULE;
    }

    public static int weightOf(String param) {
        for (NumericRule nr : NUMERIC_RULES) {
            if (nr.param().equals(param)) return nr.weight();
        }
        if (COMM_STATE_RULE.param().equals(param)) return COMM_STATE_RULE.weight();
        return 0;
    }

    private void putIfPresent(Map<String, Zone> zones, String param, Float value) {
        if (value == null) return;
        NumericRule rule = findNumeric(param);
        if (rule == null) return;
        zones.put(param, evaluateNumeric(value, rule));
    }

    private NumericRule findNumeric(String param) {
        for (NumericRule r : NUMERIC_RULES) {
            if (r.param().equals(param)) return r;
        }
        return null;
    }

    private Zone evaluateNumeric(float value, NumericRule rule) {
        if (rule.direction() == Direction.HIGH_BAD) {
            if (value >= rule.redThreshold()) return Zone.RED;
            if (value >= rule.yellowThreshold()) return Zone.YELLOW;
            return Zone.GREEN;
        } else {
            if (value <= rule.redThreshold()) return Zone.RED;
            if (value <= rule.yellowThreshold()) return Zone.YELLOW;
            return Zone.GREEN;
        }
    }

    private Zone evaluateEnum(String value) {
        if (value == null) return Zone.GREEN;
        String lower = value.toLowerCase();
        if (COMM_STATE_RULE.redValues().contains(lower)) return Zone.RED;
        if (COMM_STATE_RULE.yellowValues().contains(lower)) return Zone.YELLOW;
        return Zone.GREEN;
    }
}
