import { AppShell } from "@/widgets/app-shell/ui/AppShell";
import { FleetOverviewPanel } from "@/widgets/fleet-overview/ui/FleetOverviewPanel";
import { FleetMap } from "@/widgets/fleet-map/ui/FleetMap";
import { PriorityFeed } from "@/widgets/priority-feed/ui/PriorityFeed";
import { NetworkStatusOverlay } from "@/widgets/fleet-map/ui/NetworkStatusOverlay";
import { WeatherOverlay } from "@/widgets/fleet-map/ui/WeatherOverlay";
import { TrainListPage } from "@/widgets/train-list/ui/TrainListPage";
import { useNavStore } from "@/features/nav/model/store";

function MapWithOverlays() {
  return (
    <div className="relative w-full h-full">
      <FleetMap />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-3 pointer-events-none">
        <div className="pointer-events-auto">
          <NetworkStatusOverlay />
        </div>
        <div className="pointer-events-auto">
          <WeatherOverlay />
        </div>
      </div>
    </div>
  );
}

export function FleetPage() {
  const activeTab = useNavStore((s) => s.activeTab);

  if (activeTab === "trainList") {
    return (
      <AppShell
        leftPanel={<FleetOverviewPanel />}
        main={<TrainListPage />}
        rightPanel={<PriorityFeed />}
      />
    );
  }

  return (
    <AppShell
      leftPanel={<FleetOverviewPanel />}
      main={<MapWithOverlays />}
      rightPanel={<PriorityFeed />}
    />
  );
}
