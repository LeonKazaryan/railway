package com.railway.websocket.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class StreamStatusWsMessage {
    private String status;
    private String source;
    private Instant ts;
}