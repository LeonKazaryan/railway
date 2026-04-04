package com.railway.state.mapper;

import com.railway.health.dto.HealthStatus;
import com.railway.state.model.TrainLiveState;
import com.railway.state.model.TrainState;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Component
public class FleetTrainStateMapper {

    private static final Duration ONLINE_THRESHOLD = Duration.ofSeconds(15);

    public TrainState toTrainState(TrainLiveState s) {
        int hi = s.getHealthIndex() != null ? s.getHealthIndex() : 0;
        HealthStatus healthStatus = mapHealthStatus(s, hi);
        String severity = toSeverity(healthStatus);
        boolean online = isOnline(s);
        String topIssue = s.getFaultCodes() != null && !s.getFaultCodes().isEmpty()
                ? s.getFaultCodes().get(0)
                : null;

        return TrainState.builder()
                .id(s.getLocomotiveId())
                .locomotiveType(null)
                .lat(s.getLat())
                .lon(s.getLon())
                .speedKph(s.getSpeedKph())
                .routeProgress(null)
                .healthIndex(hi)
                .status(healthStatus)
                .topIssue(topIssue)
                .lastPacketTime(s.getTs())
                .online(online)
                .openAlerts(List.of())
                .severity(severity)
                .build();
    }

    private HealthStatus mapHealthStatus(TrainLiveState s, int hi) {
        String hs = s.getHealthStatus();
        if (hs != null) {
            if (hs.equalsIgnoreCase("critical")) {
                return HealthStatus.CRITICAL;
            }
            if (hs.equalsIgnoreCase("warning")) {
                return HealthStatus.WARNING;
            }
            if (hs.equalsIgnoreCase("normal")) {
                return HealthStatus.NORMAL;
            }
        }
        if (hi < 50) {
            return HealthStatus.CRITICAL;
        }
        if (hi < 75) {
            return HealthStatus.WARNING;
        }
        return HealthStatus.NORMAL;
    }

    private String toSeverity(HealthStatus st) {
        return switch (st) {
            case CRITICAL -> "critical";
            case WARNING -> "warning";
            case NORMAL -> "normal";
        };
    }

    private boolean isOnline(TrainLiveState s) {
        if (s.getCommState() == null || !"online".equalsIgnoreCase(s.getCommState())) {
            return false;
        }
        if (s.getTs() == null) {
            return false;
        }
        return Instant.now().minus(ONLINE_THRESHOLD).isBefore(s.getTs());
    }
}
