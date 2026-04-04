package com.railway.common.ws;

import java.util.UUID;

public final class WsTopics {

    private WsTopics() {
    }

    public static final String STREAM_STATUS = "/topic/stream-status";
    public static final String FLEET_STATE = "/topic/fleet";
    public static final String FLEET_ALERTS = "/topic/fleet-alerts";

    public static String trainState(UUID trainId) {
        return "/topic/train/" + trainId + "/state";
    }

    public static String trainTelemetry(UUID trainId) {
        return "/topic/train/" + trainId + "/telemetry";
    }

    public static String trainAlerts(UUID trainId) {
        return "/topic/train/" + trainId + "/alerts";
    }
}