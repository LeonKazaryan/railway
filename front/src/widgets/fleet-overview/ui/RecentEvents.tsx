import { useTranslation } from "react-i18next";
import { MOCK_RECENT_EVENTS } from "@/entities/train/model/mock";

const LEVEL_KEYS = {
  critical: "recentEvents.crit" as const,
  warning: "recentEvents.warn" as const,
  info: "recentEvents.info" as const,
};

export function RecentEvents() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      {MOCK_RECENT_EVENTS.map((event, idx) => {
        const color =
          event.level === "critical"
            ? "var(--danger)"
            : event.level === "warning"
              ? "var(--warning)"
              : "var(--info)";
        return (
          <div
            key={idx}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--bg-panel)] transition-colors"
          >
            <span
              className="text-[10px] font-mono tabular-nums w-10 shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {event.time}
            </span>
            <span
              className="text-xs font-semibold flex-1 truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {event.trainId}
            </span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{
                color,
                backgroundColor: `${color}15`,
              }}
            >
              {t(LEVEL_KEYS[event.level])}
            </span>
            {event.value ? (
              <span
                className="text-[10px] font-mono font-bold w-7 text-right"
                style={{ color }}
              >
                {event.value}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
