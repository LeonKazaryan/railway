import type { TrainModel, TrainStatus, TelemetrySnapshot } from "./types";
import kz8aImg from "../../../../assets/trains/KZ8A.png";
import te33aImg from "../../../../assets/trains/TE33AC.png";
import kz4aImg from "../../../../assets/trains/KZ4A.png";

export const TRAIN_STATUS_CONFIG: Record<
  TrainStatus,
  { color: string; cssVar: string }
> = {
  normal: { color: "#22d3a0", cssVar: "--success" },
  warning: { color: "#f59e0b", cssVar: "--warning" },
  critical: { color: "#f43f5e", cssVar: "--danger" },
  no_signal: { color: "#4a5568", cssVar: "--text-muted" },
};

export const TRAIN_MODEL_ASSETS: Record<TrainModel, { image: string }> = {
  KZ8A: { image: kz8aImg },
  TE33A: { image: te33aImg },
  KZ4A: { image: kz4aImg },
};

export type SystemZoneStatus = "normal" | "warning" | "critical" | "low";

export interface SystemZoneConfig {
  id: string;
  metricKey: keyof TelemetrySnapshot;
  unit: string;
  divisor?: number;
  decimalPlaces?: number;
  thresholds: {
    low?: number;
    warning: number;
    critical: number;
  };
}

export const SYSTEM_ZONE_CONFIG: SystemZoneConfig[] = [
  {
    id: "engine",
    metricKey: "engine_temp_c",
    unit: "°C",
    decimalPlaces: 0,
    thresholds: { warning: 88, critical: 100 },
  },
  {
    id: "electrical",
    metricKey: "current_a",
    unit: "A",
    decimalPlaces: 0,
    thresholds: { warning: 1400, critical: 1600 },
  },
  {
    id: "brakes",
    metricKey: "brake_pipe_pressure_kpa",
    unit: "bar",
    divisor: 100,
    decimalPlaces: 1,
    thresholds: { low: 400, warning: 580, critical: 700 },
  },
  {
    id: "air",
    metricKey: "main_reservoir_pressure_kpa",
    unit: "bar",
    divisor: 100,
    decimalPlaces: 1,
    thresholds: { low: 600, warning: 900, critical: 1000 },
  },
  {
    id: "traction",
    metricKey: "tractive_effort_kn",
    unit: "kN",
    decimalPlaces: 0,
    thresholds: { warning: 250, critical: 300 },
  },
  {
    id: "bogies",
    metricKey: "oil_temp_c",
    unit: "°C",
    decimalPlaces: 0,
    thresholds: { warning: 80, critical: 95 },
  },
];

export interface TelemetryChartConfig {
  id: string;
  unit: string;
  metricKey: keyof TelemetrySnapshot;
  color: string;
  divisor?: number;
  decimalPlaces?: number;
}

export const TELEMETRY_CHART_CONFIG: TelemetryChartConfig[] = [
  {
    id: "speed",
    unit: "km/h",
    metricKey: "speed_kph",
    color: "#38bdf8",
    decimalPlaces: 0,
  },
  {
    id: "coolantTemp",
    unit: "°C",
    metricKey: "engine_temp_c",
    color: "#f43f5e",
    decimalPlaces: 1,
  },
  {
    id: "oilPressure",
    unit: "bar",
    metricKey: "brake_cylinder_pressure_kpa",
    color: "#f59e0b",
    divisor: 100,
    decimalPlaces: 1,
  },
  {
    id: "fuelRate",
    unit: "l/h",
    metricKey: "fuel_consumption_rate",
    color: "#22d3a0",
    decimalPlaces: 0,
  },
  {
    id: "altCurrent",
    unit: "A",
    metricKey: "current_a",
    color: "#6366f1",
    decimalPlaces: 0,
  },
];

export type ServerParameterZone = "green" | "yellow" | "red";

export function serverParameterZoneToStatus(
  sz: ServerParameterZone,
): SystemZoneStatus {
  if (sz === "red") return "critical";
  if (sz === "yellow") return "warning";
  return "normal";
}

export function getSystemZoneStatus(
  config: SystemZoneConfig,
  rawValue: number,
): SystemZoneStatus {
  const value = config.divisor ? rawValue / config.divisor : rawValue;
  if (
    config.thresholds.low !== undefined &&
    value < config.thresholds.low / (config.divisor ?? 1)
  ) {
    return "low";
  }
  if (value >= config.thresholds.critical / (config.divisor ?? 1))
    return "critical";
  if (value >= config.thresholds.warning / (config.divisor ?? 1))
    return "warning";
  return "normal";
}

export function getSystemZoneDisplayValue(
  config: SystemZoneConfig,
  rawValue: number,
): string {
  const value = config.divisor ? rawValue / config.divisor : rawValue;
  return value.toFixed(config.decimalPlaces ?? 0);
}

export const SYSTEM_ZONE_STATUS_COLORS: Record<SystemZoneStatus, string> = {
  normal: "#22d3a0",
  warning: "#f59e0b",
  critical: "#f43f5e",
  low: "#f59e0b",
};
