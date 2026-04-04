package com.railway.state.model;

import com.railway.alert.model.Alert;
import com.railway.health.dto.HealthStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TrainState {
    private UUID id;
    private String locomotiveType; // optional/unknown for now
    private Double lat;
    private Double lon;
    private Float speedKph;
    private Float routeProgress; // placeholder
    private int healthIndex;
    private HealthStatus status;
    private String topIssue;
    private Instant lastPacketTime;
    private boolean online;
    private List<Alert> openAlerts;
    private String severity; // derived from health/alerts for quick map coloring
}
