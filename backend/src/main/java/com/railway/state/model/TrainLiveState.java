package com.railway.state.model;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TrainLiveState {
    private UUID locomotiveId;
    private Long seq;
    private Instant ts;

    private String serialNumber;
    private String trainId;
    private String lineId;
    private String lineName;

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
    private Integer healthIndex;
    private String healthStatus;
    private List<String> faultCodes;

    private String currentMode;
}
