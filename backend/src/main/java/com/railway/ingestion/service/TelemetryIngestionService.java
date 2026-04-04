package com.railway.ingestion.service;

import com.railway.ingestion.dto.IngestionAckResponse;
import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.ingestion.port.TelemetryRawPersistencePort;
import com.railway.state.model.TrainLiveState;
import com.railway.state.store.TrainLiveStateStore;
import com.railway.websocket.dto.TelemetryPointWsMessage;
import com.railway.websocket.dto.TrainStateWsMessage;
import com.railway.websocket.mapper.TrainWsMapper;
import com.railway.websocket.port.TrainUpdatesPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class TelemetryIngestionService {

    private final TelemetryRawPersistencePort telemetryRawPersistencePort;
    private final TrainLiveStateStore trainLiveStateStore;
    private final TrainWsMapper trainWsMapper;
    private final TrainUpdatesPublisher trainUpdatesPublisher;

    public IngestionAckResponse ingest(TelemetryRawRequest request) {
        Integer healthIndex = request.getHealthIndex();
        String healthStatus = null;

        boolean inserted = telemetryRawPersistencePort.insert(request, healthIndex);

        if (inserted) {
            TrainLiveState liveState = trainLiveStateStore.upsert(request, healthIndex, healthStatus);

            TrainStateWsMessage stateMessage = trainWsMapper.toStateMessage(liveState);
            trainUpdatesPublisher.publishTrainState(request.getLocomotiveId(), stateMessage);

            if (request.getSpeedKph() != null) {
                TelemetryPointWsMessage speedPoint = trainWsMapper.toTelemetryPoint(
                        liveState,
                        "speedKph",
                        request.getSpeedKph().doubleValue()
                );
                trainUpdatesPublisher.publishTelemetryPoint(request.getLocomotiveId(), speedPoint);
            }

            if (request.getEngineTempC() != null) {
                TelemetryPointWsMessage engineTempPoint = trainWsMapper.toTelemetryPoint(
                        liveState,
                        "engineTempC",
                        request.getEngineTempC().doubleValue()
                );
                trainUpdatesPublisher.publishTelemetryPoint(request.getLocomotiveId(), engineTempPoint);
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
