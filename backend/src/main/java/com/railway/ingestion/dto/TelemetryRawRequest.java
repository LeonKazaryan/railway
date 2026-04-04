package com.railway.ingestion.dto;

import com.railway.ingestion.enumtype.AlarmStatus;
import com.railway.ingestion.enumtype.CommState;
import com.railway.ingestion.enumtype.DoorsState;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
public class TelemetryRawRequest {

    @NotNull
    private Instant ts;

    @NotNull
    private UUID locomotiveId;

    @NotNull
    @PositiveOrZero
    private Long seq;

    @NotNull
    @DecimalMin("-90.0")
    @DecimalMax("90.0")
    private Double lat;

    @NotNull
    @DecimalMin("-180.0")
    @DecimalMax("180.0")
    private Double lon;

    private Double altM;

    @NotNull
    @PositiveOrZero
    private Float speedKph;

    @DecimalMin("0.0")
    @DecimalMax("360.0")
    private Float headingDeg;

    private Float voltageV;
    private Float currentA;
    private Float motorTempC;
    private Float brakePressureKpa;

    @DecimalMin("0.0")
    @DecimalMax("100.0")
    private Float fuelLevelPct;

    @DecimalMin("0.0")
    @DecimalMax("100.0")
    private Float energyLevelPct;

    @NotNull
    private DoorsState doorsState;

    @NotNull
    private AlarmStatus alarmStatus;

    @NotNull
    private CommState commState;

    private UUID routeId;
    private UUID geofenceId;

    private List<String> faultCodes = new ArrayList<>();

    private Map<String, Object> driverState = new HashMap<>();
    private UUID trainRunId;
}