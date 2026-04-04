import { ExternalLink, AlertTriangle, Info, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Alert } from "@/entities/alert/model/types";

const ALERT_SEVERITY_STYLE = {
  critical: { color: "#f43f5e", bgColor: "rgba(244,63,94,0.12)" },
  warning: { color: "#f59e0b", bgColor: "rgba(245,158,11,0.10)" },
  info: { color: "#38bdf8", bgColor: "rgba(56,189,248,0.08)" },
} as const;
import { cn } from "@/shared/lib/cn";

const SEVERITY_ICONS = {
  critical: Zap,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_LABEL_KEYS = {
  critical: "alerts.severityCritical" as const,
  warning: "alerts.severityWarning" as const,
  info: "alerts.severityInfo" as const,
};

interface AlertCardProps {
  alert: Alert;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export function AlertCard({ alert, isSelected, onSelect }: AlertCardProps) {
  const { t } = useTranslation();
  const cfg = ALERT_SEVERITY_STYLE[alert.severity];
  const Icon = SEVERITY_ICONS[alert.severity];
  const description = t(`alerts.mock.${alert.messageKey}.description`);
  const suggested = t(`alerts.mock.${alert.messageKey}.suggested`);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(alert.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.(alert.id);
      }}
      className={cn(
        "relative flex gap-2 p-2.5 rounded-lg cursor-pointer transition-all border",
        isSelected && "border-[var(--border-accent)]",
      )}
      style={{
        backgroundColor: isSelected ? cfg.bgColor : "transparent",
        borderColor: isSelected ? cfg.color + "40" : "var(--border-subtle)",
      }}
    >
      <div
        className="w-0.5 rounded-full shrink-0 self-stretch"
        style={{ backgroundColor: cfg.color }}
      />

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <Icon size={11} style={{ color: cfg.color }} />
            <span
              className="text-[9px] font-bold tracking-wider uppercase"
              style={{ color: cfg.color }}
            >
              {t(SEVERITY_LABEL_KEYS[alert.severity])}
            </span>
            {alert.minutesAgo > 0 && (
              <span
                className="text-[9px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                {t("alerts.minutesShort", { count: alert.minutesAgo })}
              </span>
            )}
          </div>
          {alert.isNew && (
            <span
              className="text-[8px] font-bold px-1 py-0.5 rounded"
              style={{ backgroundColor: cfg.color + "20", color: cfg.color }}
            >
              {t("alerts.new")}
            </span>
          )}
        </div>

        <div
          className="text-xs font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {alert.trainId}
        </div>

        <div
          className="text-[10px] leading-tight"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </div>

        {suggested ? (
          <div
            className="text-[9px] leading-tight mt-0.5"
            style={{ color: "var(--text-muted)" }}
          >
            {t("alerts.suggestedLine", { action: suggested })}
          </div>
        ) : null}

        {alert.severity !== "info" && (
          <button
            type="button"
            className="mt-1 flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded self-start transition-all hover:opacity-80"
            style={{
              backgroundColor: cfg.color + "18",
              color: cfg.color,
              border: `1px solid ${cfg.color}30`,
            }}
          >
            <ExternalLink size={9} />
            {t("alerts.openTwin")}
          </button>
        )}
      </div>
    </div>
  );
}
