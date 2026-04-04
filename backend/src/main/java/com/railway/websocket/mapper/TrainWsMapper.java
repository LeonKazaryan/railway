package com.railway.websocket.mapper;

import com.railway.state.model.TrainLiveState;
import com.railway.websocket.dto.TelemetryPointWsMessage;
import com.railway.websocket.dto.TrainStateWsMessage;
import org.springframework.stereotype.Component;

@Component
public class TrainWsMapper {

    public TrainStateWsMessage toStateMessage(TrainLiveState state) {
        return TrainStateWsMessage.builder()
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

    public TelemetryPointWsMessage toTelemetryPoint(TrainLiveState state, String metric, Double value) {
        return TelemetryPointWsMessage.builder()
                .locomotiveId(state.getLocomotiveId())
                .ts(state.getTs())
                .metric(metric)
                .value(value)
                .build();
    }
}