import { useTranslation } from "react-i18next";
import type {
  TelemetrySnapshot,
  TrainModel,
} from "@/entities/train/model/types";
import { SYSTEM_ZONE_CONFIG } from "@/entities/train/model/config";
import { SystemCard } from "./SystemCard";
import { TrainImageView } from "./TrainImageView";

const LEFT_ZONES = ["engine", "electrical"];
const RIGHT_ZONES = ["brakes", "air"];
const BOTTOM_ZONES = ["traction", "bogies"];

interface TwinSystemsGlanceProps {
  snapshot: TelemetrySnapshot;
  model: TrainModel;
}

export function TwinSystemsGlance({ snapshot, model }: TwinSystemsGlanceProps) {
  const { t } = useTranslation();
  const zoneMap = Object.fromEntries(SYSTEM_ZONE_CONFIG.map((z) => [z.id, z]));

  return (
    <div className="flex flex-col gap-3">
      <span
        className="text-[9px] font-bold tracking-widest uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {t("twin.systemsGlance")}
      </span>

      <div className="flex items-stretch gap-3">
        <div className="flex flex-col gap-2 justify-center">
          {LEFT_ZONES.map((id) => (
            <SystemCard key={id} zone={zoneMap[id]} snapshot={snapshot} />
          ))}
        </div>

        <div className="flex flex-col flex-1 min-w-0 gap-2">
          <TrainImageView model={model} />
          <div className="flex gap-2 justify-center">
            {BOTTOM_ZONES.map((id) => (
              <SystemCard key={id} zone={zoneMap[id]} snapshot={snapshot} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 justify-center">
          {RIGHT_ZONES.map((id) => (
            <SystemCard key={id} zone={zoneMap[id]} snapshot={snapshot} />
          ))}
        </div>
      </div>
    </div>
  );
}
