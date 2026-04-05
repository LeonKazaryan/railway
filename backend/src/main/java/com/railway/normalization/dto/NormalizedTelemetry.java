package com.railway.normalization.dto;

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

    private String serialNumber;
    private String trainId;
    private String lineId;
    private String lineName;
    private UUID trainRunId;
    private String routeId;
    private UUID geofenceId;
    private List<String> activeGeofences;

    private Double lat;
    private Double lon;
    private Double altM;

    private Float speedKph;
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

    private Float fuelLevelPct;
    private Float fuelConsumptionRateLph;

    private Float tractiveEffortKn;
    private Float dynamicBrakeForceKn;

    private Float alerterTimerSec;
    private Boolean pcsOpen;
    private String eabStatus;
    private String commState;

    private String alarmStatus;
    private List<String> faultCodes;
    private Integer healthIndex;

    private Map<String, Object> driverState;
    private Float weatherFactor;
    private Float trackGradePct;
    private String currentMode;

    private boolean deduplicated;
    private boolean stale;
    private boolean delayed;

    private Float speedKphEma;
    private Float brakePipePressureKpaEma;
}
