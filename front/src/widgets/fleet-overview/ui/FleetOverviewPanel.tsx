import { useTranslation } from "react-i18next";
import { TrendingUp, ChevronRight, Activity } from "lucide-react";
import { useFleetStats } from "@/features/fleet-live/model/store";
import { FleetHealthGauge } from "./FleetHealthGauge";
import { LiveSparkline } from "./LiveSparkline";
import { TopRiskTrains } from "./TopRiskTrains";
import { RecentEvents } from "./RecentEvents";

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <span
        className="text-[10px] font-bold tracking-wider uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </span>
      <ChevronRight size={11} style={{ color: "var(--text-muted)" }} />
    </div>
  );
}

export function FleetOverviewPanel() {
  const { t } = useTranslation();
  const stats = useFleetStats();

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

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-3 py-2 border-b"
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
        className="px-3 py-3 border-b"
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
                {t("fleetOverview.live")}
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
        className="px-3 py-3 border-b"
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

      <div className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <SectionHeader title={t("fleetOverview.topRiskTrains")} />
        <div className="px-1 py-1">
          <TopRiskTrains />
        </div>
      </div>

      <div className="flex-1">
        <SectionHeader title={t("fleetOverview.recentEvents")} />
        <div className="px-1 py-1">
          <RecentEvents />
        </div>
      </div>
    </div>
  );
}
