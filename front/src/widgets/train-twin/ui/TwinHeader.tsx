import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/cn";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import type { TrainDetail } from "@/entities/train/model/types";
import { TWIN_TAB_KEYS, type TwinTab } from "@/shared/config/twin-tabs";

interface TwinHeaderProps {
  train: TrainDetail;
  activeTab: TwinTab;
  onTabChange: (tab: TwinTab) => void;
}

export function TwinHeader({ train, activeTab, onTabChange }: TwinHeaderProps) {
  const { t } = useTranslation();
  const setSelectedTrain = useTrainSelectionStore((s) => s.setSelectedTrain);

  return (
    <header
      className="flex items-center h-12 px-4 gap-6 border-b shrink-0"
      style={{
        backgroundColor: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <button
        type="button"
        onClick={() => setSelectedTrain(null)}
        className="flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--text-primary)] shrink-0"
        style={{ color: "var(--text-secondary)" }}
      >
        <ChevronLeft size={14} />
        {t("twin.backToFleet")}
      </button>

      <div
        className="w-px h-5 shrink-0"
        style={{ backgroundColor: "var(--border-subtle)" }}
      />

      <div className="flex items-center gap-3 min-w-0">
        <span
          className="text-base font-bold font-mono tracking-wide shrink-0"
          style={{ color: "var(--text-primary)" }}
        >
          {train.id}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {t(`trainModels.${train.model}`)}
        </span>
      </div>

      <nav className="flex items-center gap-1 ml-auto">
        {TWIN_TAB_KEYS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              "px-4 h-12 text-xs font-semibold tracking-wider transition-all border-b-2",
              activeTab === tab
                ? "border-b-[var(--accent-primary)] text-[var(--accent-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {t(`twin.tabs.${tab}`)}
          </button>
        ))}
      </nav>
    </header>
  );
}
