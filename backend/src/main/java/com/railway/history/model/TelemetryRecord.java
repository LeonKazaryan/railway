package com.railway.history.model;

import com.railway.alert.model.Alert;
import com.railway.health.dto.HealthResult;
import com.railway.normalization.dto.NormalizedTelemetry;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class TelemetryRecord {
    private NormalizedTelemetry telemetry;
    private HealthResult health;
    private List<Alert> alerts;
    private Instant ts;
}
