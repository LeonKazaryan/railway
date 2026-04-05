import { useState, useRef, useEffect, memo, useMemo } from "react";
import type { ECharts } from "echarts";
import { useTranslation } from "react-i18next";
import ReactECharts from "echarts-for-react";
import type { TelemetrySnapshot } from "@/entities/train/model/types";
import { TELEMETRY_CHART_CONFIG } from "@/entities/train/model/config";
import { useThemeStore } from "@/features/theme/model/store";
import { cn } from "@/shared/lib/cn";

const TIME_RANGE_IDS = ["m5", "m15", "h1", "h4"] as const;
type TimeRangeId = (typeof TIME_RANGE_IDS)[number];

const TIME_RANGE_MS: Record<TimeRangeId, number> = {
  m5: 5 * 60 * 1000,
  m15: 15 * 60 * 1000,
  h1: 60 * 60 * 1000,
  h4: 4 * 60 * 60 * 1000,
};

interface MiniChartProps {
  chartId: string;
  label: string;
  unit: string;
  color: string;
  data: [number, number][];
  currentValue: string;
  timeMin: number;
  timeMax: number;
}

const MiniChart = memo(function MiniChart({
  label,
  unit,
  color,
  data,
  currentValue,
  chartId,
  timeMin,
  timeMax,
}: MiniChartProps) {
  const echartsRef = useRef<ECharts | null>(null);
  const theme = useThemeStore((s) => s.theme);

  const option = useMemo(() => {
    const axisMuted =
      theme === "light" ? "rgba(15,23,42,0.42)" : "rgba(255,255,255,0.3)";
    let xMin = timeMin;
    let xMax = timeMax;
    if (data.length === 0) {
      xMin = timeMin;
      xMax = timeMax;
    } else if (data.length === 1) {
      const t = data[0][0];
      xMin = t - 60_000;
      xMax = t + 60_000;
    } else if (xMax <= xMin) {
      xMin -= 60_000;
      xMax += 60_000;
    }
    const spanMs = Math.max(1, xMax - xMin);
    const axisFormatter = (val: number) => {
      const d = new Date(val);
      const pad = (n: number) => n.toString().padStart(2, "0");
      if (spanMs > 48 * 60 * 60 * 1000) {
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      if (spanMs > 2 * 60 * 60 * 1000) {
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    return {
      backgroundColor: "transparent",
      grid: { top: 4, bottom: 16, left: 4, right: 4 },
      xAxis: {
        type: "time",
        show: true,
        min: xMin,
        max: xMax,
        axisLabel: {
          color: axisMuted,
          fontSize: 8,
          formatter: axisFormatter,
        },
        axisLine: { show: false },
        splitLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        show: false,
      },
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
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${color}30` },
                { offset: 1, color: `${color}00` },
              ],
            },
          },
        },
      ],
    };
  }, [data, color, theme, timeMin, timeMax]);

  useEffect(() => {
    if (echartsRef.current && data.length > 0) {
      echartsRef.current.setOption(option);
    }
  }, [data, option]);

  return (
    <div
      className="flex flex-col flex-1 min-w-0 rounded-xl p-2 border"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <span
          className="text-[9px] font-bold tracking-wider uppercase"
          style={{ color }}
        >
          {label}
        </span>
        <span
          className="text-[9px] font-mono font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {currentValue}{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
            {unit}
          </span>
        </span>
      </div>
      <div style={{ height: 64 }}>
        <ReactECharts
          key={chartId}
          option={option}
          style={{ width: "100%", height: "100%" }}
          opts={{ renderer: "svg" }}
          onChartReady={(instance) => {
            echartsRef.current = instance;
          }}
        />
      </div>
    </div>
  );
});

interface TwinTelemetryTimelineProps {
  history: TelemetrySnapshot[];
}

export function TwinTelemetryTimeline({ history }: TwinTelemetryTimelineProps) {
  const { t } = useTranslation();
  const [range, setRange] = useState<TimeRangeId>("m5");

  const { slice, timeMin, timeMax } = useMemo(() => {
    const windowMs = TIME_RANGE_MS[range];
    if (history.length === 0) {
      const now = Date.now();
      return {
        slice: [] as TelemetrySnapshot[],
        timeMin: now - windowMs,
        timeMax: now,
      };
    }
    const latestTs = history[history.length - 1].ts;
    const cutoff = latestTs - windowMs;
    const filtered = history.filter((s) => s.ts >= cutoff);
    return {
      slice: filtered,
      timeMin: cutoff,
      timeMax: latestTs,
    };
  }, [history, range]);

  const latest = history[history.length - 1];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span
          className="text-[9px] font-bold tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          {t("twin.timeline.title")}
        </span>
        <div className="flex items-center gap-1">
          {TIME_RANGE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setRange(id)}
              className={cn(
                "text-[9px] font-semibold px-2 py-0.5 rounded transition-all",
                range === id
                  ? "text-[var(--accent-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
              )}
              style={
                range === id
                  ? { backgroundColor: "var(--accent-soft)" }
                  : undefined
              }
            >
              {t(`twin.timeline.${id}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {TELEMETRY_CHART_CONFIG.map((cfg) => {
          const divisor = cfg.divisor ?? 1;
          const dp = cfg.decimalPlaces ?? 0;
          const chartData: [number, number][] = slice.map((s) => [
            s.ts,
            parseFloat(((s[cfg.metricKey] as number) / divisor).toFixed(dp)),
          ]);
          const currentRaw = latest
            ? (latest[cfg.metricKey] as number) / divisor
            : 0;
          const currentValue = currentRaw.toFixed(dp);

          return (
            <MiniChart
              key={cfg.id}
              chartId={`${cfg.id}-${range}`}
              label={t(`twin.charts.${cfg.id}`)}
              unit={cfg.unit}
              color={cfg.color}
              data={chartData}
              currentValue={currentValue}
              timeMin={timeMin}
              timeMax={timeMax}
            />
          );
        })}
      </div>
    </div>
  );
}
