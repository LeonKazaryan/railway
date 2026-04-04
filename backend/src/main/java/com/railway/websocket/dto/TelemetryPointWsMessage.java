package com.railway.websocket.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class TelemetryPointWsMessage {
    private UUID locomotiveId;
    private Instant ts;
    private String metric;
    private Double value;
}