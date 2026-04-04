package com.railway.monitoring;

import com.railway.state.LiveStateAggregatorService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/")
@RequiredArgsConstructor
public class MonitoringController {

    private final LiveStateAggregatorService aggregator;

    @GetMapping("/health")
    public HealthRes health() {
        HealthRes h = new HealthRes();
        h.status = "UP";
        h.now = Instant.now().toString();
        h.trains = aggregator.all().size();
        return h;
    }

    @GetMapping("/metrics")
    public MetricsRes metrics() {
        MetricsRes m = new MetricsRes();
        m.now = Instant.now().toString();
        m.trains = aggregator.all().size();
        // Placeholder for event rate and stream status (to be filled when wiring ingestion)
        m.streamConnected = true;
        m.currentEventRate = 0.0;
        return m;
    }

    @Data
    static class HealthRes {
        private String status;
        private String now;
        private int trains;
    }

    @Data
    static class MetricsRes {
        private String now;
        private int trains;
        private boolean streamConnected;
        private double currentEventRate;
    }
}
