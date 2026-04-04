import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { useLiveTelemetry } from "@/entities/train/hooks/useLiveTelemetry";
import { MOCK_TRAINS, MOCK_TRAIN_DETAIL } from "@/entities/train/model/mock";
import type { TrainDetail } from "@/entities/train/model/types";
import { TwinHeader } from "@/widgets/train-twin/ui/TwinHeader";
import { TwinHealthGauge } from "@/widgets/train-twin/ui/TwinHealthGauge";
import { TwinOverview } from "@/widgets/train-twin/ui/TwinOverview";
import { TwinReplayBar } from "@/widgets/train-twin/ui/TwinReplayBar";
import type { TwinTab } from "@/shared/config/twin-tabs";

interface TwinPageProps {
  trainId: string;
}

export function TwinPage({ trainId }: TwinPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TwinTab>("overview");
  const buffer = useLiveTelemetry(trainId);

  const baseTrain = MOCK_TRAINS.find((tr) => tr.id === trainId);
  const trainDetail: TrainDetail = MOCK_TRAIN_DETAIL[trainId] ?? {
    id: trainId,
    model: baseTrain?.model ?? "TE33A",
    status: baseTrain?.status ?? "normal",
    healthScore: baseTrain?.healthScore ?? 80,
    speed: baseTrain?.speed ?? 0,
    position: baseTrain?.position ?? { lng: 67.5, lat: 48.0 },
    route: baseTrain?.route ?? t("twin.unknownRoute"),
    lastSeen: baseTrain?.lastSeen ?? "--:--",
    serialNumber: "N/A",
    operatorName: "KTZ",
    mode: "IDLE",
    startedAt: "--:--",
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <TwinHeader
        train={trainDetail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside
          className="flex flex-col items-center justify-start pt-6 gap-4 border-r shrink-0"
          style={{
            width: 200,
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <TwinHealthGauge score={buffer.snapshot.health_index} />

          <div className="w-full px-4">
            <div
              className="w-full h-px"
              style={{ backgroundColor: "var(--border-subtle)" }}
            />
          </div>

          <div className="flex flex-col gap-3 px-4 w-full">
            {(
              [
                {
                  labelKey: "twin.sidebarSerial" as const,
                  value: trainDetail.serialNumber,
                },
                {
                  labelKey: "twin.sidebarOperator" as const,
                  value: trainDetail.operatorName,
                },
                {
                  labelKey: "twin.sidebarStarted" as const,
                  value: trainDetail.startedAt,
                },
                {
                  labelKey: "twin.sidebarRoute" as const,
                  value: trainDetail.route,
                },
              ] as const
            ).map(({ labelKey, value }) => (
              <div key={labelKey} className="flex flex-col gap-0.5">
                <span
                  className="text-[9px] font-bold tracking-widest uppercase"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t(labelKey)}
                </span>
                <span
                  className="text-[10px] font-medium leading-tight"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex flex-col flex-1 overflow-hidden">
          {activeTab === "overview" && (
            <TwinOverview buffer={buffer} train={trainDetail} />
          )}
          {activeTab !== "overview" && (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("twin.tabComingSoon", { tab: t(`twin.tabs.${activeTab}`) })}
              </span>
            </div>
          )}
          <TwinReplayBar />
        </main>
      </div>
    </motion.div>
  );
}
