import { useRef, useCallback, useEffect } from "react";
import type { TelemetrySnapshot, TelemetryBuffer } from "../model/types";
import {
  useFleetLiveStore,
  type WsTrainState,
} from "@/features/fleet-live/model/store";

const MAX_HISTORY_AGE_MS = 4 * 60 * 60 * 1000;
const MAX_HISTORY_POINTS = 50000;

function wsToSnapshot(ws: WsTrainState): TelemetrySnapshot {
  return {
    ts: new Date(ws.ts).getTime(),
    lat: ws.lat ?? 0,
    lon: ws.lon ?? 0,
    speed_kph: ws.speedKph ?? 0,
    heading_deg: ws.headingDeg ?? 0,
    engine_temp_c: ws.engineTempC ?? 0,
    oil_temp_c: ws.oilTempC ?? 0,
    oil_pressure_ok: (ws.oilTempC ?? 0) < 90,
    engine_rpm: ws.engineRpm ?? 0,
    fuel_level_pct: ws.fuelLevelPct ?? 0,
    fuel_consumption_rate: ws.fuelConsumptionRateLph ?? 0,
    brake_pipe_pressure_kpa: ws.brakePipePressureKpa ?? 0,
    main_reservoir_pressure_kpa: ws.mainReservoirPressureKpa ?? 0,
    brake_cylinder_pressure_kpa: ws.brakeCylinderPressureKpa ?? 0,
    brake_pipe_leak_kpa_per_min: ws.brakePipeLeakKpaPerMin ?? 0,
    brake_status: ws.brakeStatus ?? "UNKNOWN",
    current_a: ws.currentA ?? 0,
    traction_voltage_v: ws.tractionVoltageV ?? 0,
    battery_voltage_v: ws.batteryVoltageV ?? 0,
    tractive_effort_kn: ws.tractiveEffortKn ?? 0,
    dynamic_brake_force_kn: ws.dynamicBrakeForceKn ?? 0,
    health_index: ws.healthIndex ?? 0,
    fault_codes: ws.faultCodes ?? [],
    alarm_status: ws.alarmStatus === "normal" ? 0 : ws.alarmStatus === "warning" ? 1 : 2,
    fire_temp_c: 20,
    comm_state: ws.commState === "online" ? 1 : 0,
    pcs_open: ws.pcsOpen ?? false,
    alerter_timer_sec: ws.alerterTimerSec ?? 0,
  };
}

const EMPTY_SNAPSHOT: TelemetrySnapshot = {
  ts: Date.now(),
  lat: 0, lon: 0,
  speed_kph: 0, heading_deg: 0,
  engine_temp_c: 0, oil_temp_c: 0, oil_pressure_ok: true,
  engine_rpm: 0, fuel_level_pct: 0, fuel_consumption_rate: 0,
  brake_pipe_pressure_kpa: 0, main_reservoir_pressure_kpa: 0,
  brake_cylinder_pressure_kpa: 0, brake_pipe_leak_kpa_per_min: 0,
  brake_status: "UNKNOWN",
  current_a: 0, traction_voltage_v: 0, battery_voltage_v: 0,
  tractive_effort_kn: 0, dynamic_brake_force_kn: 0,
  health_index: 0, fault_codes: [], alarm_status: 0,
  fire_temp_c: 20, comm_state: 0, pcs_open: false, alerter_timer_sec: 0,
};

export function useLiveTelemetry(trainId: string): TelemetryBuffer {
  const historyRef = useRef<TelemetrySnapshot[]>([]);
  const lastSeqKeyRef = useRef<string>("");
  const lastHistoryTsRef = useRef(0);
  const getHistory = useCallback(() => historyRef.current, []);

  useEffect(() => {
    historyRef.current = [];
    lastSeqKeyRef.current = "";
    lastHistoryTsRef.current = 0;
  }, [trainId]);

  const trains = useFleetLiveStore((s) => s.trains);

  let ws: WsTrainState | undefined;
  for (const [, v] of trains) {
    if (v.trainId === trainId || v.locomotiveId === trainId) {
      ws = v;
      break;
    }
  }

  const snapshot = ws ? wsToSnapshot(ws) : EMPTY_SNAPSHOT;

  const seqKey = ws ? `${ws.locomotiveId}:${ws.seq}` : "";
  if (ws && seqKey !== lastSeqKeyRef.current) {
    lastSeqKeyRef.current = seqKey;
    const wall = Date.now();
    let ts = wall;
    if (ts <= lastHistoryTsRef.current) ts = lastHistoryTsRef.current + 1;
    lastHistoryTsRef.current = ts;
    const point: TelemetrySnapshot = { ...snapshot, ts };
    const buf = historyRef.current;
    buf.push(point);
    const horizon = wall - MAX_HISTORY_AGE_MS;
    while (buf.length > 0 && buf[0].ts < horizon) buf.shift();
    while (buf.length > MAX_HISTORY_POINTS) buf.shift();
  }

  return { snapshot, history: getHistory() };
}
