package com.railway.health;

import com.railway.health.ParameterZoneService.Zone;
import com.railway.health.dto.HealthFactor;
import com.railway.health.dto.HealthResult;
import com.railway.health.dto.HealthStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class HealthEngine {

    private static final int RED_CAP = 35;

    private static final int ZONE_SCORE_GREEN  = 100;
    private static final int ZONE_SCORE_YELLOW = 50;
    private static final int ZONE_SCORE_RED    = 0;

    public HealthResult computeFromZones(Map<String, Zone> zones) {
        if (zones.isEmpty()) {
            return HealthResult.builder()
                    .health(100)
                    .status(HealthStatus.NORMAL)
                    .topFactors(List.of())
                    .reason("No parameters available for evaluation")
                    .build();
        }

        long totalWeight = 0;
        long weightedSum = 0;
        boolean anyRed = false;
        List<HealthFactor> factors = new ArrayList<>();

        for (Map.Entry<String, Zone> entry : zones.entrySet()) {
            String param = entry.getKey();
            Zone zone = entry.getValue();
            int weight = ParameterZoneService.weightOf(param);
            if (weight == 0) continue;

            int score = zoneScore(zone);
            totalWeight += weight;
            weightedSum += (long) score * weight;

            if (zone == Zone.RED) {
                anyRed = true;
                factors.add(new HealthFactor(param, -(100 - score) * weight / 100));
            } else if (zone == Zone.YELLOW) {
                factors.add(new HealthFactor(param, -(100 - score) * weight / 100));
            }
        }

        int hp = totalWeight > 0 ? (int) (weightedSum / totalWeight) : 100;

        if (anyRed) {
            hp = Math.min(hp, RED_CAP);
        }

        hp = Math.max(0, Math.min(100, hp));

        factors.sort(Comparator.comparingInt(HealthFactor::getImpact));
        List<HealthFactor> top = factors.size() > 5 ? factors.subList(0, 5) : factors;

        HealthStatus status = hp > 90 ? HealthStatus.NORMAL
                : hp >= 70 ? HealthStatus.WARNING
                : HealthStatus.CRITICAL;

        return HealthResult.builder()
                .health(hp)
                .status(status)
                .topFactors(new ArrayList<>(top))
                .reason(buildReason(top))
                .build();
    }

    private int zoneScore(Zone zone) {
        return switch (zone) {
            case GREEN -> ZONE_SCORE_GREEN;
            case YELLOW -> ZONE_SCORE_YELLOW;
            case RED -> ZONE_SCORE_RED;
        };
    }

    private String buildReason(List<HealthFactor> factors) {
        if (factors.isEmpty()) return "All key parameters within nominal ranges";
        StringBuilder sb = new StringBuilder("Top factors: ");
        for (int i = 0; i < factors.size(); i++) {
            var f = factors.get(i);
            sb.append(f.getName()).append(" (").append(f.getImpact()).append(")");
            if (i < factors.size() - 1) sb.append(", ");
        }
        return sb.toString();
    }
}
