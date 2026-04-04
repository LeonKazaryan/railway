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

        // Push current train state snapshot to WS
        TrainStateWsMessage stateMsg = TrainStateWsMessage.builder()
                .locomotiveId(request.getLocomotiveId())
                .seq(request.getSeq())
                .ts(ts)
                .lat(request.getLat())
                .lon(request.getLon())
                .speedKph(request.getSpeedKph())
                .headingDeg(request.getHeadingDeg())
                .motorTempC(request.getMotorTempC())
                .brakePressureKpa(request.getBrakePressureKpa())
                .fuelLevelPct(request.getFuelLevelPct())
                .energyLevelPct(request.getEnergyLevelPct())
                .healthIndex(null) // will be set when health engine is integrated
                .healthStatus(null)
                .commState(request.getCommState() == null ? null : request.getCommState().name())
                .alarmStatus(request.getAlarmStatus() == null ? null : request.getAlarmStatus().name())
                .faultCodes(request.getFaultCodes())
                .build();

        publisher.publishTrainState(request.getLocomotiveId(), stateMsg);

        // Example metric point (speed) for charts
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
