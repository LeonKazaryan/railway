import type { TelemetryBuffer } from "@/entities/train/model/types";
import type { TrainDetail } from "@/entities/train/model/types";
import { TwinMetricsBar } from "./TwinMetricsBar";
import { TwinSystemsGlance } from "./TwinSystemsGlance";
import { TwinTelemetryTimeline } from "./TwinTelemetryTimeline";

interface TwinOverviewProps {
  buffer: TelemetryBuffer;
  train: TrainDetail;
}

export function TwinOverview({ buffer, train }: TwinOverviewProps) {
  const { snapshot, history } = buffer;

  return (
    <div className="flex flex-col gap-4 p-5 min-w-0 overflow-y-auto flex-1">
      <TwinMetricsBar snapshot={snapshot} train={train} />
      <TwinSystemsGlance snapshot={snapshot} model={train.model} />
      <TwinTelemetryTimeline history={history} />
    </div>
  );
}
