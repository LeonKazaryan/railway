package com.railway.state.store;

import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.state.model.TrainLiveState;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class TrainLiveStateStore {

    private final Map<UUID, TrainLiveState> store = new ConcurrentHashMap<>();

    public TrainLiveState upsert(TelemetryRawRequest request, Integer healthIndex, String healthStatus) {
        return store.compute(request.getLocomotiveId(), (id, current) -> {
            if (current != null && current.getSeq() != null && request.getSeq() <= current.getSeq()) {
                return current;
            }

            return TrainLiveState.builder()
                    .locomotiveId(request.getLocomotiveId())
                    .seq(request.getSeq())
                    .ts(request.getTs())
                    .lat(request.getLat())
                    .lon(request.getLon())
                    .altM(request.getAltM())
                    .speedKph(request.getSpeedKph())
                    .headingDeg(request.getHeadingDeg())
                    .voltageV(request.getVoltageV())
                    .currentA(request.getCurrentA())
                    .motorTempC(request.getMotorTempC())
                    .brakePressureKpa(request.getBrakePressureKpa())
                    .fuelLevelPct(request.getFuelLevelPct())
                    .energyLevelPct(request.getEnergyLevelPct())
                    .healthIndex(healthIndex)
                    .healthStatus(healthStatus)
                    .commState(request.getCommState().name())
                    .alarmStatus(request.getAlarmStatus().name())
                    .faultCodes(request.getFaultCodes() == null ? List.of() : request.getFaultCodes())
                    .build();
        });
    }

    public TrainLiveState get(UUID locomotiveId) {
        return store.get(locomotiveId);
    }
}
