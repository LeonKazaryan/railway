package com.railway.websocket.port;

import com.railway.websocket.dto.AlertWsMessage;
import com.railway.websocket.dto.TelemetryPointWsMessage;
import com.railway.websocket.dto.TrainStateWsMessage;

import java.util.UUID;

public interface TrainUpdatesPublisher {
    void publishTrainState(UUID trainId, TrainStateWsMessage message);
    void publishTelemetryPoint(UUID trainId, TelemetryPointWsMessage message);
    void publishAlert(UUID trainId, AlertWsMessage message);
}
