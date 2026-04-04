package com.railway.websocket.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TrainStateWsMessage {
    private UUID locomotiveId;
    private Long seq;
    private Instant ts;
    private Double lat;
    private Double lon;
    private Float speedKph;
    private Float headingDeg;
    private Float motorTempC;
    private Float brakePressureKpa;
    private Float fuelLevelPct;
    private Float energyLevelPct;
    private Integer healthIndex;
    private String healthStatus;
    private String commState;
    private String alarmStatus;
    private List<String> faultCodes;
}