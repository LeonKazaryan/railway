import { create } from "zustand";

export type TopNavTab = "fleet" | "trainList";

interface NavState {
  activeTab: TopNavTab;
  setActiveTab: (tab: TopNavTab) => void;
}

export const useNavStore = create<NavState>((set) => ({
  activeTab: "fleet",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
