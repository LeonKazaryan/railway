package com.railway.state;

import com.railway.alert.model.Alert;
import com.railway.alert.model.Severity;
import com.railway.health.dto.HealthResult;
import com.railway.health.dto.HealthStatus;
import com.railway.normalization.dto.NormalizedTelemetry;
import com.railway.state.model.TrainState;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class LiveStateAggregatorService {

    private static final Duration ONLINE_THRESHOLD = Duration.ofSeconds(15);

    private final Map<UUID, TrainState> stateById = new ConcurrentHashMap<>();

    public void update(NormalizedTelemetry t, HealthResult h, List<Alert> alerts) {
        if (t.getLocomotiveId() == null) return;
        UUID id = t.getLocomotiveId();
        Instant ts = t.getTs() != null ? t.getTs() : Instant.now();

        String severity = deriveSeverity(h, alerts);
        String topIssue = h.getTopFactors() != null && !h.getTopFactors().isEmpty()
                ? h.getTopFactors().get(0).getName() : null;

        boolean online = t.getCommState() != null && t.getCommState().name().equals("ONLINE")
                && Instant.now().minus(ONLINE_THRESHOLD).isBefore(ts);

        TrainState snapshot = TrainState.builder()
                .id(id)
                .locomotiveType(null)
                .lat(t.getLat())
                .lon(t.getLon())
                .speedKph(t.getSpeedKphEma() != null ? t.getSpeedKphEma() : t.getSpeedKph())
                .routeProgress(null)
                .healthIndex(h.getHealth())
                .status(h.getStatus())
                .topIssue(topIssue)
                .lastPacketTime(ts)
                .online(online)
                .openAlerts(alerts == null ? List.of() : new ArrayList<>(alerts))
                .severity(severity)
                .build();

        stateById.put(id, snapshot);
    }

    private String deriveSeverity(HealthResult h, List<Alert> alerts) {
        if (h.getStatus() == HealthStatus.CRITICAL) return "critical";
        if (alerts != null && alerts.stream().anyMatch(a -> a.getSeverity() == Severity.CRITICAL)) return "critical";
        if (h.getStatus() == HealthStatus.WARNING) return "warning";
        if (alerts != null && !alerts.isEmpty()) return "warning";
        return "normal";
    }

    public TrainState current(UUID id) {
        return stateById.get(id);
    }

    public List<TrainState> all() {
        return new ArrayList<>(stateById.values());
    }
}
