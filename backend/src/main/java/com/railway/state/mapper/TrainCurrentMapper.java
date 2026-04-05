package com.railway.state.mapper;

import com.railway.state.dto.TrainCurrentResponse;
import com.railway.state.model.TrainLiveState;
import org.springframework.stereotype.Component;

@Component
public class TrainCurrentMapper {

    public TrainCurrentResponse toResponse(TrainLiveState state) {
        if (state == null) {
            return null;
        }

        return TrainCurrentResponse.builder()
                .locomotiveId(state.getLocomotiveId())
                .seq(state.getSeq())
                .ts(state.getTs())
                .serialNumber(state.getSerialNumber())
                .trainId(state.getTrainId())
                .lineId(state.getLineId())
                .lineName(state.getLineName())
                .lat(state.getLat())
                .lon(state.getLon())
                .altM(state.getAltM())
                .speedKph(state.getSpeedKph())
                .headingDeg(state.getHeadingDeg())
                .brakePipePressureKpa(state.getBrakePipePressureKpa())
                .brakeStatus(state.getBrakeStatus())
                .batteryVoltageV(state.getBatteryVoltageV())
                .currentA(state.getCurrentA())
                .engineRpm(state.getEngineRpm())
                .engineTempC(state.getEngineTempC())
                .fuelLevelPct(state.getFuelLevelPct())
                .eabStatus(state.getEabStatus())
                .commState(state.getCommState())
                .alarmStatus(state.getAlarmStatus())
                .healthIndex(state.getHealthIndex())
                .healthStatus(state.getHealthStatus())
                .faultCodes(state.getFaultCodes())
                .currentMode(state.getCurrentMode())
                .build();
    }
}
