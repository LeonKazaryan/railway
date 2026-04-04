import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { useLiveTelemetry } from "@/entities/train/hooks/useLiveTelemetry";
import {
  useFleetLiveStore,
  wsToTrain,
} from "@/features/fleet-live/model/store";
import type { TrainDetail, TrainMode } from "@/entities/train/model/types";
import { TwinHeader } from "@/widgets/train-twin/ui/TwinHeader";
import { TwinHealthGauge } from "@/widgets/train-twin/ui/TwinHealthGauge";
import { TwinOverview } from "@/widgets/train-twin/ui/TwinOverview";
import { TwinReplayBar } from "@/widgets/train-twin/ui/TwinReplayBar";
import type { TwinTab } from "@/shared/config/twin-tabs";

interface TwinPageProps {
  trainId: string;
}

function modeFromCurrentMode(cm: string | null): TrainMode {
  if (!cm) return "IDLE";
  const upper = cm.toUpperCase();
  if (upper.includes("HAUL") || upper.includes("CRUIS")) return "HAUL";
  if (upper.includes("BRAKE") || upper.includes("BRAK")) return "BRAKE";
  if (upper.includes("SHUNT") || upper.includes("SLOW")) return "SHUNT";
  if (upper.includes("IDLE") || upper.includes("STOP") || upper.includes("HOLD")) return "IDLE";
  return "HAUL";
}

export function TwinPage({ trainId }: TwinPageProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TwinTab>("overview");
  const buffer = useLiveTelemetry(trainId);

  const trains = useFleetLiveStore((s) => s.trains);
  let ws;
  for (const [, v] of trains) {
    if (v.trainId === trainId || v.locomotiveId === trainId) {
      ws = v;
      break;
    }
  }

  const baseTrain = ws ? wsToTrain(ws) : null;

  const trainDetail: TrainDetail = {
    id: trainId,
    label: baseTrain?.label ?? trainId,
    model: baseTrain?.model ?? "TE33A",
    status: baseTrain?.status ?? "normal",
    healthScore: baseTrain?.healthScore ?? 0,
    speed: baseTrain?.speed ?? 0,
    position: baseTrain?.position ?? { lng: 0, lat: 0 },
    route: baseTrain?.route ?? t("twin.unknownRoute"),
    lastSeen: baseTrain?.lastSeen ?? "--:--",
    serialNumber: ws?.serialNumber ?? "N/A",
    operatorName: "KTZ Express",
    mode: modeFromCurrentMode(ws?.currentMode ?? null),
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
            <TwinOverview
              buffer={buffer}
              train={trainDetail}
              parameterZones={ws?.parameterZones ?? null}
            />
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
