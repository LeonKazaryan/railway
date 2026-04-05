import { create } from "zustand";

export interface AlertToastItem {
  id: string;
  locomotiveId: string;
  trainId: string | null;
  code: string;
  severity: string;
  title: string;
  message: string;
  ts: string;
  addedAt: number;
}

interface AlertToastState {
  toasts: AlertToastItem[];
  push: (item: Omit<AlertToastItem, "id" | "addedAt">) => void;
  dismiss: (id: string) => void;
}

const MAX_VISIBLE = 3;
let counter = 0;

export const useAlertToastStore = create<AlertToastState>((set) => ({
  toasts: [],
  push: (item) =>
    set((state) => {
      const toast: AlertToastItem = {
        ...item,
        id: `alert-toast-${++counter}`,
        addedAt: Date.now(),
      };
      const next = [toast, ...state.toasts].slice(0, MAX_VISIBLE);
      return { toasts: next };
    }),
  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
