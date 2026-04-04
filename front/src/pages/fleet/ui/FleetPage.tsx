import { AppShell } from '@/widgets/app-shell/ui/AppShell'
import { FleetOverviewPanel } from '@/widgets/fleet-overview/ui/FleetOverviewPanel'
import { FleetMap } from '@/widgets/fleet-map/ui/FleetMap'
import { PriorityFeed } from '@/widgets/priority-feed/ui/PriorityFeed'
import { NetworkStatusOverlay } from '@/widgets/fleet-map/ui/NetworkStatusOverlay'
import { WeatherOverlay } from '@/widgets/fleet-map/ui/WeatherOverlay'

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
  )
}

export function FleetPage() {
  return (
    <AppShell
      leftPanel={<FleetOverviewPanel />}
      main={<MapWithOverlays />}
      rightPanel={<PriorityFeed />}
    />
  )
}
