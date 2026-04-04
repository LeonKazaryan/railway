package com.railway.health.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class HealthFactor {
    private String name;
    private int impact; // negative values reduce health
}
