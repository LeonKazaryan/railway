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

    // EMA alpha for smoothing noisy signals
    private static final float ALPHA = 0.3f;

    public NormalizedTelemetry normalize(TelemetryRawRequest r) {
        var last = lastByTrain.computeIfAbsent(r.getLocomotiveId(), id -> new Last());

        boolean dedup = r.getSeq() != null && r.getSeq().equals(last.seq);
        boolean delayed = r.getTs() != null && r.getTs().isBefore(last.ts);
        boolean stale = false; // can be set by external policy (e.g., no update for > N sec)

        Float speed = clamp(r.getSpeedKph(), 0f, 400f);
        Float brake = clamp(r.getBrakePressureKpa(), 0f, 1000f);
        Float motorTemp = clamp(r.getMotorTempC(), -50f, 200f);
        Float voltage = clamp(r.getVoltageV(), 0f, 1000f);
        Float current = clamp(r.getCurrentA(), -5000f, 5000f);
        Float heading = clamp(r.getHeadingDeg(), 0f, 360f);
        Float fuel = clamp(r.getFuelLevelPct(), 0f, 100f);
        Float energy = clamp(r.getEnergyLevelPct(), 0f, 100f);

        Float speedEma = ema(last.speedEma, speed);
        Float brakeEma = ema(last.brakeEma, brake);

        // Update last only for non-delayed and non-dedup packets
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
                .lat(r.getLat())
                .lon(r.getLon())
                .altM(r.getAltM())
                .speedKph(speed)
                .headingDeg(heading)
                .voltageV(voltage)
                .currentA(current)
                .motorTempC(motorTemp)
                .brakePressureKpa(brake)
                .fuelLevelPct(fuel)
                .energyLevelPct(energy)
                .doorsState(r.getDoorsState())
                .alarmStatus(r.getAlarmStatus())
                .commState(r.getCommState())
                .routeId(r.getRouteId())
                .geofenceId(r.getGeofenceId())
                .faultCodes(r.getFaultCodes())
                .driverState(r.getDriverState())
                .deduplicated(dedup)
                .stale(stale)
                .delayed(delayed)
                .speedKphEma(speedEma)
                .brakePressureKpaEma(brakeEma)
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
