import { create } from "zustand";
import type { TelemetrySnapshot } from "@/entities/train/model/types";

const MAX_HISTORY_AGE_MS = 4 * 60 * 60 * 1000;
const MAX_HISTORY_POINTS = 50000;

interface TelemetryHistoryState {
  byLocomotive: Map<string, TelemetrySnapshot[]>;
  _appendPoint: (locomotiveId: string, point: TelemetrySnapshot) => void;
}

export const useTelemetryHistoryStore = create<TelemetryHistoryState>((set) => ({
  byLocomotive: new Map(),
  _appendPoint: (locomotiveId, point) => {
    set((state) => {
      const prev = state.byLocomotive.get(locomotiveId) ?? [];
      const buf = [...prev, point];
      const wall = Date.now();
      const horizon = wall - MAX_HISTORY_AGE_MS;
      let start = 0;
      while (start < buf.length && buf[start].ts < horizon) start += 1;
      let trimmed = buf.slice(start);
      if (trimmed.length > MAX_HISTORY_POINTS) {
        trimmed = trimmed.slice(-MAX_HISTORY_POINTS);
      }
      const next = new Map(state.byLocomotive);
      next.set(locomotiveId, trimmed);
      return { byLocomotive: next };
    });
  },
}));

const EMPTY_HISTORY: TelemetrySnapshot[] = [];

export function selectTelemetryHistory(
  byLocomotive: Map<string, TelemetrySnapshot[]>,
  locomotiveId: string | undefined,
  fallbackKey: string,
): TelemetrySnapshot[] {
  if (locomotiveId && byLocomotive.has(locomotiveId)) {
    return byLocomotive.get(locomotiveId)!;
  }
  return byLocomotive.get(fallbackKey) ?? EMPTY_HISTORY;
}
