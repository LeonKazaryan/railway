import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import { FleetPage } from "@/pages/fleet";
import { TwinPage } from "@/pages/twin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AppContent() {
  const selectedTrainId = useTrainSelectionStore((s) => s.selectedTrainId);

  return (
    <AnimatePresence mode="wait">
      {selectedTrainId ? (
        <TwinPage key={`twin-${selectedTrainId}`} trainId={selectedTrainId} />
      ) : (
        <FleetPage key="fleet" />
      )}
    </AnimatePresence>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
