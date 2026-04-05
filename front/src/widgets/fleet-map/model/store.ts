import { create } from "zustand";

interface MapStore {
  mapCenter: { lat: number; lng: number } | null;
  setMapCenter: (center: { lat: number; lng: number }) => void;
}

export const useMapStore = create<MapStore>((set) => ({
  mapCenter: null,
  setMapCenter: (center) => set({ mapCenter: center }),
}));
