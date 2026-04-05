import { useMemo, memo } from "react";
import ReactECharts from "echarts-for-react";
import { Activity, Droplets, AlertCircle, Zap, Wind, Gauge } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TelemetryBuffer, TelemetrySnapshot } from "@/entities/train/model/types";
import {
  serverParameterZoneToStatus,
  SYSTEM_ZONE_STATUS_COLORS,
} from "@/entities/train/model/config";
import type { ServerParameterZone } from "@/entities/train/model/config";
import { useThemeStore } from "@/features/theme/model/store";

type MetricStatus = "normal" | "warning" | "critical" | "low";

export interface TwinSystemsProps {
  buffer: TelemetryBuffer;
  parameterZones: Record<string, ServerParameterZone> | null;
  eabStatus: string | null;
}

function resolveStatus(
  key: string,
  computed: MetricStatus,
  zones: Record<string, ServerParameterZone> | null,
): MetricStatus {
  const z = zones?.[key];
  return z ? serverParameterZoneToStatus(z) : computed;
}

function thresholdStatus(
  value: number,
  opts: { low?: number; warning: number; critical: number },
): MetricStatus {
  if (opts.low !== undefined && value < opts.low) return "low";
  if (value >= opts.critical) return "critical";
  if (value >= opts.warning) return "warning";
  return "normal";
}

function thresholdReversed(
  value: number,
  opts: { critical: number; warning: number },
): MetricStatus {
  if (value <= opts.critical) return "critical";
  if (value <= opts.warning) return "warning";
  return "normal";
}

function worstStatus(statuses: MetricStatus[]): MetricStatus {
  if (statuses.includes("critical")) return "critical";
  if (statuses.includes("warning")) return "warning";
  if (statuses.includes("low")) return "low";
  return "normal";
}

function statusColor(s: MetricStatus): string {
  return SYSTEM_ZONE_STATUS_COLORS[s];
}

function brakeStringStatus(val: string | null): MetricStatus {
  if (!val) return "normal";
  const u = val.toUpperCase();
  if (u === "EMERGENCY" || u === "EAB" || u === "ACTIVE") return "critical";
  if (u === "APPLIED" || u === "PARTIAL" || u === "WARN") return "warning";
  return "normal";
}

function sparklineData(
  history: TelemetrySnapshot[],
  key: keyof TelemetrySnapshot,
  divisor = 1,
): [number, number][] {
  const last = history[history.length - 1];
  const cutMs = last ? last.ts - 5 * 60 * 1000 : 0;
  return history
    .filter((s) => s.ts >= cutMs)
    .map((s) => [s.ts, parseFloat(((s[key] as number) / divisor).toFixed(2))]);
}

function buildSparklineOption(
  data: [number, number][],
  color: string,
  theme: "dark" | "light",
) {
  const axisMuted =
    theme === "light" ? "rgba(15,23,42,0.40)" : "rgba(255,255,255,0.28)";
  const now = Date.now();
  const xMin = data.length > 0 ? data[0][0] : now - 300_000;
  const xMax = data.length > 0 ? data[data.length - 1][0] : now;
  const span = Math.max(1, xMax - xMin);
  const axisFormatter = (val: number) => {
    const d = new Date(val);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return span > 2 * 3600_000 ? `${h}:${m}` : `${h}:${m}`;
  };
  return {
    backgroundColor: "transparent",
    grid: { top: 4, bottom: 16, left: 4, right: 4 },
    xAxis: {
      type: "time",
      show: true,
      min: xMin,
      max: xMax,
      axisLabel: { color: axisMuted, fontSize: 8, formatter: axisFormatter },
      axisLine: { show: false },
      splitLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: { type: "value", show: false },
    series: [
      {
        type: "line",
        data,
        smooth: true,
        symbol: "none",
        lineStyle: { color, width: 1.5 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${color}30` },
              { offset: 1, color: `${color}00` },
            ],
          },
        },
      },
    ],
  };
}

function buildGaugeOption(
  value: number,
  min: number,
  max: number,
  color: string,
  unit: string,
  theme: "dark" | "light",
  startAngle = 200,
  endAngle = -20,
) {
  const trackColor =
    theme === "light" ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.07)";
  const detailColor =
    theme === "light" ? "#0f172a" : "#e8edf5";
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return {
    backgroundColor: "transparent",
    series: [
      {
        type: "gauge",
        radius: "88%",
        startAngle,
        endAngle,
        min,
        max,
        axisLine: {
          lineStyle: {
            width: 10,
            color: [
              [t, color],
              [1, trackColor],
            ],
          },
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "JetBrains Mono, monospace",
          color: detailColor,
          formatter: `{value} ${unit}`,
          offsetCenter: [0, "10%"],
        },
        data: [{ value: parseFloat(value.toFixed(1)) }],
      },
    ],
  };
}

function buildCircleGaugeOption(
  value: number,
  color: string,
  theme: "dark" | "light",
) {
  const trackColor =
    theme === "light" ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.07)";
  const detailColor = theme === "light" ? "#0f172a" : "#e8edf5";
  const t = Math.max(0, Math.min(1, value / 100));
  return {
    backgroundColor: "transparent",
    series: [
      {
        type: "gauge",
        radius: "88%",
        startAngle: 90,
        endAngle: -270,
        min: 0,
        max: 100,
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [t, color],
              [1, trackColor],
            ],
          },
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "JetBrains Mono, monospace",
          color: detailColor,
          formatter: "{value}%",
          offsetCenter: [0, "0%"],
        },
        data: [{ value: Math.round(value) }],
      },
    ],
  };
}

interface StatusBadgeProps {
  status: MetricStatus;
  label?: string;
}

function StatusBadge({ status, label }: StatusBadgeProps) {
  const { t } = useTranslation();
  const color = statusColor(status);
  const text = label ?? t(`twin.systems.status.${status}`);
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          backgroundColor: color,
          boxShadow: status !== "normal" ? `0 0 6px ${color}` : undefined,
        }}
      />
      <span className="text-[10px] font-semibold" style={{ color }}>
        {text}
      </span>
    </div>
  );
}

interface BigValueProps {
  label: string;
  value: string;
  unit: string;
  status: MetricStatus;
}

function BigValue({ label, value, unit, status }: BigValueProps) {
  const color = statusColor(status);
  return (
    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
      <span
        className="text-[9px] font-bold tracking-wider uppercase truncate"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className="text-2xl font-bold font-mono leading-none"
          style={{ color: status === "normal" ? "var(--text-primary)" : color }}
        >
          {value}
        </span>
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {unit}
        </span>
      </div>
    </div>
  );
}

interface SectionSparklineProps {
  data: [number, number][];
  color: string;
  height?: number;
  id: string;
}

const SectionSparkline = memo(function SectionSparkline({
  data,
  color,
  height = 52,
  id,
}: SectionSparklineProps) {
  const theme = useThemeStore((s) => s.theme);
  const option = useMemo(
    () => buildSparklineOption(data, color, theme),
    [data, color, theme],
  );
  return (
    <div style={{ height }}>
      <ReactECharts
        key={id}
        option={option}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
});

interface SemiGaugeChartProps {
  value: number;
  min: number;
  max: number;
  color: string;
  unit: string;
  size: number;
  id: string;
}

const SemiGaugeChart = memo(function SemiGaugeChart({
  value,
  min,
  max,
  color,
  unit,
  size,
  id,
}: SemiGaugeChartProps) {
  const theme = useThemeStore((s) => s.theme);
  const option = useMemo(
    () => buildGaugeOption(value, min, max, color, unit, theme),
    [value, min, max, color, unit, theme],
  );
  return (
    <div style={{ width: size, height: size }}>
      <ReactECharts
        key={id}
        option={option}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
});

interface CircleGaugeChartProps {
  value: number;
  color: string;
  size: number;
  id: string;
}

const CircleGaugeChart = memo(function CircleGaugeChart({
  value,
  color,
  size,
  id,
}: CircleGaugeChartProps) {
  const theme = useThemeStore((s) => s.theme);
  const option = useMemo(
    () => buildCircleGaugeOption(value, color, theme),
    [value, color, theme],
  );
  return (
    <div style={{ width: size, height: size }}>
      <ReactECharts
        key={id}
        option={option}
        style={{ width: "100%", height: "100%" }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
});

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  status: MetricStatus;
  children: React.ReactNode;
}

function SectionCard({ icon, title, status, children }: SectionCardProps) {
  const color = statusColor(status);
  const isAlert = status !== "normal";
  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: isAlert ? color : "var(--border-subtle)",
        boxShadow: isAlert
          ? `0 0 14px ${color}18, var(--card-shadow, none)`
          : "var(--card-shadow, none)",
      }}
    >
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b shrink-0"
        style={{
          backgroundColor: "var(--bg-elevated)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <span
          className="shrink-0"
          style={{ color: isAlert ? color : "var(--accent-primary)" }}
        >
          {icon}
        </span>
        <span
          className="flex-1 text-[10px] font-bold tracking-widest uppercase"
          style={{ color: "var(--text-secondary)" }}
        >
          {title}
        </span>
        <StatusBadge status={status} />
      </div>
      <div className="flex flex-col flex-1 p-4 gap-3">{children}</div>
    </div>
  );
}

function TractionSection({
  snapshot,
  history,
  parameterZones,
}: {
  snapshot: TelemetrySnapshot;
  history: TelemetrySnapshot[];
  parameterZones: Record<string, ServerParameterZone> | null;
}) {
  const { t } = useTranslation();
  const m = t("twin.systems.metrics", { returnObjects: true }) as Record<string, string>;

  const s1 = resolveStatus("tractive_effort_kn", thresholdStatus(snapshot.tractive_effort_kn, { warning: 250, critical: 300 }), parameterZones);
  const s2 = resolveStatus("dynamic_brake_force_kn", thresholdStatus(snapshot.dynamic_brake_force_kn, { warning: 200, critical: 280 }), parameterZones);
  const s3 = resolveStatus("engine_rpm", thresholdStatus(snapshot.engine_rpm, { warning: 1800, critical: 2100 }), parameterZones);
  const s4 = resolveStatus("engine_temp_c", thresholdStatus(snapshot.engine_temp_c, { warning: 88, critical: 100 }), parameterZones);

  const engineLoadPct = Math.min(100, Math.round((snapshot.engine_rpm / 2000) * 100));
  const loadColor = engineLoadPct > 90 ? "#f43f5e" : engineLoadPct > 70 ? "#f59e0b" : "#22d3a0";

  const sparkData = useMemo(() => sparklineData(history, "engine_temp_c"), [history]);

  return (
    <SectionCard
      icon={<Activity size={15} />}
      title={t("twin.systems.sections.traction")}
      status={worstStatus([s1, s2, s3, s4])}
    >
      <div className="grid grid-cols-2 gap-3">
        <BigValue label={m.tractiveEffort} value={snapshot.tractive_effort_kn.toFixed(0)} unit="kN" status={s1} />
        <BigValue label={m.dynamicBrakeForce} value={snapshot.dynamic_brake_force_kn.toFixed(0)} unit="kN" status={s2} />
        <BigValue label={m.engineRpm} value={snapshot.engine_rpm.toFixed(0)} unit="rpm" status={s3} />
        <BigValue label={m.engineTemp} value={snapshot.engine_temp_c.toFixed(1)} unit="°C" status={s4} />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
            {m.engineLoad}
          </span>
          <span className="text-[10px] font-mono font-bold" style={{ color: loadColor }}>
            {engineLoadPct}%
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-subtle)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${engineLoadPct}%`, backgroundColor: loadColor }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
          {m.engineTempTrend}
        </span>
        <SectionSparkline data={sparkData} color="#f43f5e" id="traction-spark" />
      </div>
    </SectionCard>
  );
}

function OilSection({
  snapshot,
  history,
  parameterZones,
}: {
  snapshot: TelemetrySnapshot;
  history: TelemetrySnapshot[];
  parameterZones: Record<string, ServerParameterZone> | null;
}) {
  const { t } = useTranslation();
  const m = t("twin.systems.metrics", { returnObjects: true }) as Record<string, string>;

  const sTmp = resolveStatus("oil_temp_c", thresholdStatus(snapshot.oil_temp_c, { warning: 80, critical: 95 }), parameterZones);
  const sPrs: MetricStatus = snapshot.oil_pressure_ok ? "normal" : "critical";
  const overall = worstStatus([sTmp, sPrs]);
  const tempColor = statusColor(sTmp);
  const prsColor = statusColor(sPrs);

  const sparkData = useMemo(() => sparklineData(history, "oil_temp_c"), [history]);

  return (
    <SectionCard icon={<Droplets size={15} />} title={t("twin.systems.sections.oil")} status={overall}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
            {m.oilTemp}
          </span>
          <SemiGaugeChart value={snapshot.oil_temp_c} min={0} max={120} color={tempColor} unit="°C" size={100} id="oil-gauge" />
        </div>

        <div className="flex flex-col items-center gap-2 pt-4">
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
            {m.oilPressure}
          </span>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center border-2"
            style={{
              borderColor: prsColor,
              backgroundColor: `${prsColor}15`,
              boxShadow: sPrs !== "normal" ? `0 0 12px ${prsColor}40` : undefined,
            }}
          >
            <span className="text-sm font-bold font-mono" style={{ color: prsColor }}>
              {snapshot.oil_pressure_ok ? t("twin.systems.oilOk") : t("twin.systems.oilLow")}
            </span>
          </div>
          <StatusBadge status={sPrs} label={t(`twin.systems.status.${sPrs}`)} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
          {m.oilTempTrend}
        </span>
        <SectionSparkline data={sparkData} color={tempColor} id="oil-spark" />
      </div>
    </SectionCard>
  );
}

function BrakesSection({
  snapshot,
  history,
  parameterZones,
  eabStatus,
}: {
  snapshot: TelemetrySnapshot;
  history: TelemetrySnapshot[];
  parameterZones: Record<string, ServerParameterZone> | null;
  eabStatus: string | null;
}) {
  const { t } = useTranslation();
  const m = t("twin.systems.metrics", { returnObjects: true }) as Record<string, string>;

  const sPipe = resolveStatus("brake_pipe_pressure_kpa", thresholdStatus(snapshot.brake_pipe_pressure_kpa, { low: 400, warning: 580, critical: 700 }), parameterZones);
  const sCyl = resolveStatus("brake_cylinder_pressure_kpa", thresholdStatus(snapshot.brake_cylinder_pressure_kpa, { warning: 300, critical: 450 }), parameterZones);
  const sLeak = resolveStatus("brake_pipe_leak_kpa_per_min", thresholdStatus(snapshot.brake_pipe_leak_kpa_per_min, { warning: 2, critical: 5 }), parameterZones);
  const sBrake = brakeStringStatus(snapshot.brake_status);
  const sEab = brakeStringStatus(eabStatus);

  const sparkData = useMemo(() => sparklineData(history, "brake_pipe_pressure_kpa"), [history]);

  return (
    <SectionCard icon={<AlertCircle size={15} />} title={t("twin.systems.sections.brakes")} status={worstStatus([sPipe, sCyl, sLeak, sBrake, sEab])}>
      <div className="grid grid-cols-3 gap-2">
        <BigValue label={m.brakePipePressure} value={snapshot.brake_pipe_pressure_kpa.toFixed(0)} unit="kPa" status={sPipe} />
        <BigValue label={m.brakeCylinderPressure} value={snapshot.brake_cylinder_pressure_kpa.toFixed(0)} unit="kPa" status={sCyl} />
        <BigValue label={m.brakePipeLeak} value={snapshot.brake_pipe_leak_kpa_per_min.toFixed(1)} unit="kPa/m" status={sLeak} />
      </div>

      <div className="flex items-center gap-4 pt-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
            {m.brakeStatus}
          </span>
          <StatusBadge status={sBrake} label={snapshot.brake_status || "—"} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
            {m.eabStatus}
          </span>
          <StatusBadge status={sEab} label={eabStatus || "—"} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
          {m.brakePipeTrend}
        </span>
        <SectionSparkline data={sparkData} color={statusColor(sPipe)} id="brakes-spark" />
      </div>
    </SectionCard>
  );
}

function ElectricalSection({
  snapshot,
  history,
  parameterZones,
}: {
  snapshot: TelemetrySnapshot;
  history: TelemetrySnapshot[];
  parameterZones: Record<string, ServerParameterZone> | null;
}) {
  const { t } = useTranslation();
  const m = t("twin.systems.metrics", { returnObjects: true }) as Record<string, string>;

  const sBat = resolveStatus("battery_voltage_v", thresholdReversed(snapshot.battery_voltage_v, { critical: 22, warning: 24 }), parameterZones);
  const sTrc = resolveStatus("traction_voltage_v", "normal" as MetricStatus, parameterZones);
  const sCur = resolveStatus("current_a", thresholdStatus(snapshot.current_a, { warning: 1400, critical: 1600 }), parameterZones);

  const sparkData = useMemo(() => sparklineData(history, "current_a"), [history]);

  return (
    <SectionCard icon={<Zap size={15} />} title={t("twin.systems.sections.electrical")} status={worstStatus([sBat, sTrc, sCur])}>
      <div className="flex items-end justify-around gap-2">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
            {m.batteryVoltage}
          </span>
          <SemiGaugeChart value={snapshot.battery_voltage_v} min={20} max={32} color={statusColor(sBat)} unit="V" size={90} id="elec-bat-gauge" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
            {m.tractionVoltage}
          </span>
          <SemiGaugeChart value={snapshot.traction_voltage_v} min={0} max={4000} color={statusColor(sTrc)} unit="V" size={90} id="elec-trc-gauge" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
            {m.current}
          </span>
          <SemiGaugeChart value={snapshot.current_a} min={0} max={1800} color={statusColor(sCur)} unit="A" size={90} id="elec-cur-gauge" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
          {m.currentTrend}
        </span>
        <SectionSparkline data={sparkData} color={statusColor(sCur)} id="elec-spark" />
      </div>
    </SectionCard>
  );
}

function PneumaticsSection({
  snapshot,
  history,
  parameterZones,
}: {
  snapshot: TelemetrySnapshot;
  history: TelemetrySnapshot[];
  parameterZones: Record<string, ServerParameterZone> | null;
}) {
  const { t } = useTranslation();
  const m = t("twin.systems.metrics", { returnObjects: true }) as Record<string, string>;

  const sRes = resolveStatus("main_reservoir_pressure_kpa", thresholdStatus(snapshot.main_reservoir_pressure_kpa, { low: 600, warning: 900, critical: 1000 }), parameterZones);
  const resColor = statusColor(sRes);

  const sparkData = useMemo(() => sparklineData(history, "main_reservoir_pressure_kpa"), [history]);

  return (
    <SectionCard icon={<Wind size={15} />} title={t("twin.systems.sections.pneumatics")} status={sRes}>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
          {m.mainReservoirPressure}
        </span>
        <SemiGaugeChart
          value={snapshot.main_reservoir_pressure_kpa}
          min={0}
          max={1000}
          color={resColor}
          unit="kPa"
          size={130}
          id="pneu-gauge"
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
          {m.pressureTrend}
        </span>
        <SectionSparkline data={sparkData} color={resColor} id="pneu-spark" />
      </div>
    </SectionCard>
  );
}

function FuelSection({
  snapshot,
  history,
  parameterZones,
}: {
  snapshot: TelemetrySnapshot;
  history: TelemetrySnapshot[];
  parameterZones: Record<string, ServerParameterZone> | null;
}) {
  const { t } = useTranslation();
  const m = t("twin.systems.metrics", { returnObjects: true }) as Record<string, string>;

  const sLvl = resolveStatus("fuel_level_pct", thresholdReversed(snapshot.fuel_level_pct, { critical: 10, warning: 25 }), parameterZones);
  const sRate = resolveStatus("fuel_consumption_rate", thresholdStatus(snapshot.fuel_consumption_rate, { warning: 200, critical: 280 }), parameterZones);
  const lvlColor = statusColor(sLvl);

  const estimatedLiters = Math.round((snapshot.fuel_level_pct / 100) * 4000);

  const sparkData = useMemo(() => sparklineData(history, "fuel_level_pct"), [history]);

  return (
    <SectionCard icon={<Gauge size={15} />} title={t("twin.systems.sections.fuel")} status={worstStatus([sLvl, sRate])}>
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
            {m.fuelLevel}
          </span>
          <CircleGaugeChart value={snapshot.fuel_level_pct} color={lvlColor} size={100} id="fuel-circle" />
          <div className="flex flex-col items-center gap-0">
            <span className="text-[10px] font-mono font-bold" style={{ color: "var(--text-secondary)" }}>
              ~{estimatedLiters.toLocaleString()} {t("twin.systems.liters")}
            </span>
            <span className="text-[8px]" style={{ color: "var(--text-muted)" }}>
              {t("twin.systems.estimatedRemaining")}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 flex-1 pt-4">
          <BigValue label={m.fuelConsumptionRate} value={snapshot.fuel_consumption_rate.toFixed(0)} unit="l/h" status={sRate} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
          {m.fuelTrend}
        </span>
        <SectionSparkline data={sparkData} color={lvlColor} id="fuel-spark" />
      </div>
    </SectionCard>
  );
}

export function TwinSystems({ buffer, parameterZones, eabStatus }: TwinSystemsProps) {
  const { snapshot, history } = buffer;

  return (
    <div className="flex-1 overflow-y-auto p-5 min-w-0">
      <div className="grid grid-cols-3 gap-4">
        <TractionSection snapshot={snapshot} history={history} parameterZones={parameterZones} />
        <OilSection snapshot={snapshot} history={history} parameterZones={parameterZones} />
        <BrakesSection snapshot={snapshot} history={history} parameterZones={parameterZones} eabStatus={eabStatus} />
        <ElectricalSection snapshot={snapshot} history={history} parameterZones={parameterZones} />
        <PneumaticsSection snapshot={snapshot} history={history} parameterZones={parameterZones} />
        <FuelSection snapshot={snapshot} history={history} parameterZones={parameterZones} />
      </div>
    </div>
  );
}
