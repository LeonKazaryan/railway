import { useEffect, useLayoutEffect, useRef, useMemo, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MapPin,
  Navigation2,
  Clock,
  Gauge,
  Zap,
  LocateFixed,
  Route,
  Timer,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MAP_STYLE_SATELLITE } from "@/shared/config/map.config";
import { deriveTrainStatus, formatTrainRoute } from "@/features/fleet-live/model/store";
import type { WsTrainState } from "@/features/fleet-live/model/store";
import type { TelemetrySnapshot } from "@/entities/train/model/types";
import { TRAIN_STATUS_CONFIG } from "@/entities/train/model/config";

const ROUTE_SOURCE = "twin-route-line";
const ROUTE_COVERED_LAYER = "twin-route-covered";
const ROUTE_REMAINING_LAYER = "twin-route-remaining";
const ROUTE_GLOW_LAYER = "twin-route-glow";

function haversinKm(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface RouteProgress {
  totalKm: number;
  coveredKm: number;
  remainingKm: number;
  splitIdx: number;
}

function computeRouteProgress(
  coords: [number, number][],
  curLng: number,
  curLat: number,
): RouteProgress {
  if (!coords || coords.length < 2) {
    return { totalKm: 0, coveredKm: 0, remainingKm: 0, splitIdx: 0 };
  }

  let nearestIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const midLng = (coords[i][0] + coords[i + 1][0]) / 2;
    const midLat = (coords[i][1] + coords[i + 1][1]) / 2;
    const d = haversinKm(curLng, curLat, midLng, midLat);
    if (d < minDist) {
      minDist = d;
      nearestIdx = i;
    }
  }

  let totalKm = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    totalKm += haversinKm(
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1],
    );
  }

  let remainingKm = 0;
  for (let i = nearestIdx; i < coords.length - 1; i++) {
    remainingKm += haversinKm(
      coords[i][0],
      coords[i][1],
      coords[i + 1][0],
      coords[i + 1][1],
    );
  }

  return {
    totalKm,
    coveredKm: totalKm - remainingKm,
    remainingKm,
    splitIdx: nearestIdx,
  };
}

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildBounds(
  coords: [number, number][],
  curLng: number,
  curLat: number,
): maplibregl.LngLatBoundsLike | null {
  const pts = [...coords, [curLng, curLat] as [number, number]];
  if (pts.length === 0) return null;
  let minLng = pts[0][0],
    maxLng = pts[0][0],
    minLat = pts[0][1],
    maxLat = pts[0][1];
  for (const [lng, lat] of pts) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function createPulseMarkerEl(color: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;";

  const ring = document.createElement("div");
  ring.style.cssText = `
    position:absolute;
    inset:-6px;
    border-radius:50%;
    border:2px solid ${color};
    opacity:0;
    animation:twin-route-pulse 2s ease-out infinite;
  `;

  const dot = document.createElement("div");
  dot.style.cssText = `
    width:14px;
    height:14px;
    border-radius:50%;
    background:${color};
    border:2.5px solid rgba(255,255,255,0.9);
    box-shadow:0 0 10px ${color}90;
    position:relative;
    z-index:1;
  `;

  wrapper.appendChild(ring);
  wrapper.appendChild(dot);
  return wrapper;
}

function injectPulseKeyframes() {
  if (document.getElementById("twin-route-pulse-style")) return;
  const style = document.createElement("style");
  style.id = "twin-route-pulse-style";
  style.textContent = `
    @keyframes twin-route-pulse {
      0%   { transform: scale(0.8); opacity: 0.8; }
      70%  { transform: scale(2.0); opacity: 0;   }
      100% { transform: scale(2.0); opacity: 0;   }
    }
  `;
  document.head.appendChild(style);
}

function scheduleMapResize(map: maplibregl.Map) {
  const run = () => {
    map.resize();
  };
  run();
  requestAnimationFrame(run);
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}

export interface TwinRouteProps {
  ws: WsTrainState | undefined;
  snapshot: TelemetrySnapshot;
}

interface StatRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  color?: string;
}

function StatRow({ icon, label, value, sub, accent, color }: StatRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="shrink-0 mt-0.5"
        style={{ color: accent ? color ?? "var(--accent-primary)" : "var(--text-muted)" }}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className="text-[9px] font-bold tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
        <span
          className="text-sm font-bold font-mono leading-snug"
          style={{ color: color ?? "var(--text-primary)" }}
        >
          {value}
        </span>
        {sub && (
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="w-full h-px"
      style={{ backgroundColor: "var(--border-subtle)" }}
    />
  );
}

export function TwinRoute({ ws, snapshot }: TwinRouteProps) {
  const { t } = useTranslation();
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const startMarkerRef = useRef<maplibregl.Marker | null>(null);
  const endMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const curLng = ws?.lon ?? 0;
  const curLat = ws?.lat ?? 0;
  const coords = ws?.routePathCoordinates ?? null;
  const status = ws ? deriveTrainStatus(ws) : "normal";
  const statusColor = TRAIN_STATUS_CONFIG[status].color;

  const progress = useMemo(
    () =>
      coords && coords.length >= 2
        ? computeRouteProgress(coords, curLng, curLat)
        : null,
    [coords, curLng, curLat],
  );

  const eta = useMemo(() => {
    if (!progress || snapshot.speed_kph < 2) return null;
    const hoursLeft = progress.remainingKm / snapshot.speed_kph;
    return new Date(Date.now() + hoursLeft * 3600 * 1000);
  }, [progress, snapshot.speed_kph]);

  const elapsed = useMemo(() => {
    if (!ws?.trainRunStartedAt) return null;
    return Date.now() - new Date(ws.trainRunStartedAt).getTime();
  }, [ws?.trainRunStartedAt]);

  const routeName = ws ? formatTrainRoute(ws) : "";

  useLayoutEffect(() => {
    injectPulseKeyframes();
    const wrap = mapWrapRef.current;
    const container = mapContainerRef.current;
    if (!wrap || !container) return;

    let destroyed = false;

    const mountMap = () => {
      if (destroyed || mapRef.current) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 48 || h < 48) return;

      const map = new maplibregl.Map({
        container,
        style: MAP_STYLE_SATELLITE,
        center: [curLng || 67.5, curLat || 48.0],
        zoom: 8,
        interactive: false,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        if (destroyed) return;
        map.setProjection({ type: "mercator" });

        map.addSource(ROUTE_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: ROUTE_GLOW_LAYER,
          type: "line",
          source: ROUTE_SOURCE,
          filter: ["==", ["get", "part"], "remaining"],
          paint: {
            "line-color": "#22d3a0",
            "line-width": 10,
            "line-opacity": 0.18,
            "line-blur": 4,
          },
        });

        map.addLayer({
          id: ROUTE_COVERED_LAYER,
          type: "line",
          source: ROUTE_SOURCE,
          filter: ["==", ["get", "part"], "covered"],
          paint: {
            "line-color": "rgba(255,255,255,0.35)",
            "line-width": 2.5,
            "line-dasharray": [4, 3],
          },
        });

        map.addLayer({
          id: ROUTE_REMAINING_LAYER,
          type: "line",
          source: ROUTE_SOURCE,
          filter: ["==", ["get", "part"], "remaining"],
          paint: {
            "line-color": "#22d3a0",
            "line-width": 3,
            "line-opacity": 0.95,
          },
        });

        const trainEl = createPulseMarkerEl(statusColor);
        const trainMarker = new maplibregl.Marker({ element: trainEl, anchor: "center" })
          .setLngLat([curLng, curLat])
          .addTo(map);
        markerRef.current = trainMarker;

        if (coords && coords.length >= 2) {
          const firstCoord = coords[0];
          const lastCoord = coords[coords.length - 1];

          const startEl = document.createElement("div");
          startEl.style.cssText = `
            width:10px;height:10px;border-radius:50%;
            background:rgba(255,255,255,0.85);
            border:2px solid rgba(255,255,255,0.5);
            box-shadow:0 0 6px rgba(0,0,0,0.5);
          `;
          new maplibregl.Marker({ element: startEl, anchor: "center" })
            .setLngLat([firstCoord[0], firstCoord[1]])
            .addTo(map);

          const endEl = document.createElement("div");
          endEl.style.cssText = `
            width:12px;height:12px;border-radius:50%;
            background:#22d3a0;
            border:2px solid rgba(255,255,255,0.8);
            box-shadow:0 0 8px #22d3a060;
          `;
          new maplibregl.Marker({ element: endEl, anchor: "center" })
            .setLngLat([lastCoord[0], lastCoord[1]])
            .addTo(map);
        }

        setMapReady(true);
        scheduleMapResize(map);
      });
    };

    const ro = new ResizeObserver(() => {
      const map = mapRef.current;
      if (map) {
        scheduleMapResize(map);
        return;
      }
      mountMap();
    });

    ro.observe(wrap);
    mountMap();

    return () => {
      destroyed = true;
      ro.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      startMarkerRef.current = null;
      endMarkerRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current?.isStyleLoaded()) return;
    const map = mapRef.current;

    const src = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!src || !coords || coords.length < 2) return;

    const splitIdx = progress?.splitIdx ?? 0;
    const features: GeoJSON.Feature[] = [];

    if (splitIdx > 0) {
      features.push({
        type: "Feature",
        properties: { part: "covered" },
        geometry: { type: "LineString", coordinates: coords.slice(0, splitIdx + 1) },
      });
    }

    features.push({
      type: "Feature",
      properties: { part: "remaining" },
      geometry: { type: "LineString", coordinates: coords.slice(splitIdx) },
    });

    src.setData({ type: "FeatureCollection", features });

    const bounds = buildBounds(coords, curLng, curLat);
    if (bounds) {
      map.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 10 });
    }
    scheduleMapResize(map);
  }, [mapReady, coords, progress?.splitIdx, curLng, curLat]);

  useEffect(() => {
    if (markerRef.current && curLng !== 0 && curLat !== 0) {
      markerRef.current.setLngLat([curLng, curLat]);
    }
  }, [curLng, curLat]);

  const progressPct =
    progress && progress.totalKm > 0
      ? Math.round((progress.coveredKm / progress.totalKm) * 100)
      : 0;

  const fuelReserveL = Math.round((snapshot.fuel_level_pct / 100) * 4000);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
      <div
        ref={mapWrapRef}
        className="relative flex h-full min-h-[240px] w-full min-w-0 flex-1 basis-0"
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        <div
          ref={mapContainerRef}
          className="absolute inset-0 min-h-0 w-full"
          style={{ borderRight: "1px solid var(--border-subtle)" }}
        />

        {coords && coords.length >= 2 && ws?.originStation && ws?.destinationStation && (
          <div
            className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold pointer-events-none"
            style={{
              backgroundColor: "rgba(10,13,20,0.75)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.55)" }}>{ws.originStation}</span>
            <span style={{ color: "rgba(255,255,255,0.35)" }}>→</span>
            <span style={{ color: "#22d3a0" }}>{ws.destinationStation}</span>
          </div>
        )}

        <style>{`
          .maplibregl-ctrl-attrib { display: none !important; }
        `}</style>
      </div>

      <aside
        className="w-full shrink-0 flex flex-col overflow-y-auto border-t min-h-0 border-[var(--border-subtle)] md:h-full md:w-72 md:border-t-0 md:border-l"
        style={{
          backgroundColor: "var(--bg-elevated)",
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <Route size={14} style={{ color: "var(--accent-primary)" }} />
          <span
            className="text-[9px] font-bold tracking-widest uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            {t("twin.route.title")}
          </span>
        </div>

        <div className="flex flex-col gap-5 p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span
                className="text-[9px] font-bold tracking-widest uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                {t("twin.route.route")}
              </span>
            </div>
            {routeName ? (
              <span
                className="text-sm font-bold leading-snug"
                style={{ color: "var(--text-primary)" }}
              >
                {routeName}
              </span>
            ) : (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {t("twin.route.noRoute")}
              </span>
            )}

            {ws?.originStation && ws?.destinationStation && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex flex-col items-center gap-0.5">
                  <div
                    className="w-2 h-2 rounded-full border-2"
                    style={{ borderColor: "rgba(255,255,255,0.5)", backgroundColor: "transparent" }}
                  />
                  <div className="w-px flex-1 min-h-[20px]" style={{ backgroundColor: "var(--border-subtle)" }} />
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: "#22d3a0" }}
                  />
                </div>
                <div className="flex flex-col gap-3 flex-1 min-w-0">
                  <span
                    className="text-xs font-medium leading-tight truncate"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {ws.originStation}
                  </span>
                  <span
                    className="text-xs font-bold leading-tight truncate"
                    style={{ color: "#22d3a0" }}
                  >
                    {ws.destinationStation}
                  </span>
                </div>
              </div>
            )}
          </div>

          {progress && (
            <>
              <Divider />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span
                    className="text-[9px] font-bold tracking-widest uppercase"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("twin.route.progress")}
                  </span>
                  <span
                    className="text-xs font-bold font-mono"
                    style={{ color: "var(--accent-primary)" }}
                  >
                    {progressPct}%
                  </span>
                </div>

                <div
                  className="relative h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: "var(--border-subtle)" }}
                >
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progressPct}%`,
                      background: "linear-gradient(90deg, #22d3a090, #22d3a0)",
                    }}
                  />
                </div>

                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
                    {progress.coveredKm.toFixed(0)} km
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
                    {progress.totalKm.toFixed(0)} km
                  </span>
                </div>
              </div>
            </>
          )}

          <Divider />

          <div className="flex flex-col gap-4">
            <StatRow
              icon={<Gauge size={14} />}
              label={t("twin.route.speed")}
              value={`${snapshot.speed_kph.toFixed(1)} km/h`}
              sub={`${t("twin.route.heading")} ${snapshot.heading_deg.toFixed(0)}°`}
            />

            {progress && (
              <StatRow
                icon={<LocateFixed size={14} />}
                label={t("twin.route.remaining")}
                value={`${progress.remainingKm.toFixed(0)} km`}
                sub={
                  eta
                    ? `${t("twin.route.eta")} ${formatTime(eta)}`
                    : t("twin.route.etaUnknown")
                }
                accent
              />
            )}

            {eta && snapshot.speed_kph >= 2 && progress && (
              <StatRow
                icon={<Clock size={14} />}
                label={t("twin.route.arrivalIn")}
                value={formatDuration(eta.getTime() - Date.now())}
                sub={`${t("twin.route.at")} ${formatTime(eta)}`}
              />
            )}

            {elapsed !== null && (
              <StatRow
                icon={<Timer size={14} />}
                label={t("twin.route.elapsed")}
                value={formatDuration(elapsed)}
                sub={
                  ws?.trainRunStartedAt
                    ? `${t("twin.route.since")} ${formatTime(new Date(ws.trainRunStartedAt))}`
                    : undefined
                }
              />
            )}
          </div>

          <Divider />

          <div className="flex flex-col gap-4">
            <span
              className="text-[9px] font-bold tracking-widest uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              {t("twin.route.telemetry")}
            </span>

            <StatRow
              icon={<Navigation2 size={14} />}
              label={t("twin.route.position")}
              value={`${(ws?.lat ?? 0).toFixed(4)}° N`}
              sub={`${(ws?.lon ?? 0).toFixed(4)}° E`}
            />

            <StatRow
              icon={<Zap size={14} />}
              label={t("twin.route.fuel")}
              value={`${snapshot.fuel_level_pct.toFixed(0)}%`}
              sub={`~${fuelReserveL.toLocaleString()} L · ${snapshot.fuel_consumption_rate.toFixed(0)} l/h`}
              accent={snapshot.fuel_level_pct < 25}
              color={snapshot.fuel_level_pct < 10 ? "#f43f5e" : snapshot.fuel_level_pct < 25 ? "#f59e0b" : undefined}
            />

            <StatRow
              icon={<MapPin size={14} />}
              label={t("twin.route.health")}
              value={`${snapshot.health_index} / 100`}
              accent={snapshot.health_index < 80}
              color={
                snapshot.health_index < 60
                  ? "#f43f5e"
                  : snapshot.health_index < 80
                    ? "#f59e0b"
                    : "#22d3a0"
              }
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
