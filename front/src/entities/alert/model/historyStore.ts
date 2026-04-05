import { create } from "zustand";

export interface AlertHistoryItem {
  id: string;
  locomotiveId: string;
  trainId: string | null;
  code: string;
  severity: string;
  title: string;
  message: string;
  ts: string;
}

const MAX_PER_TRAIN = 10;
let seq = 0;

export const EMPTY_ALERT_HISTORY: AlertHistoryItem[] = [];

interface AlertHistoryState {
  byTrain: Map<string, AlertHistoryItem[]>;
  push: (item: Omit<AlertHistoryItem, "id">) => void;
  getForTrain: (locomotiveId: string) => AlertHistoryItem[];
}

export const useAlertHistoryStore = create<AlertHistoryState>((set, get) => ({
  byTrain: new Map(),
  push: (item) =>
    set((state) => {
      const key = item.locomotiveId;
      const entry: AlertHistoryItem = { ...item, id: `ah-${++seq}` };
      const prev = state.byTrain.get(key) ?? EMPTY_ALERT_HISTORY;
      const next = new Map(state.byTrain);
      next.set(key, [entry, ...prev].slice(0, MAX_PER_TRAIN));
      return { byTrain: next };
    }),
  getForTrain: (locomotiveId) =>
    get().byTrain.get(locomotiveId) ?? EMPTY_ALERT_HISTORY,
}));
