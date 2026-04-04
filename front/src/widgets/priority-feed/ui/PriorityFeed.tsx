import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, ChevronRight } from "lucide-react";
import { useFleetLiveStore } from "@/features/fleet-live/model/store";
import type { Alert, AlertSeverity } from "@/entities/alert/model/types";
import { AlertCard } from "./AlertCard";

function deriveAlerts(
  trains: Map<string, { locomotiveId: string; trainId: string | null; ts: string; healthIndex: number | null; faultCodes: string[] | null; commState: string | null; alarmStatus: string | null }>,
): Alert[] {
  const alerts: Alert[] = [];
  let idx = 0;

  for (const [, ws] of trains) {
    const h = ws.healthIndex ?? 100;
    const id = ws.trainId ?? ws.locomotiveId;
    const faults = ws.faultCodes ?? [];

    let severity: AlertSeverity = "info";
    if (ws.commState === "offline" || ws.commState === null) severity = "warning";
    else if (h < 50 || ws.alarmStatus === "critical") severity = "critical";
    else if (h < 75 || faults.length > 0 || ws.alarmStatus === "warning") severity = "warning";
    else continue;

    const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(ws.ts).getTime()) / 60000));

    alerts.push({
      id: `live-${idx++}`,
      trainId: id,
      severity,
      messageKey: faults[0] ?? severity,
      minutesAgo,
      time: new Date(ws.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isNew: minutesAgo < 2,
    });
  }

  alerts.sort((a, b) => {
    const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity];
  });

  return alerts;
}

export function PriorityFeed() {
  const { t } = useTranslation();
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const trains = useFleetLiveStore((s) => s.trains);
  const alerts = useMemo(() => deriveAlerts(trains), [trains]);

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
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
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
