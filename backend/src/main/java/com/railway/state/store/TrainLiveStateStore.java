package com.railway.state.store;

import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.state.model.TrainLiveState;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
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
                    .serialNumber(request.getSerialNumber())
                    .trainId(request.getTrainId())
                    .lineId(request.getLineId())
                    .lineName(request.getLineName())
                    .lat(request.getLat())
                    .lon(request.getLon())
                    .altM(request.getAltM())
                    .speedKph(request.getSpeedKph())
                    .headingDeg(request.getHeadingDeg())
                    .brakePipePressureKpa(request.getBrakePipePressureKpa())
                    .mainReservoirPressureKpa(request.getMainReservoirPressureKpa())
                    .brakeCylinderPressureKpa(request.getBrakeCylinderPressureKpa())
                    .brakePipeLeakKpaPerMin(request.getBrakePipeLeakKpaPerMin())
                    .brakeStatus(request.getBrakeStatus())
                    .batteryVoltageV(request.getBatteryVoltageV())
                    .tractionVoltageV(request.getTractionVoltageV())
                    .currentA(request.getCurrentA())
                    .engineRpm(request.getEngineRpm())
                    .engineTempC(request.getEngineTempC())
                    .oilTempC(request.getOilTempC())
                    .fuelLevelPct(request.getFuelLevelPct())
                    .fuelConsumptionRateLph(request.getFuelConsumptionRateLph())
                    .tractiveEffortKn(request.getTractiveEffortKn())
                    .dynamicBrakeForceKn(request.getDynamicBrakeForceKn())
                    .alerterTimerSec(request.getAlerterTimerSec())
                    .pcsOpen(request.getPcsOpen())
                    .eabStatus(request.getEabStatus())
                    .commState(request.getCommState())
                    .alarmStatus(request.getAlarmStatus())
                    .healthIndex(request.getHealthIndex() != null ? request.getHealthIndex() : healthIndex)
                    .healthStatus(healthStatus)
                    .faultCodes(request.getFaultCodes() == null ? List.of() : request.getFaultCodes())
                    .currentMode(request.getCurrentMode())
                    .build();
        });
    }

    public TrainLiveState get(UUID locomotiveId) {
        return store.get(locomotiveId);
    }

    public List<TrainLiveState> all() {
        return new ArrayList<>(store.values());
    }
}
