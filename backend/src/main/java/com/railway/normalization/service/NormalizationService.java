package com.railway.normalization.service;

import com.railway.ingestion.dto.TelemetryRawRequest;
import com.railway.normalization.dto.NormalizedTelemetry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class NormalizationService {

    private static class Last {
        long seq = -1L;
        Instant ts = Instant.EPOCH;
        Float speedEma = null;
        Float brakeEma = null;
    }

    private final Map<UUID, Last> lastByTrain = new ConcurrentHashMap<>();

    private static final float ALPHA = 0.3f;

    public NormalizedTelemetry normalize(TelemetryRawRequest r) {
        var last = lastByTrain.computeIfAbsent(r.getLocomotiveId(), id -> new Last());

        boolean dedup = r.getSeq() != null && r.getSeq().equals(last.seq);
        boolean delayed = r.getTs() != null && r.getTs().isBefore(last.ts);
        boolean stale = false;

        Float speed = clamp(r.getSpeedKph(), 0f, 400f);
        Float brakePipe = clamp(r.getBrakePipePressureKpa(), 0f, 1200f);
        Float engineTemp = clamp(r.getEngineTempC(), -50f, 200f);
        Float batteryVoltage = clamp(r.getBatteryVoltageV(), 0f, 100f);
        Float tractionVoltage = clamp(r.getTractionVoltageV(), 0f, 1500f);
        Float current = clamp(r.getCurrentA(), -5000f, 5000f);
        Float heading = clamp(r.getHeadingDeg(), 0f, 360f);
        Float fuel = clamp(r.getFuelLevelPct(), 0f, 100f);
        Float oilTemp = clamp(r.getOilTempC(), -50f, 200f);
        Float engineRpm = clamp(r.getEngineRpm(), 0f, 1200f);

        Float speedEma = ema(last.speedEma, speed);
        Float brakeEma = ema(last.brakeEma, brakePipe);

        if (!delayed && !dedup) {
            last.seq = r.getSeq() == null ? last.seq : r.getSeq();
            last.ts = r.getTs() == null ? last.ts : r.getTs();
            last.speedEma = speedEma;
            last.brakeEma = brakeEma;
        }

        return NormalizedTelemetry.builder()
                .ts(r.getTs())
                .locomotiveId(r.getLocomotiveId())
                .seq(r.getSeq())
                .serialNumber(r.getSerialNumber())
                .trainId(r.getTrainId())
                .lineId(r.getLineId())
                .lineName(r.getLineName())
                .trainRunId(r.getTrainRunId())
                .routeId(r.getRouteId())
                .geofenceId(r.getGeofenceId())
                .activeGeofences(r.getActiveGeofences())
                .lat(r.getLat())
                .lon(r.getLon())
                .altM(r.getAltM())
                .speedKph(speed)
                .headingDeg(heading)
                .brakePipePressureKpa(brakePipe)
                .mainReservoirPressureKpa(r.getMainReservoirPressureKpa())
                .brakeCylinderPressureKpa(r.getBrakeCylinderPressureKpa())
                .brakePipeLeakKpaPerMin(r.getBrakePipeLeakKpaPerMin())
                .brakeStatus(r.getBrakeStatus())
                .batteryVoltageV(batteryVoltage)
                .tractionVoltageV(tractionVoltage)
                .currentA(current)
                .engineRpm(engineRpm)
                .engineTempC(engineTemp)
                .oilTempC(oilTemp)
                .fuelLevelPct(fuel)
                .fuelConsumptionRateLph(r.getFuelConsumptionRateLph())
                .tractiveEffortKn(r.getTractiveEffortKn())
                .dynamicBrakeForceKn(r.getDynamicBrakeForceKn())
                .alerterTimerSec(r.getAlerterTimerSec())
                .pcsOpen(r.getPcsOpen())
                .eabStatus(r.getEabStatus())
                .commState(r.getCommState())
                .alarmStatus(r.getAlarmStatus())
                .faultCodes(r.getFaultCodes())
                .healthIndex(r.getHealthIndex())
                .driverState(r.getDriverState())
                .weatherFactor(r.getWeatherFactor())
                .trackGradePct(r.getTrackGradePct())
                .currentMode(r.getCurrentMode())
                .deduplicated(dedup)
                .stale(stale)
                .delayed(delayed)
                .speedKphEma(speedEma)
                .brakePipePressureKpaEma(brakeEma)
                .build();
    }

    private Float clamp(Float v, float min, float max) {
        if (v == null) return null;
        if (Float.isNaN(v)) return null;
        return Math.max(min, Math.min(max, v));
    }

    private Float ema(Float prev, Float x) {
        if (x == null) return prev;
        if (prev == null) return x;
        return ALPHA * x + (1 - ALPHA) * prev;
    }
}
