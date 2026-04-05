package com.railway.ingestion.port;

import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.ingestion.dto.TelemetryRawResponse;

import java.time.Instant;
import java.util.List;

public interface TelemetryRawPersistencePort {
    boolean insert(TelemetryRawRequest request, Integer healthIndex);

    List<TelemetryRawResponse> findRecent(Instant from);

    List<TelemetryRawResponse> findRecentByTrainId(String trainId, Instant from);
}
