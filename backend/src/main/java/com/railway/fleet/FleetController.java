package com.railway.fleet;

import com.railway.health.dto.HealthStatus;
import com.railway.state.LiveStateAggregatorService;
import com.railway.state.model.TrainState;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/fleet")
@RequiredArgsConstructor
public class FleetController {

    private final LiveStateAggregatorService aggregator;

    @GetMapping("/trains")
    public List<TrainState> trains() {
        return aggregator.all();
    }

    @GetMapping("/summary")
    public FleetSummary summary() {
        var all = aggregator.all();
        FleetSummary s = new FleetSummary();
        s.total = all.size();
        s.online = (int) all.stream().filter(TrainState::isOnline).count();
        s.offline = s.total - s.online;
        s.critical = (int) all.stream().filter(t -> t.getStatus() == HealthStatus.CRITICAL || "critical".equals(t.getSeverity())).count();
        s.warning = (int) all.stream().filter(t -> t.getStatus() == HealthStatus.WARNING || "warning".equals(t.getSeverity())).count();
        return s;
    }

    @Data
    static class FleetSummary {
        private int total;
        private int online;
        private int offline;
        private int warning;
        private int critical;
    }
}
