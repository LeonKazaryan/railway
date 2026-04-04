package com.railway.ingestion.aop;

import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.websocket.dto.TelemetryPointWsMessage;
import com.railway.websocket.dto.TrainStateWsMessage;
import com.railway.websocket.port.TrainUpdatesPublisher;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Aspect
@Component
@RequiredArgsConstructor
public class TelemetryIngestPushAspect {

    private final TrainUpdatesPublisher publisher;

    @AfterReturning(
            pointcut = "execution(* com.railway.ingestion.service.TelemetryIngestionService.ingest(..)) && args(request)",
            returning = "ack")
    public void pushAfterIngest(TelemetryRawRequest request, Object ack) {
        if (request == null || request.getLocomotiveId() == null) {
            return;
        }

        Instant ts = request.getTs() != null ? request.getTs() : Instant.now();

        TrainStateWsMessage stateMsg = TrainStateWsMessage.builder()
                .locomotiveId(request.getLocomotiveId())
                .seq(request.getSeq())
                .ts(ts)
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
                .healthIndex(request.getHealthIndex())
                .healthStatus(null)
                .faultCodes(request.getFaultCodes())
                .currentMode(request.getCurrentMode())
                .build();

        publisher.publishTrainState(request.getLocomotiveId(), stateMsg);

        if (request.getSpeedKph() != null) {
            TelemetryPointWsMessage point = TelemetryPointWsMessage.builder()
                    .locomotiveId(request.getLocomotiveId())
                    .ts(ts)
                    .metric("speed_kph")
                    .value(request.getSpeedKph().doubleValue())
                    .build();
            publisher.publishTelemetryPoint(request.getLocomotiveId(), point);
        }
    }
}
