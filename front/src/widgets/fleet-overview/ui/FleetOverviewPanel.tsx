import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { TrendingUp, Activity, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useFleetStats } from "@/features/fleet-live/model/store";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import { FleetHealthGauge } from "./FleetHealthGauge";
import { LiveSparkline } from "./LiveSparkline";
import { TopRiskTrains } from "./TopRiskTrains";
import { RecentEvents } from "./RecentEvents";
import { useFleetSidebarLimits } from "../lib/useFleetSidebarLimits";

type SidebarFocus = "default" | "risk" | "events";

function CollapsibleSectionHeader({
  title,
  expanded,
  onClick,
}: {
  title: string;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between w-full px-3 py-1.5 hover:opacity-90 transition-opacity"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <span
        className="text-[10px] font-bold tracking-wider uppercase text-left"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </span>
      <ChevronRight
        size={11}
        className={cn("shrink-0 transition-transform duration-200", expanded && "rotate-90")}
        style={{ color: "var(--text-muted)" }}
      />
    </button>
  );
}

export function FleetOverviewPanel() {
  const { t } = useTranslation();
  const stats = useFleetStats();
  const limits = useFleetSidebarLimits();
  const [focus, setFocus] = useState<SidebarFocus>("default");
  const setSelectedTrain = useTrainSelectionStore((s) => s.setSelectedTrain);

  const openTrain = useCallback(
    (locomotiveId: string) => {
      setSelectedTrain(locomotiveId);
    },
    [setSelectedTrain],
  );

  const statusRows = [
    {
      labelKey: "fleetOverview.statusNormal" as const,
      value: stats.normalCount,
      color: "var(--success)",
    },
    {
      labelKey: "fleetOverview.statusWarning" as const,
      value: stats.warningCount,
      color: "var(--warning)",
    },
    {
      labelKey: "fleetOverview.statusCritical" as const,
      value: stats.criticalCount,
      color: "var(--danger)",
    },
  ];

  const riskLimit = focus === "risk" ? 5 : limits.riskCollapsed;
  const eventsLimit =
    focus === "events" ? limits.eventsExpanded : limits.eventsCollapsed;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <span
          className="text-[10px] font-bold tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          {t("fleetOverview.title")}
        </span>
      </div>

      <div
        className="px-3 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-[9px] uppercase tracking-wider mb-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {t("fleetOverview.activeTrains")}
            </div>
            <div
              className="text-3xl font-bold font-mono leading-none"
              style={{ color: "var(--text-primary)" }}
            >
              {stats.activeTrains}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp size={10} style={{ color: "var(--success)" }} />
              <span
                className="text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                {t("fleetOverview.fromLastHour")}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div
              className="text-[9px] uppercase tracking-wider mb-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {t("fleetOverview.fleetHealth")}
            </div>
            <FleetHealthGauge score={stats.healthScore} />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          {statusRows.map(({ labelKey, value, color }) => (
            <div key={labelKey} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t(labelKey)}
                </span>
              </div>
              <span className="text-xs font-bold font-mono" style={{ color }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="px-3 py-3 border-b shrink-0"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Activity size={11} style={{ color: "var(--success)" }} />
            <span
              className="text-[9px] uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {t("fleetOverview.liveStream")}
            </span>
          </div>
          <span
            className="text-sm font-bold font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            {stats.liveStreamValue.toLocaleString()}
          </span>
        </div>
        <LiveSparkline />
      </div>

      <div
        className="flex flex-col flex-1 min-h-0 border-t"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {focus !== "events" && (
          <div
            className={cn(
              "flex flex-col border-b min-h-0",
              focus === "risk" ? "flex-1" : "shrink-0",
            )}
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <CollapsibleSectionHeader
              title={t("fleetOverview.topRiskTrains")}
              expanded={focus === "risk"}
              onClick={() =>
                setFocus((f) => (f === "risk" ? "default" : "risk"))
              }
            />
            <div
              className={cn(
                "px-1 py-1",
                focus === "risk" && "flex-1 overflow-y-auto min-h-0",
              )}
            >
              <TopRiskTrains limit={riskLimit} onSelectTrain={openTrain} />
            </div>
          </div>
        )}

        {focus !== "risk" && (
          <div className="flex flex-col flex-1 min-h-0">
            <CollapsibleSectionHeader
              title={t("fleetOverview.recentEvents")}
              expanded={focus === "events"}
              onClick={() =>
                setFocus((f) => (f === "events" ? "default" : "events"))
              }
            />
            <div className="flex-1 overflow-y-auto min-h-0 px-1 py-1">
              <RecentEvents limit={eventsLimit} onSelectTrain={openTrain} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
