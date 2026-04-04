package com.railway.ingestion.port;

import com.railway.ingestion.dto.TelemetryRawRequest;

public interface TelemetryRawPersistencePort {
    boolean insert(TelemetryRawRequest request, Integer healthIndex);
}
