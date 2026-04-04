export type TrainModel = "KZ8A" | "TE33A" | "KZ4A";

export type TrainStatus = "normal" | "warning" | "critical" | "no_signal";

export type TrainMode = "HAUL" | "IDLE" | "BRAKE" | "SHUNT";

export interface TrainPosition {
  lng: number;
  lat: number;
}

export interface Train {
  id: string;
  model: TrainModel;
  status: TrainStatus;
  healthScore: number;
  speed: number;
  position: TrainPosition;
  route: string;
  lastSeen: string;
}

export interface TrainDetail extends Train {
  serialNumber: string;
  operatorName: string;
  mode: TrainMode;
  startedAt: string;
}

export interface TelemetrySnapshot {
  ts: number;
  lat: number;
  lon: number;
  speed_kph: number;
  heading_deg: number;
  engine_temp_c: number;
  oil_temp_c: number;
  oil_pressure_ok: boolean;
  engine_rpm: number;
  fuel_level_pct: number;
  fuel_consumption_rate: number;
  brake_pipe_pressure_kpa: number;
  main_reservoir_pressure_kpa: number;
  brake_cylinder_pressure_kpa: number;
  brake_pipe_leak_kpa_per_min: number;
  brake_status: string;
  current_a: number;
  traction_voltage_v: number;
  battery_voltage_v: number;
  tractive_effort_kn: number;
  dynamic_brake_force_kn: number;
  health_index: number;
  fault_codes: string[];
  alarm_status: number;
  fire_temp_c: number;
  comm_state: number;
  pcs_open: boolean;
  alerter_timer_sec: number;
}

export interface TelemetryBuffer {
  snapshot: TelemetrySnapshot;
  history: TelemetrySnapshot[];
}
