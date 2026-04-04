package com.railway.ingestion.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class IngestionAckResponse {
    private String status;
    private UUID locomotiveId;
    private Long seq;
    private Instant receivedAt;
}
