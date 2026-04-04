import { useTranslation } from "react-i18next";
import { MOCK_TOP_RISK_TRAINS } from "@/entities/train/model/mock";
import { cn } from "@/shared/lib/cn";

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return "var(--danger)";
  if (score >= 55) return "var(--warning)";
  return "var(--success)";
};

export function TopRiskTrains() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      {MOCK_TOP_RISK_TRAINS.map((item, idx) => (
        <div
          key={item.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--bg-panel)] transition-colors"
        >
          <span
            className="text-xs font-mono w-4 text-center"
            style={{ color: "var(--text-muted)" }}
          >
            {idx + 1}
          </span>
          <div
            className="w-1 h-6 rounded-full"
            style={{ backgroundColor: SCORE_COLOR(item.score) }}
          />
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {item.id}
            </div>
            <div
              className="text-[10px] truncate"
              style={{ color: "var(--text-muted)" }}
            >
              {t(`fleetOverview.risk.${item.issueKey}`)}
            </div>
          </div>
          <div
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0",
            )}
            style={{
              backgroundColor: `${SCORE_COLOR(item.score)}18`,
              color: SCORE_COLOR(item.score),
              border: `1px solid ${SCORE_COLOR(item.score)}30`,
            }}
          >
            {item.score}
          </div>
        </div>
      ))}
    </div>
  );
}
