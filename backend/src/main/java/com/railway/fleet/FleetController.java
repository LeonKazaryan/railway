package com.railway.fleet;

import com.railway.health.dto.HealthStatus;
import com.railway.state.mapper.FleetTrainStateMapper;
import com.railway.state.model.TrainState;
import com.railway.state.store.TrainLiveStateStore;
import com.railway.websocket.dto.TrainStateWsMessage;
import com.railway.websocket.mapper.TrainWsMapper;
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

    private final TrainLiveStateStore trainLiveStateStore;
    private final TrainWsMapper trainWsMapper;
    private final FleetTrainStateMapper fleetTrainStateMapper;

    @GetMapping("/live-trains")
    public List<TrainStateWsMessage> liveTrains() {
        return trainLiveStateStore.all().stream().map(trainWsMapper::toStateMessage).toList();
    }

    @GetMapping("/trains")
    public List<TrainState> trains() {
        return trainLiveStateStore.all().stream()
                .map(fleetTrainStateMapper::toTrainState)
                .toList();
    }

    @GetMapping("/summary")
    public FleetSummary summary() {
        var all = trainLiveStateStore.all().stream()
                .map(fleetTrainStateMapper::toTrainState)
                .toList();
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
