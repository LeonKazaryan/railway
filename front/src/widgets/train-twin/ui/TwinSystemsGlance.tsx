import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type {
  TelemetrySnapshot,
  TrainModel,
} from "@/entities/train/model/types";
import { SYSTEM_ZONE_CONFIG } from "@/entities/train/model/config";
import { getSystemZoneAnchors } from "@/entities/train/model/systemZoneAnchors";
import type { SystemZoneId } from "@/entities/train/model/systemZoneAnchors";
import { SystemCard } from "./SystemCard";
import { TrainImageView } from "./TrainImageView";
import { TwinLeaderOverlaySvg, useTwinLeaderLines } from "./TwinSystemLeaderLines";

const LEFT_ZONES: SystemZoneId[] = ["engine", "electrical"];
const RIGHT_ZONES: SystemZoneId[] = ["air", "brakes"];
const BOTTOM_ZONES: SystemZoneId[] = ["traction", "bogies"];

interface TwinSystemsGlanceProps {
  snapshot: TelemetrySnapshot;
  model: TrainModel;
  parameterZones: Record<string, "green" | "yellow" | "red"> | null;
}

export function TwinSystemsGlance({ snapshot, model, parameterZones }: TwinSystemsGlanceProps) {
  const { t } = useTranslation();
  const zoneMap = Object.fromEntries(SYSTEM_ZONE_CONFIG.map((z) => [z.id, z]));

  const diagramRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const zoneRefs = useRef<Partial<Record<SystemZoneId, HTMLDivElement | null>>>(
    {},
  );

  const setZoneRef = (id: SystemZoneId) => (el: HTMLDivElement | null) => {
    zoneRefs.current[id] = el;
  };

  const anchors = useMemo(() => getSystemZoneAnchors(model), [model]);

  const { lines, overlay } = useTwinLeaderLines({
    diagramRef,
    imageRef,
    zoneRefs,
    anchors,
    snapshot,
    zoneConfigs: SYSTEM_ZONE_CONFIG,
    parameterZones: parameterZones ?? null,
  });

  return (
    <div className="flex flex-col gap-3">
      <span
        className="text-[9px] font-bold tracking-widest uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        {t("twin.systemsGlance")}
      </span>

      <div ref={diagramRef} className="relative overflow-visible">
        <div className="flex items-stretch gap-3 relative z-10">
          <div className="flex flex-col gap-2 justify-center">
            {LEFT_ZONES.map((id) => (
              <div key={id} ref={setZoneRef(id)}>
                <SystemCard zone={zoneMap[id]} snapshot={snapshot} parameterZones={parameterZones} />
              </div>
            ))}
          </div>

          <div className="flex flex-col flex-1 min-w-0 gap-2 relative z-0">
            <TrainImageView ref={imageRef} model={model}>
              <TwinLeaderOverlaySvg lines={lines} overlay={overlay} />
            </TrainImageView>
            <div className="flex gap-2 justify-center">
              {BOTTOM_ZONES.map((id) => (
                <div key={id} ref={setZoneRef(id)}>
                  <SystemCard zone={zoneMap[id]} snapshot={snapshot} parameterZones={parameterZones} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 justify-center">
            {RIGHT_ZONES.map((id) => (
              <div key={id} ref={setZoneRef(id)}>
                <SystemCard zone={zoneMap[id]} snapshot={snapshot} parameterZones={parameterZones} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
