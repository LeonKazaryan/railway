package com.railway.ingestion.dto;

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

    private String serialNumber;
    private String trainId;
    private String lineId;
    private String lineName;
    private UUID trainRunId;
    private String routeId;
    private UUID geofenceId;
    private List<String> activeGeofences = new ArrayList<>();

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

    private Float brakePipePressureKpa;
    private Float mainReservoirPressureKpa;
    private Float brakeCylinderPressureKpa;
    private Float brakePipeLeakKpaPerMin;
    private String brakeStatus;

    private Float batteryVoltageV;
    private Float tractionVoltageV;
    private Float currentA;

    private Float engineRpm;
    private Float engineTempC;
    private Float oilTempC;

    @DecimalMin("0.0")
    @DecimalMax("100.0")
    private Float fuelLevelPct;

    private Float fuelConsumptionRateLph;

    private Float tractiveEffortKn;
    private Float dynamicBrakeForceKn;

    private Float alerterTimerSec;
    private Boolean pcsOpen;
    private String eabStatus;
    private String commState;

    private String alarmStatus;
    private List<String> faultCodes = new ArrayList<>();
    private Integer healthIndex;

    private Map<String, Object> driverState = new HashMap<>();
    private Float weatherFactor;
    private Float trackGradePct;
    private String currentMode;

    private List<List<Double>> routePathCoordinates;
}
