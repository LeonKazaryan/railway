import type { TelemetrySnapshot, TelemetryBuffer } from "../model/types";
import { wsToTelemetrySnapshot } from "../lib/wsToTelemetrySnapshot";
import {
  useFleetLiveStore,
  type WsTrainState,
} from "@/features/fleet-live/model/store";
import {
  selectTelemetryHistory,
  useTelemetryHistoryStore,
} from "@/features/fleet-live/model/telemetryHistoryStore";

const EMPTY_SNAPSHOT: TelemetrySnapshot = {
  ts: Date.now(),
  lat: 0,
  lon: 0,
  speed_kph: 0,
  heading_deg: 0,
  engine_temp_c: 0,
  oil_temp_c: 0,
  oil_pressure_ok: true,
  engine_rpm: 0,
  fuel_level_pct: 0,
  fuel_consumption_rate: 0,
  brake_pipe_pressure_kpa: 0,
  main_reservoir_pressure_kpa: 0,
  brake_cylinder_pressure_kpa: 0,
  brake_pipe_leak_kpa_per_min: 0,
  brake_status: "UNKNOWN",
  current_a: 0,
  traction_voltage_v: 0,
  battery_voltage_v: 0,
  tractive_effort_kn: 0,
  dynamic_brake_force_kn: 0,
  health_index: 0,
  fault_codes: [],
  alarm_status: 0,
  fire_temp_c: 20,
  comm_state: 0,
  pcs_open: false,
  alerter_timer_sec: 0,
};

export function useLiveTelemetry(trainId: string): TelemetryBuffer {
  const trains = useFleetLiveStore((s) => s.trains);

  let ws: WsTrainState | undefined;
  for (const [, v] of trains) {
    if (v.trainId === trainId || v.locomotiveId === trainId) {
      ws = v;
      break;
    }
  }

  const history = useTelemetryHistoryStore((s) =>
    selectTelemetryHistory(s.byLocomotive, ws?.locomotiveId, trainId),
  );

  const snapshot = ws ? wsToTelemetrySnapshot(ws) : EMPTY_SNAPSHOT;

  return { snapshot, history };
}
