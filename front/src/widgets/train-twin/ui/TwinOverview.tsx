import type { TelemetryBuffer } from "@/entities/train/model/types";
import type { TrainDetail } from "@/entities/train/model/types";
import { TwinMetricsBar } from "./TwinMetricsBar";
import { TwinSystemsGlance } from "./TwinSystemsGlance";
import { TwinTelemetryTimeline } from "./TwinTelemetryTimeline";

interface TwinOverviewProps {
  buffer: TelemetryBuffer;
  train: TrainDetail;
  parameterZones: Record<string, "green" | "yellow" | "red"> | null;
}

export function TwinOverview({ buffer, train, parameterZones }: TwinOverviewProps) {
  const { snapshot, history } = buffer;

  return (
    <div className="flex flex-col gap-4 p-5 min-w-0 overflow-y-auto flex-1">
      <TwinMetricsBar snapshot={snapshot} train={train} />
      <TwinSystemsGlance snapshot={snapshot} model={train.model} parameterZones={parameterZones} />
      <TwinTelemetryTimeline history={history} />
    </div>
  );
}
