package com.railway.history;

import com.railway.alert.model.Alert;
import com.railway.history.model.TelemetryRecord;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
public class InMemoryHistoryStore {

    private static final Duration DEFAULT_RETENTION = Duration.ofMinutes(60);

    private final Map<UUID, Deque<TelemetryRecord>> byTrain = new ConcurrentHashMap<>();

    public void append(UUID trainId, TelemetryRecord record) {
        var dq = byTrain.computeIfAbsent(trainId, id -> new ArrayDeque<>());
        dq.addLast(record);
        trimRetention(dq);
    }

    private void trimRetention(Deque<TelemetryRecord> dq) {
        Instant cutoff = Instant.now().minus(DEFAULT_RETENTION);
        while (!dq.isEmpty() && dq.peekFirst().getTs().isBefore(cutoff)) {
            dq.removeFirst();
        }
        // also prevent unbounded size
        while (dq.size() > 10000) {
            dq.removeFirst();
        }
    }

    public List<TelemetryRecord> window(UUID trainId, Instant from, Instant to) {
        var dq = byTrain.get(trainId);
        if (dq == null) return List.of();
        return dq.stream()
                .filter(r -> !r.getTs().isBefore(from) && !r.getTs().isAfter(to))
                .collect(Collectors.toList());
    }

    public List<Alert> alertsWindow(UUID trainId, Instant from, Instant to) {
        return window(trainId, from, to).stream()
                .flatMap(r -> r.getAlerts() == null ? java.util.stream.Stream.empty() : r.getAlerts().stream())
                .collect(Collectors.toList());
    }

    public TelemetryRecord last(UUID trainId) {
        var dq = byTrain.get(trainId);
        if (dq == null || dq.isEmpty()) return null;
        return dq.peekLast();
    }

    public Map<UUID, TelemetryRecord> lastAll() {
        Map<UUID, TelemetryRecord> out = new ConcurrentHashMap<>();
        byTrain.forEach((id, dq) -> {
            if (!dq.isEmpty()) out.put(id, dq.peekLast());
        });
        return out;
    }
}
