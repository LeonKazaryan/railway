package com.railway.ingestion.controller;

import com.railway.ingestion.dto.IngestionAckResponse;
import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.ingestion.service.TelemetryIngestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
public class TelemetryRawController {

    private final TelemetryIngestionService telemetryIngestionService;

    @PostMapping("/raw")
    public IngestionAckResponse ingest(@Valid @RequestBody TelemetryRawRequest request) {
        return telemetryIngestionService.ingest(request);
    }
}