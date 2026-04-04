import { useTranslation } from "react-i18next";
import type {
  SystemZoneConfig,
  SystemZoneStatus,
} from "@/entities/train/model/config";
import {
  getSystemZoneStatus,
  getSystemZoneDisplayValue,
  SYSTEM_ZONE_STATUS_COLORS,
} from "@/entities/train/model/config";
import type { TelemetrySnapshot } from "@/entities/train/model/types";

const STATUS_ICON: Record<SystemZoneStatus, string> = {
  normal: "↑",
  warning: "↑",
  critical: "↑",
  low: "↓",
};

interface SystemCardProps {
  zone: SystemZoneConfig;
  snapshot: TelemetrySnapshot;
}

export function SystemCard({ zone, snapshot }: SystemCardProps) {
  const { t } = useTranslation();
  const rawValue = snapshot[zone.metricKey] as number;
  const status = getSystemZoneStatus(zone, rawValue);
  const displayValue = getSystemZoneDisplayValue(zone, rawValue);
  const color = SYSTEM_ZONE_STATUS_COLORS[status];
  const statusLabel = t(`twin.zoneStatus.${zone.id}.${status}`);

  return (
    <div
      className="flex flex-col gap-1 p-3 rounded-xl border transition-all"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor:
          status === "normal" ? "var(--border-subtle)" : `${color}30`,
        boxShadow:
          status === "normal"
            ? "var(--card-shadow)"
            : `0 0 12px ${color}12, var(--card-shadow)`,
        minWidth: 120,
      }}
    >
      <span
        className="text-[9px] font-bold tracking-widest uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {t(`twin.zones.${zone.id}`)}
      </span>

      <div className="flex items-baseline gap-1">
        <span
          className="text-xl font-bold font-mono leading-none"
          style={{ color: "var(--text-primary)" }}
        >
          {displayValue}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {zone.unit}
        </span>
      </div>

      <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
        {t(`twin.zoneMetric.${zone.id}`)}
      </span>

      <div className="flex items-center gap-1 mt-0.5">
        <div
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[10px] font-semibold" style={{ color }}>
          {STATUS_ICON[status]} {statusLabel}
        </span>
      </div>
    </div>
  );
}
