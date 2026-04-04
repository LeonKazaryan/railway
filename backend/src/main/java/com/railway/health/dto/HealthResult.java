package com.railway.health.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class HealthResult {
    private int health; // 0..100
    private HealthStatus status;
    private List<HealthFactor> topFactors;
    private String reason;
}
