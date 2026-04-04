import { create } from 'zustand'

interface TrainSelectionState {
  selectedTrainId: string | null
  setSelectedTrain: (id: string | null) => void
}

export const useTrainSelectionStore = create<TrainSelectionState>((set) => ({
  selectedTrainId: null,
  setSelectedTrain: (id) => set({ selectedTrainId: id }),
}))
