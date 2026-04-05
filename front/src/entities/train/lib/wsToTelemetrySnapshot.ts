import type { TelemetrySnapshot } from "../model/types";

export function wsToTelemetrySnapshot(ws: {
  ts: string;
  lat: number | null;
  lon: number | null;
  speedKph: number | null;
  headingDeg: number | null;
  engineTempC: number | null;
  oilTempC: number | null;
  engineRpm: number | null;
  fuelLevelPct: number | null;
  fuelConsumptionRateLph: number | null;
  brakePipePressureKpa: number | null;
  mainReservoirPressureKpa: number | null;
  brakeCylinderPressureKpa: number | null;
  brakePipeLeakKpaPerMin: number | null;
  brakeStatus: string | null;
  currentA: number | null;
  tractionVoltageV: number | null;
  batteryVoltageV: number | null;
  tractiveEffortKn: number | null;
  dynamicBrakeForceKn: number | null;
  healthIndex: number | null;
  faultCodes: string[] | null;
  alarmStatus: string | null;
  commState: string | null;
  pcsOpen: boolean | null;
  alerterTimerSec: number | null;
}): TelemetrySnapshot {
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
    alarm_status:
      ws.alarmStatus === "normal" ? 0 : ws.alarmStatus === "warning" ? 1 : 2,
    fire_temp_c: 20,
    comm_state: ws.commState === "online" ? 1 : 0,
    pcs_open: ws.pcsOpen ?? false,
    alerter_timer_sec: ws.alerterTimerSec ?? 0,
  };
}
