package com.railway.ingestion.persistence.jdbc;

import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.ingestion.port.TelemetryRawPersistencePort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcTelemetryRawRepository implements TelemetryRawPersistencePort {

    @Override
    public boolean insert(TelemetryRawRequest request, Integer healthIndex) {
        return true;
    }
}
