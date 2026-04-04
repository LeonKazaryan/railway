import { create } from 'zustand'

interface FleetLayoutState {
  priorityFeedOpen: boolean
  togglePriorityFeed: () => void
  setPriorityFeedOpen: (open: boolean) => void
}

export const useFleetLayoutStore = create<FleetLayoutState>((set) => ({
  priorityFeedOpen: true,
  togglePriorityFeed: () => set((s) => ({ priorityFeedOpen: !s.priorityFeedOpen })),
  setPriorityFeedOpen: (open) => set({ priorityFeedOpen: open }),
}))
