import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, ChevronRight } from "lucide-react";
import {
  useFleetTrainsMapDebounced,
  type WsTrainState,
} from "@/features/fleet-live/model/store";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import type { Alert, AlertSeverity } from "@/entities/alert/model/types";
import { AlertCard } from "./AlertCard";

const ZONE_LABELS: Record<string, string> = {
  engine_temp_c: "Engine temperature",
  oil_temp_c: "Oil temperature",
  brake_pipe_pressure_kpa: "Brake pipe pressure",
  main_reservoir_pressure_kpa: "Main reservoir pressure",
  brake_pipe_leak_kpa_per_min: "Brake pipe leak",
  current_a: "Electrical current",
  fuel_level_pct: "Fuel level",
  tractive_effort_kn: "Tractive effort",
  engine_rpm: "Engine RPM",
  comm_state: "Communication",
};

function deriveAlerts(trains: Map<string, WsTrainState>): Alert[] {
  const alerts: Alert[] = [];
  let idx = 0;

  for (const [, ws] of trains) {
    const id = ws.trainId ?? ws.locomotiveId;
    const zones = ws.parameterZones;
    const h = ws.healthIndex ?? 100;
    const minutesAgo = Math.max(
      0,
      Math.round((Date.now() - new Date(ws.ts).getTime()) / 60000),
    );
    const time = new Date(ws.ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const isNew = minutesAgo < 2;

    if (zones) {
      const redParams: string[] = [];
      const yellowParams: string[] = [];

      for (const [param, zone] of Object.entries(zones)) {
        if (zone === "red") redParams.push(param);
        else if (zone === "yellow") yellowParams.push(param);
      }

      if (redParams.length > 0) {
        const label = redParams.map((p) => ZONE_LABELS[p] ?? p).join(", ");
        alerts.push({
          id: `live-${idx++}`,
          trainId: id,
          severity: "critical",
          messageKey: redParams[0],
          minutesAgo,
          time,
          isNew,
          description: label,
        });
        continue;
      }

      if (yellowParams.length > 0) {
        const label = yellowParams.map((p) => ZONE_LABELS[p] ?? p).join(", ");
        alerts.push({
          id: `live-${idx++}`,
          trainId: id,
          severity: "warning",
          messageKey: yellowParams[0],
          minutesAgo,
          time,
          isNew,
          description: label,
        });
        continue;
      }
    }

    let severity: AlertSeverity = "info";
    if (ws.commState === "offline" || ws.commState === null) severity = "warning";
    else if (h < 70) severity = "critical";
    else if (h <= 90) severity = "warning";
    else continue;

    alerts.push({
      id: `live-${idx++}`,
      trainId: id,
      severity,
      messageKey: ws.faultCodes?.[0] ?? severity,
      minutesAgo,
      time,
      isNew,
    });
  }

  alerts.sort((a, b) => {
    const rank: Record<AlertSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    return rank[a.severity] - rank[b.severity];
  });

  return alerts;
}

export function PriorityFeed() {
  const { t } = useTranslation();
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const trains = useFleetTrainsMapDebounced();
  const alerts = useMemo(() => deriveAlerts(trains), [trains]);
  const navigate = useTrainSelectionStore((s) => s.setSelectedTrain);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--danger)" }}
          />
          <span
            className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            {t("priorityFeed.title")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded"
            style={{
              color: "var(--text-secondary)",
              backgroundColor: "var(--bg-panel)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <SlidersHorizontal size={9} />
            {t("priorityFeed.filter")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {t("priorityFeed.noAlerts", "No active alerts")}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 p-2">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                isSelected={selectedAlertId === alert.id}
                onSelect={(id) =>
                  setSelectedAlertId(id === selectedAlertId ? null : id)
                }
                onNavigate={() => navigate(alert.trainId)}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="px-3 py-2 border-t shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <button
          type="button"
          className="w-full flex items-center justify-center gap-1 text-[10px] font-semibold py-1.5 rounded-lg transition-all hover:opacity-80"
          style={{
            color: "var(--accent-primary)",
            backgroundColor: "rgba(56,189,248,0.08)",
            border: "1px solid rgba(56,189,248,0.2)",
          }}
        >
          {t("priorityFeed.viewAll")}
          <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}
