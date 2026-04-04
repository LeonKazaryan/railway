package com.railway.normalization.dto;

import com.railway.ingestion.enumtype.AlarmStatus;
import com.railway.ingestion.enumtype.CommState;
import com.railway.ingestion.enumtype.DoorsState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NormalizedTelemetry {
    private Instant ts;
    private UUID locomotiveId;
    private Long seq;

    private Double lat;
    private Double lon;
    private Double altM;

    private Float speedKph;
    private Float headingDeg;

    private Float voltageV;
    private Float currentA;
    private Float motorTempC;
    private Float brakePressureKpa;

    private Float fuelLevelPct;
    private Float energyLevelPct;

    private DoorsState doorsState;
    private AlarmStatus alarmStatus;
    private CommState commState;

    private UUID routeId;
    private UUID geofenceId;

    private List<String> faultCodes;
    private Map<String, Object> driverState;

    // Normalization flags
    private boolean deduplicated;
    private boolean stale;
    private boolean delayed;

    // Smoothed values (EMA)
    private Float speedKphEma;
    private Float brakePressureKpaEma;
}
