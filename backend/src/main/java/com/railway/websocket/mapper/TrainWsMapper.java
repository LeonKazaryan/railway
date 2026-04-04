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
                .mainReservoirPressureKpa(state.getMainReservoirPressureKpa())
                .brakeCylinderPressureKpa(state.getBrakeCylinderPressureKpa())
                .brakePipeLeakKpaPerMin(state.getBrakePipeLeakKpaPerMin())
                .brakeStatus(state.getBrakeStatus())
                .batteryVoltageV(state.getBatteryVoltageV())
                .tractionVoltageV(state.getTractionVoltageV())
                .currentA(state.getCurrentA())
                .engineRpm(state.getEngineRpm())
                .engineTempC(state.getEngineTempC())
                .oilTempC(state.getOilTempC())
                .fuelLevelPct(state.getFuelLevelPct())
                .fuelConsumptionRateLph(state.getFuelConsumptionRateLph())
                .tractiveEffortKn(state.getTractiveEffortKn())
                .dynamicBrakeForceKn(state.getDynamicBrakeForceKn())
                .alerterTimerSec(state.getAlerterTimerSec())
                .pcsOpen(state.getPcsOpen())
                .eabStatus(state.getEabStatus())
                .commState(state.getCommState())
                .alarmStatus(state.getAlarmStatus())
                .healthIndex(state.getHealthIndex())
                .healthStatus(state.getHealthStatus())
                .faultCodes(state.getFaultCodes())
                .currentMode(state.getCurrentMode())
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
