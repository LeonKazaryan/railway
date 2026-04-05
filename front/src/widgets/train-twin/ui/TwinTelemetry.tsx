import { useMemo, useState, useRef, useEffect } from "react";
import { FileSpreadsheet, ChevronDown, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TelemetrySnapshot } from "@/entities/train/model/types";
import type { WsTrainState } from "@/features/fleet-live/model/store";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface TwinTelemetryProps {
  trainId: string;
  ws: WsTrainState | undefined;
  snapshot: TelemetrySnapshot;
}

const TIME_RANGE_OPTIONS = [
  { id: "5m", windowParam: "5m" },
  { id: "15m", windowParam: "15m" },
  { id: "30m", windowParam: "30m" },
  { id: "1h", windowParam: "1h" },
  { id: "6h", windowParam: "6h" },
  { id: "24h", windowParam: "24h" },
] as const;
type TimeRangeId = (typeof TIME_RANGE_OPTIONS)[number]["id"];

const WS_LABELS: Record<string, string> = {
  locomotiveId: "Locomotive ID",
  seq: "Sequence",
  ts: "Timestamp",
  trainId: "Train ID",
  serialNumber: "Serial Number",
  lineId: "Line ID",
  lineName: "Line Name",
  originStation: "Origin Station",
  destinationStation: "Destination Station",
  trainRunStartedAt: "Run Started At",
  lat: "Latitude",
  lon: "Longitude",
  altM: "Altitude (m)",
  speedKph: "Speed (km/h)",
  headingDeg: "Heading (°)",
  brakePipePressureKpa: "Brake Pipe Pressure (kPa)",
  mainReservoirPressureKpa: "Main Reservoir (kPa)",
  brakeCylinderPressureKpa: "Brake Cylinder (kPa)",
  brakePipeLeakKpaPerMin: "Brake Pipe Leak (kPa/min)",
  brakeStatus: "Brake Status",
  batteryVoltageV: "Battery Voltage (V)",
  tractionVoltageV: "Traction Voltage (V)",
  currentA: "Current (A)",
  engineRpm: "Engine RPM",
  engineTempC: "Engine Temp (°C)",
  oilTempC: "Oil Temp (°C)",
  fuelLevelPct: "Fuel Level (%)",
  fuelConsumptionRateLph: "Fuel Consumption (l/h)",
  tractiveEffortKn: "Tractive Effort (kN)",
  dynamicBrakeForceKn: "Dynamic Brake Force (kN)",
  alerterTimerSec: "Alerter Timer (s)",
  pcsOpen: "PCS Open",
  eabStatus: "EAB Status",
  commState: "Comm State",
  alarmStatus: "Alarm Status",
  healthIndex: "Health Index",
  healthStatus: "Health Status",
  faultCodes: "Fault Codes",
  currentMode: "Current Mode",
  parameterZones: "Parameter Zones",
  routePathCoordinates: "Route Coordinates",
};

const SNAPSHOT_LABELS: Record<string, string> = {
  ts: "Timestamp",
  lat: "Latitude",
  lon: "Longitude",
  speed_kph: "Speed (km/h)",
  heading_deg: "Heading (°)",
  engine_temp_c: "Engine Temp (°C)",
  oil_temp_c: "Oil Temp (°C)",
  oil_pressure_ok: "Oil Pressure OK",
  engine_rpm: "Engine RPM",
  fuel_level_pct: "Fuel Level (%)",
  fuel_consumption_rate: "Fuel Consumption (l/h)",
  brake_pipe_pressure_kpa: "Brake Pipe Pressure (kPa)",
  main_reservoir_pressure_kpa: "Main Reservoir (kPa)",
  brake_cylinder_pressure_kpa: "Brake Cylinder (kPa)",
  brake_pipe_leak_kpa_per_min: "Brake Pipe Leak (kPa/min)",
  brake_status: "Brake Status",
  current_a: "Current (A)",
  traction_voltage_v: "Traction Voltage (V)",
  battery_voltage_v: "Battery Voltage (V)",
  tractive_effort_kn: "Tractive Effort (kN)",
  dynamic_brake_force_kn: "Dynamic Brake Force (kN)",
  health_index: "Health Index",
  fault_codes: "Fault Codes",
  alarm_status: "Alarm Status",
  fire_temp_c: "Fire Temp (°C)",
  comm_state: "Comm State",
  pcs_open: "PCS Open",
  alerter_timer_sec: "Alerter Timer (s)",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number" && !Number.isFinite(v)) return "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    const first = v[0];
    if (
      Array.isArray(first) &&
      typeof first[0] === "number" &&
      typeof first[1] === "number"
    ) {
      const n = v.length as number;
      if (n <= 3) return JSON.stringify(v);
      const a = v[0] as [number, number];
      const b = v[n - 1] as [number, number];
      return `${n} pts [${a[0].toFixed(4)},${a[1].toFixed(4)}] … [${b[0].toFixed(4)},${b[1].toFixed(4)}]`;
    }
    if (typeof first === "string" || typeof first === "number") {
      const s = JSON.stringify(v);
      return s.length > 320 ? `${s.slice(0, 317)}…` : s;
    }
    return `[${v.length} items]`;
  }
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 400 ? `${s.slice(0, 397)}…` : s;
  }
  const s = String(v);
  return s.length > 400 ? `${s.slice(0, 397)}…` : s;
}

const WS_FIELD_ORDER: (keyof WsTrainState)[] = [
  "locomotiveId", "seq", "ts", "trainId", "serialNumber",
  "lineId", "lineName", "originStation", "destinationStation", "trainRunStartedAt",
  "lat", "lon", "altM", "speedKph", "headingDeg",
  "brakePipePressureKpa", "mainReservoirPressureKpa", "brakeCylinderPressureKpa",
  "brakePipeLeakKpaPerMin", "brakeStatus",
  "batteryVoltageV", "tractionVoltageV", "currentA",
  "engineRpm", "engineTempC", "oilTempC",
  "fuelLevelPct", "fuelConsumptionRateLph",
  "tractiveEffortKn", "dynamicBrakeForceKn",
  "alerterTimerSec", "pcsOpen", "eabStatus", "commState", "alarmStatus",
  "healthIndex", "healthStatus", "faultCodes", "currentMode",
  "parameterZones", "routePathCoordinates",
];

const SNAPSHOT_KEYS: (keyof TelemetrySnapshot)[] = [
  "ts", "lat", "lon", "speed_kph", "heading_deg",
  "engine_temp_c", "oil_temp_c", "oil_pressure_ok", "engine_rpm",
  "fuel_level_pct", "fuel_consumption_rate",
  "brake_pipe_pressure_kpa", "main_reservoir_pressure_kpa",
  "brake_cylinder_pressure_kpa", "brake_pipe_leak_kpa_per_min", "brake_status",
  "current_a", "traction_voltage_v", "battery_voltage_v",
  "tractive_effort_kn", "dynamic_brake_force_kn",
  "health_index", "fault_codes", "alarm_status", "fire_temp_c",
  "comm_state", "pcs_open", "alerter_timer_sec",
];

interface FieldRow {
  key: string;
  label: string;
  value: string;
}

function buildWsRows(ws: WsTrainState | undefined, noLive: string): FieldRow[] {
  if (!ws) return [{ key: "live", label: "Live", value: noLive }];
  const rows: FieldRow[] = [];
  const seen = new Set<string>();
  for (const key of WS_FIELD_ORDER) {
    seen.add(key);
    rows.push({ key, label: WS_LABELS[key] ?? key, value: formatValue(ws[key]) });
  }
  for (const key of Object.keys(ws) as (keyof WsTrainState)[]) {
    if (!seen.has(key as string)) {
      rows.push({ key: String(key), label: WS_LABELS[key as string] ?? String(key), value: formatValue(ws[key]) });
    }
  }
  return rows;
}

function buildSnapshotRows(snapshot: TelemetrySnapshot): FieldRow[] {
  return SNAPSHOT_KEYS.map((key) => ({
    key,
    label: SNAPSHOT_LABELS[key] ?? key,
    value: formatValue(snapshot[key]),
  }));
}

function TableBlock({
  title,
  rows,
  colField,
  colValue,
}: {
  title: string;
  rows: FieldRow[];
  colField: string;
  colValue: string;
}) {
  return (
    <div
      className="flex flex-col min-w-0 rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-panel)" }}
    >
      <div
        className="px-4 py-2.5 border-b shrink-0"
        style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
      >
        <span
          className="text-[10px] font-bold tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <th
                className="sticky left-0 z-[1] px-4 py-2 text-[9px] font-bold uppercase tracking-wider w-[45%] max-w-[min(45vw,300px)]"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
              >
                {colField}
              </th>
              <th
                className="px-4 py-2 text-[9px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
              >
                {colValue}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label, value }) => (
              <tr
                key={key}
                className="border-b last:border-b-0"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <td
                  className="sticky left-0 z-[1] px-4 py-2 align-top max-w-[min(45vw,300px)] break-all"
                  style={{ backgroundColor: "var(--bg-panel)" }}
                >
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {label}
                  </span>
                  <span
                    className="ml-2 text-[9px] font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {key}
                  </span>
                </td>
                <td
                  className="px-4 py-2 align-top font-mono text-[11px] break-all"
                  style={{ color: "var(--text-primary)" }}
                  title={value.length > 120 ? value : undefined}
                >
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimeRangeDropdown({
  value,
  onChange,
}: {
  value: TimeRangeId;
  onChange: (v: TimeRangeId) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors hover:opacity-90"
        style={{
          borderColor: "var(--border-subtle)",
          backgroundColor: "var(--bg-panel)",
          color: "var(--text-secondary)",
        }}
      >
        <Clock size={13} />
        {t(`twin.telemetry.range.${value}`)}
        <ChevronDown size={12} style={{ opacity: 0.5 }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 min-w-[120px] rounded-lg border py-1 shadow-xl"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
          }}
        >
          {TIME_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                color: opt.id === value ? "var(--accent-primary)" : "var(--text-secondary)",
                backgroundColor: opt.id === value ? "var(--accent-soft, rgba(56,189,248,0.08))" : undefined,
              }}
            >
              {t(`twin.telemetry.range.${opt.id}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TwinTelemetry({ trainId, ws, snapshot }: TwinTelemetryProps) {
  const { t } = useTranslation();
  const [exportRange, setExportRange] = useState<TimeRangeId>("15m");

  const wsRows = useMemo(
    () => buildWsRows(ws, t("twin.telemetry.noLive")),
    [ws, t],
  );
  const snapshotRows = useMemo(() => buildSnapshotRows(snapshot), [snapshot]);

  const trainIdForExport = ws?.trainId ?? trainId;

  const handleExport = () => {
    const windowParam = TIME_RANGE_OPTIONS.find((o) => o.id === exportRange)?.windowParam ?? "15m";
    const qs = `?window=${windowParam}&trainId=${encodeURIComponent(trainIdForExport)}`;
    const path = `/api/v1/telemetry/raw/csv${qs}`;
    const url = API_BASE ? `${API_BASE}${path}` : path;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div
        className="flex items-center justify-between gap-3 px-5 py-3 shrink-0 border-b"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)" }}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className="text-[9px] font-bold tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            {t("twin.telemetry.title")}
          </span>
          <span
            className="text-xs font-semibold truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("twin.telemetry.subtitle")}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TimeRangeDropdown value={exportRange} onChange={setExportRange} />
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors hover:opacity-90"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--accent-primary, #38bdf8)",
              color: "#fff",
            }}
            title={t("twin.telemetry.exportCsvTitle")}
            aria-label={t("twin.telemetry.exportCsvTitle")}
          >
            <FileSpreadsheet size={15} />
            CSV
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-6">
        <TableBlock
          title={t("twin.telemetry.sectionWs")}
          rows={wsRows}
          colField={t("twin.telemetry.colField")}
          colValue={t("twin.telemetry.colValue")}
        />
        <TableBlock
          title={t("twin.telemetry.sectionSnapshot")}
          rows={snapshotRows}
          colField={t("twin.telemetry.colField")}
          colValue={t("twin.telemetry.colValue")}
        />
      </div>
    </div>
  );
}
