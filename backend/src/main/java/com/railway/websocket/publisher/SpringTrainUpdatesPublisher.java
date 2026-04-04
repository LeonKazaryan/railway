package com.railway.websocket.publisher;

import com.railway.common.ws.WsTopics;
import com.railway.websocket.dto.AlertWsMessage;
import com.railway.websocket.dto.TelemetryPointWsMessage;
import com.railway.websocket.dto.TrainStateWsMessage;
import com.railway.websocket.port.TrainUpdatesPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class SpringTrainUpdatesPublisher implements TrainUpdatesPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public void publishTrainState(UUID trainId, TrainStateWsMessage message) {
        messagingTemplate.convertAndSend(WsTopics.trainState(trainId), message);
        messagingTemplate.convertAndSend(WsTopics.FLEET_STATE, message);
    }

    @Override
    public void publishTelemetryPoint(UUID trainId, TelemetryPointWsMessage message) {
        messagingTemplate.convertAndSend(WsTopics.trainTelemetry(trainId), message);
    }

    @Override
    public void publishAlert(UUID trainId, AlertWsMessage message) {
        messagingTemplate.convertAndSend(WsTopics.trainAlerts(trainId), message);
    }
}