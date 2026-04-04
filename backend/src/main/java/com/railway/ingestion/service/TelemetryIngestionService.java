package com.railway.ingestion.service;

import com.railway.alert.AlertEngine;
import com.railway.alert.model.Alert;
import com.railway.health.HealthEngine;
import com.railway.health.ParameterZoneService;
import com.railway.health.ParameterZoneService.Zone;
import com.railway.health.dto.HealthResult;
import com.railway.ingestion.dto.IngestionAckResponse;
import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.ingestion.port.TelemetryRawPersistencePort;
import com.railway.state.model.TrainLiveState;
import com.railway.state.store.TrainLiveStateStore;
import com.railway.websocket.dto.AlertWsMessage;
import com.railway.websocket.dto.TelemetryPointWsMessage;
import com.railway.websocket.dto.TrainStateWsMessage;
import com.railway.websocket.mapper.TrainWsMapper;
import com.railway.websocket.port.TrainUpdatesPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TelemetryIngestionService {

    private final TelemetryRawPersistencePort telemetryRawPersistencePort;
    private final TrainLiveStateStore trainLiveStateStore;
    private final TrainWsMapper trainWsMapper;
    private final TrainUpdatesPublisher trainUpdatesPublisher;
    private final ParameterZoneService parameterZoneService;
    private final HealthEngine healthEngine;
    private final AlertEngine alertEngine;

    public IngestionAckResponse ingest(TelemetryRawRequest request) {
        Map<String, Zone> zones = parameterZoneService.evaluate(request);
        HealthResult healthResult = healthEngine.computeFromZones(zones);

        int healthIndex = healthResult.getHealth();
        String healthStatus = healthResult.getStatus().name();

        Map<String, String> zoneStrings = new LinkedHashMap<>();
        for (Map.Entry<String, Zone> e : zones.entrySet()) {
            zoneStrings.put(e.getKey(), e.getValue().name().toLowerCase());
        }

        boolean inserted = telemetryRawPersistencePort.insert(request, healthIndex);

        if (inserted) {
            TrainLiveState liveState = trainLiveStateStore.upsert(
                    request, healthIndex, healthStatus, zoneStrings);

            TrainStateWsMessage stateMessage = trainWsMapper.toStateMessage(liveState);
            trainUpdatesPublisher.publishTrainState(request.getLocomotiveId(), stateMessage);

            if (request.getSpeedKph() != null) {
                TelemetryPointWsMessage speedPoint = trainWsMapper.toTelemetryPoint(
                        liveState, "speedKph", request.getSpeedKph().doubleValue());
                trainUpdatesPublisher.publishTelemetryPoint(request.getLocomotiveId(), speedPoint);
            }

            if (request.getEngineTempC() != null) {
                TelemetryPointWsMessage engineTempPoint = trainWsMapper.toTelemetryPoint(
                        liveState, "engineTempC", request.getEngineTempC().doubleValue());
                trainUpdatesPublisher.publishTelemetryPoint(request.getLocomotiveId(), engineTempPoint);
            }

            List<Alert> alerts = alertEngine.evaluate(zones, request);
            for (Alert alert : alerts) {
                AlertWsMessage alertMsg = AlertWsMessage.builder()
                        .locomotiveId(alert.getLocomotiveId())
                        .trainId(request.getTrainId())
                        .code(alert.getCode())
                        .severity(alert.getSeverity().name())
                        .title(alert.getTitle())
                        .message(alert.getSuggestedAction())
                        .ts(alert.getTs())
                        .build();
                trainUpdatesPublisher.publishAlert(request.getLocomotiveId(), alertMsg);
            }
        }

        return IngestionAckResponse.builder()
                .status(inserted ? "accepted" : "duplicate")
                .locomotiveId(request.getLocomotiveId())
                .seq(request.getSeq())
                .receivedAt(Instant.now())
                .build();
    }
}
