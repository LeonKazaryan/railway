import { useTranslation } from "react-i18next";
import { useTopRiskTrains } from "@/features/fleet-live/model/store";
import { cn } from "@/shared/lib/cn";

function healthColor(score: number): string {
  if (score >= 90) return "var(--success)";
  if (score >= 70) return "var(--warning)";
  return "var(--danger)";
}

const STATUS_KEYS = new Set(["normal", "warning", "critical", "no_signal"]);

interface TopRiskTrainsProps {
  limit: number;
  onSelectTrain: (locomotiveId: string) => void;
}

export function TopRiskTrains({ limit, onSelectTrain }: TopRiskTrainsProps) {
  const { t } = useTranslation();
  const items = useTopRiskTrains(limit);

  function issueLabel(issue: string): string {
    if (STATUS_KEYS.has(issue)) {
      return t(`trainStatus.${issue as "normal" | "warning" | "critical" | "no_signal"}`);
    }
    return t(`faultCodes.${issue}`, { defaultValue: issue });
  }

  if (items.length === 0) {
    return (
      <div
        className="px-2 py-3 text-center text-[10px]"
        style={{ color: "var(--text-muted)" }}
      >
        —
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item, idx) => {
        const bar = healthColor(item.score);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTrain(item.id)}
            className="flex w-full items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-left hover:bg-[var(--bg-panel)] transition-colors"
          >
            <span
              className="text-xs font-mono w-4 text-center shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {idx + 1}
            </span>
            <div
              className="w-1 h-6 rounded-full shrink-0"
              style={{ backgroundColor: bar }}
            />
            <div className="flex-1 min-w-0">
              <div
                className="text-xs font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {item.label}
              </div>
              <div
                className="text-[10px] truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {issueLabel(String(item.issue))}
              </div>
            </div>
            <div
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0",
              )}
              style={{
                backgroundColor: `${bar}18`,
                color: bar,
                border: `1px solid ${bar}30`,
              }}
            >
              {item.score}
            </div>
          </button>
        );
      })}
    </div>
  );
}
