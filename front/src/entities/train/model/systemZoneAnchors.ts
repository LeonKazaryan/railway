import type { TrainModel } from "./types";

export type SystemZoneId =
  | "engine"
  | "electrical"
  | "traction"
  | "bogies"
  | "brakes"
  | "air";

export const DEFAULT_SYSTEM_ZONE_ANCHORS: Record<SystemZoneId, { x: number; y: number }> =
  {
    engine: { x: 0.44, y: 0.4 },
    electrical: { x: 0.27, y: 0.38 },
    traction: { x: 0.51, y: 0.5 },
    bogies: { x: 0.37, y: 0.82 },
    brakes: { x: 0.72, y: 0.76 },
    air: { x: 0.76, y: 0.3 },
  };

export const TRAIN_MODEL_ZONE_ANCHORS: Partial<
  Record<TrainModel, Partial<Record<SystemZoneId, { x: number; y: number }>>>
> = {};

export function getSystemZoneAnchors(
  model: TrainModel,
): Record<SystemZoneId, { x: number; y: number }> {
  const patch = TRAIN_MODEL_ZONE_ANCHORS[model];
  if (!patch) return { ...DEFAULT_SYSTEM_ZONE_ANCHORS };
  const result = { ...DEFAULT_SYSTEM_ZONE_ANCHORS };
  for (const id of Object.keys(patch) as SystemZoneId[]) {
    const p = patch[id];
    if (p) result[id] = { ...result[id], ...p };
  }
  return result;
}
