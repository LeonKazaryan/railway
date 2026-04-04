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
                .lat(state.getLat())
                .lon(state.getLon())
                .speedKph(state.getSpeedKph())
                .headingDeg(state.getHeadingDeg())
                .motorTempC(state.getMotorTempC())
                .brakePressureKpa(state.getBrakePressureKpa())
                .fuelLevelPct(state.getFuelLevelPct())
                .energyLevelPct(state.getEnergyLevelPct())
                .healthIndex(state.getHealthIndex())
                .healthStatus(state.getHealthStatus())
                .commState(state.getCommState())
                .alarmStatus(state.getAlarmStatus())
                .faultCodes(state.getFaultCodes())
                .build();
    }
}