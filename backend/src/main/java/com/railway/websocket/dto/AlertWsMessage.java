package com.railway.websocket.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class AlertWsMessage {
    private UUID locomotiveId;
    private String trainId;
    private String code;
    private String severity;
    private String title;
    private String message;
    private Instant ts;
}
