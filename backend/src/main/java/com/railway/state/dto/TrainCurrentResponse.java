package com.railway.state.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TrainCurrentResponse {
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
    private String brakeStatus;

    private Float batteryVoltageV;
    private Float currentA;

    private Float engineRpm;
    private Float engineTempC;

    private Float fuelLevelPct;

    private String eabStatus;
    private String commState;

    private String alarmStatus;
    private Integer healthIndex;
    private String healthStatus;
    private List<String> faultCodes;

    private String currentMode;
}
