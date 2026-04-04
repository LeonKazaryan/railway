import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TelemetrySnapshot } from "@/entities/train/model/types";
import type { TrainDetail } from "@/entities/train/model/types";

const COMPASS_KEYS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;

function headingToCompassKey(deg: number): (typeof COMPASS_KEYS)[number] {
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return COMPASS_KEYS[idx];
}

interface MetricTileProps {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}

function MetricTile({ label, value, sub, mono }: MetricTileProps) {
  return (
    <div
      className="flex flex-col gap-0.5 px-4 border-r"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <span
        className="text-[9px] font-bold tracking-widest uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span
        className={`text-lg font-bold leading-none ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

interface TwinMetricsBarProps {
  snapshot: TelemetrySnapshot;
  train: TrainDetail;
}

export function TwinMetricsBar({ snapshot, train }: TwinMetricsBarProps) {
  const { t } = useTranslation();
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    setSecondsAgo(0);
    const id = setInterval(() => setSecondsAgo((s) => s + 0.1), 100);
    return () => clearInterval(id);
  }, [snapshot.ts]);

  const lat = snapshot.lat.toFixed(4);
  const lon = snapshot.lon.toFixed(4);
  const compassKey = headingToCompassKey(snapshot.heading_deg);
  const compass = t(`twin.compass.${compassKey}`);
  const modeLabel = t(`twin.modes.${train.mode}`, train.mode);

  return (
    <div
      className="flex items-stretch border rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-subtle)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <MetricTile
        label={t("twin.metrics.healthIndex")}
        value={String(snapshot.health_index)}
        sub="/ 100"
        mono
      />
      <MetricTile
        label={t("twin.metrics.speed")}
        value={snapshot.speed_kph.toFixed(0)}
        sub="km/h"
        mono
      />
      <MetricTile
        label={t("twin.metrics.location")}
        value={`${lat}° N`}
        sub={`${lon}° E`}
        mono
      />
      <MetricTile
        label={t("twin.metrics.direction")}
        value={compass}
        sub={`${snapshot.heading_deg.toFixed(0)}°`}
      />
      <MetricTile
        label={t("twin.metrics.lastUpdate")}
        value={`${secondsAgo.toFixed(1)}s`}
        sub={t("twin.metrics.ago")}
        mono
      />
      <div className="flex flex-col gap-0.5 px-4">
        <span
          className="text-[9px] font-bold tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          {t("twin.metrics.mode")}
        </span>
        <span
          className="text-sm font-bold tracking-wider px-2 py-0.5 rounded self-start"
          style={{
            backgroundColor: "rgba(56,189,248,0.12)",
            color: "var(--accent-primary)",
            border: "1px solid rgba(56,189,248,0.2)",
          }}
        >
          {modeLabel}
        </span>
      </div>
    </div>
  );
}
