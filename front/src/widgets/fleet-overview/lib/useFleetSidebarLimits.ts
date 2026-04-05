import { useEffect, useState } from "react";

export interface FleetSidebarLimits {
  riskCollapsed: number;
  eventsCollapsed: number;
  eventsExpanded: number;
}

export function useFleetSidebarLimits(): FleetSidebarLimits {
  const [vh, setVh] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const riskCollapsed = vh < 720 ? 2 : vh < 920 ? 2 : 3;
  const eventsCollapsed = vh < 720 ? 2 : vh < 920 ? 3 : 4;
  const eventsExpanded = Math.min(
    16,
    Math.max(6, Math.floor((vh - 360) / 28)),
  );

  return { riskCollapsed, eventsCollapsed, eventsExpanded };
}
