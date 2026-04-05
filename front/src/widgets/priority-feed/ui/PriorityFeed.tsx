import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
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

function formatMetaLine(ws: WsTrainState): string {
  const name = ws.trainId ?? ws.serialNumber ?? ws.locomotiveId;
  const from = ws.originStation?.trim();
  const to = ws.destinationStation?.trim();
  if (from && to) return `${name} (${from} — ${to})`;
  if (ws.lineName?.trim()) return `${name} (${ws.lineName.trim()})`;
  return name;
}

function deriveAlerts(trains: Map<string, WsTrainState>): Alert[] {
  const alerts: Alert[] = [];

  for (const [, ws] of trains) {
    const id = ws.locomotiveId;
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
    const tsMs = new Date(ws.ts).getTime();
    const metaLine = formatMetaLine(ws);

    if (zones) {
      const redParams: string[] = [];
      const yellowParams: string[] = [];

      for (const [param, zone] of Object.entries(zones)) {
        if (zone === "red") redParams.push(param);
        else if (zone === "yellow") yellowParams.push(param);
      }

      if (redParams.length > 0) {
        const zoneText = redParams.map((p) => ZONE_LABELS[p] ?? p).join(", ");
        alerts.push({
          id: `${id}-zones-red`,
          trainId: id,
          severity: "critical",
          messageKey: redParams[0],
          minutesAgo,
          time,
          isNew,
          tsMs,
          metaLine,
          faultCode: null,
          problemLine: zoneText,
          problemI18nKey: null,
        });
        continue;
      }

      if (yellowParams.length > 0) {
        const zoneText = yellowParams.map((p) => ZONE_LABELS[p] ?? p).join(", ");
        alerts.push({
          id: `${id}-zones-yellow`,
          trainId: id,
          severity: "warning",
          messageKey: yellowParams[0],
          minutesAgo,
          time,
          isNew,
          tsMs,
          metaLine,
          faultCode: null,
          problemLine: zoneText,
          problemI18nKey: null,
        });
        continue;
      }
    }

    let severity: AlertSeverity = "info";
    if (ws.commState === "offline" || ws.commState === null) severity = "warning";
    else if (h < 70) severity = "critical";
    else if (h <= 90) severity = "warning";
    else continue;

    const fault0 = ws.faultCodes?.[0] ?? null;
    if (fault0) {
      alerts.push({
        id: `${id}-status-${severity}-fault`,
        trainId: id,
        severity,
        messageKey: fault0,
        minutesAgo,
        time,
        isNew,
        tsMs,
        metaLine,
        faultCode: fault0,
        problemLine: "",
        problemI18nKey: null,
      });
      continue;
    }

    if (ws.commState === "offline" || ws.commState === null) {
      alerts.push({
        id: `${id}-status-warning-comm`,
        trainId: id,
        severity: "warning",
        messageKey: "no_signal",
        minutesAgo,
        time,
        isNew,
        tsMs,
        metaLine,
        faultCode: null,
        problemLine: "",
        problemI18nKey: "trainStatus.no_signal",
      });
      continue;
    }

    if (h < 70) {
      alerts.push({
        id: `${id}-status-critical-health`,
        trainId: id,
        severity: "critical",
        messageKey: "health",
        minutesAgo,
        time,
        isNew,
        tsMs,
        metaLine,
        faultCode: null,
        problemLine: "",
        problemI18nKey: "fleetOverview.statusCritical",
      });
      continue;
    }

    alerts.push({
      id: `${id}-status-warning-health`,
      trainId: id,
      severity: "warning",
      messageKey: "health",
      minutesAgo,
      time,
      isNew,
      tsMs,
      metaLine,
      faultCode: null,
      problemLine: "",
      problemI18nKey: "fleetOverview.statusWarning",
    });
  }

  alerts.sort((a, b) => {
    const secB = Math.floor(b.tsMs / 1000);
    const secA = Math.floor(a.tsMs / 1000);
    if (secB !== secA) return secB - secA;
    const t = b.tsMs - a.tsMs;
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
  return alerts;
}

type SeverityFilter = "all" | "critical" | "warning";

const FILTER_OPTIONS: { id: SeverityFilter; labelKey: string }[] = [
  { id: "all", labelKey: "priorityFeed.filterAll" },
  { id: "critical", labelKey: "priorityFeed.filterCritical" },
  { id: "warning", labelKey: "priorityFeed.filterWarning" },
];

export function PriorityFeed() {
  const { t } = useTranslation();
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const trains = useFleetTrainsMapDebounced();
  const alerts = useMemo(() => deriveAlerts(trains), [trains]);
  const visibleAlerts = useMemo(() => {
    if (severityFilter === "all") return alerts;
    return alerts.filter((a) => a.severity === severityFilter);
  }, [alerts, severityFilter]);
  const navigate = useTrainSelectionStore((s) => s.setSelectedTrain);

  useEffect(() => {
    setSelectedAlertId(null);
  }, [severityFilter]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="shrink-0 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: "var(--danger)" }}
          />
          <span
            className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: "var(--text-primary)" }}
          >
            {t("priorityFeed.title")}
          </span>
        </div>
        <div className="flex gap-0.5 px-2 pb-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSeverityFilter(opt.id)}
              className={cn(
                "flex-1 min-w-0 rounded-md px-1 py-1.5 text-[8px] font-semibold tracking-wide uppercase transition-colors",
                severityFilter === opt.id
                  ? "text-[var(--accent-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
              style={{
                backgroundColor:
                  severityFilter === opt.id
                    ? "var(--accent-soft)"
                    : "var(--bg-panel)",
                border:
                  severityFilter === opt.id
                    ? "1px solid rgba(56,189,248,0.35)"
                    : "1px solid var(--border-subtle)",
              }}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <motion.div className="flex-1 overflow-y-auto min-h-0" layoutScroll>
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span
              className="text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {t("priorityFeed.noAlerts")}
            </span>
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="flex items-center justify-center h-full px-3">
            <span
              className="text-[10px] text-center"
              style={{ color: "var(--text-muted)" }}
            >
              {t("priorityFeed.noAlertsForFilter")}
            </span>
          </div>
        ) : (
          <LayoutGroup id="priority-feed-alerts">
            <div className="flex flex-col gap-1.5 p-2 overflow-x-hidden">
              <AnimatePresence initial={false} mode="popLayout">
                {visibleAlerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{
                      x: 48,
                      opacity: 0,
                      transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] },
                    }}
                    transition={{
                      layout: { type: "spring", stiffness: 420, damping: 34 },
                      opacity: { duration: 0.2 },
                      y: { type: "spring", stiffness: 520, damping: 38 },
                    }}
                  >
                    <AlertCard
                      alert={alert}
                      isSelected={selectedAlertId === alert.id}
                      onSelect={(aid) =>
                        setSelectedAlertId(aid === selectedAlertId ? null : aid)
                      }
                      onNavigate={() => navigate(alert.trainId)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        )}
      </motion.div>

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
