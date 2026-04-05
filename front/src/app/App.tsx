import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import { useAuthStore } from "@/features/auth/model/store";
import { startFleetLiveConnection } from "@/features/fleet-live/model/store";
import { FleetPage } from "@/pages/fleet";
import { TwinPage } from "@/pages/twin";
import { LoginPage } from "@/pages/login";
import { AlertToastContainer } from "@/widgets/alert-toast/ui/AlertToast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AppContent() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedTrainId = useTrainSelectionStore((s) => s.selectedTrainId);

  useEffect(() => {
    if (isAuthenticated) startFleetLiveConnection();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {selectedTrainId ? (
          <TwinPage key={`twin-${selectedTrainId}`} trainId={selectedTrainId} />
        ) : (
          <FleetPage key="fleet" />
        )}
      </AnimatePresence>
      <AlertToastContainer />
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
