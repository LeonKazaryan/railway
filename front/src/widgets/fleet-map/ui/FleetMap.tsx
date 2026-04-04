import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MAP_CONFIG,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
} from "@/shared/config/map.config";
import {
  useFleetLiveStore,
  wsToTrain,
} from "@/features/fleet-live/model/store";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import { useLocaleStore } from "@/features/locale/model/store";
import { useThemeStore } from "@/features/theme/model/store";
import type { AppTheme } from "@/features/theme/model/store";
import type { Train } from "@/entities/train/model/types";
import { KZ_RAIL_ROUTES } from "../config/routes";
import {
  createTrainMarkerElement,
  trainMarkerVisualKey,
} from "./TrainMarker";

const STATUS_LINE_COLORS: Record<string, string> = {
  normal: "#38bdf8",
  warning: "#f59e0b",
  critical: "#f43f5e",
};

const POS_EPS = 1e-7;

function mapStyleUrl(theme: AppTheme) {
  return theme === "light" ? MAP_STYLE_LIGHT : MAP_STYLE_DARK;
}

function addRouteLayers(map: maplibregl.Map) {
  KZ_RAIL_ROUTES.features.forEach((feature, idx) => {
    const status = (feature.properties?.status as string) ?? "normal";
    const sourceId = `route-${idx}`;
    const layerId = `route-line-${idx}`;

    map.addSource(sourceId, { type: "geojson", data: feature });

    map.addLayer({
      id: `${layerId}-glow`,
      type: "line",
      source: sourceId,
      paint: {
        "line-color":
          STATUS_LINE_COLORS[status] ?? STATUS_LINE_COLORS.normal,
        "line-width": 6,
        "line-opacity": 0.12,
        "line-blur": 4,
      },
    });

    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color":
          STATUS_LINE_COLORS[status] ?? STATUS_LINE_COLORS.normal,
        "line-width": 1.5,
        "line-opacity": 0.7,
      },
    });
  });
}

export function FleetMap() {
  const theme = useThemeStore((s) => s.theme);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const lastVisualKeyRef = useRef<Map<string, string>>(new Map());
  const lastPosRef = useRef<Map<string, { lng: number; lat: number }>>(
    new Map(),
  );
  const rafRef = useRef<number | null>(null);
  const skipThemeStyleOnce = useRef(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialTheme = useThemeStore.getState().theme;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyleUrl(initialTheme),
      center: MAP_CONFIG.center,
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    map.on("load", () => {
      const themeNow = useThemeStore.getState().theme;
      if (themeNow !== initialTheme) {
        map.setStyle(mapStyleUrl(themeNow));
        map.once("styledata", () => {
          if (!map.isStyleLoaded()) return;
          addRouteLayers(map);
        });
      } else {
        addRouteLayers(map);
      }
      setMapLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      lastVisualKeyRef.current.clear();
      lastPosRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current?.isStyleLoaded()) return;
    if (skipThemeStyleOnce.current) {
      skipThemeStyleOnce.current = false;
      return;
    }
    const map = mapRef.current;
    map.setStyle(mapStyleUrl(theme));
    map.once("styledata", () => {
      if (!map.isStyleLoaded()) return;
      addRouteLayers(map);
    });
  }, [theme, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const scheduleSync = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const trainsMap = useFleetLiveStore.getState().trains;
        const selectedId = useTrainSelectionStore.getState().selectedTrainId;
        const th = useThemeStore.getState().theme;
        const loc = useLocaleStore.getState().locale;

        const trains: Train[] = Array.from(trainsMap.values()).map(wsToTrain);
        const currentIds = new Set(trains.map((t) => t.id));

        markersRef.current.forEach((marker, id) => {
          if (!currentIds.has(id)) {
            marker.remove();
            markersRef.current.delete(id);
            lastVisualKeyRef.current.delete(id);
            lastPosRef.current.delete(id);
          }
        });

        for (const train of trains) {
          const lng = train.position.lng;
          const lat = train.position.lat;
          const pos: [number, number] = [lng, lat];
          const isSelected = selectedId === train.id;
          const vk = trainMarkerVisualKey(train, isSelected, th, loc);
          const existing = markersRef.current.get(train.id);

          if (!existing) {
            const el = createTrainMarkerElement(train, isSelected, th);
            el.addEventListener("click", () => {
              useTrainSelectionStore.getState().setSelectedTrain(train.id);
            });
            const marker = new maplibregl.Marker({
              element: el,
              anchor: "center",
            })
              .setLngLat(pos)
              .addTo(map);
            markersRef.current.set(train.id, marker);
            lastVisualKeyRef.current.set(train.id, vk);
            lastPosRef.current.set(train.id, { lng, lat });
            continue;
          }

          const prevPos = lastPosRef.current.get(train.id);
          const moved =
            !prevPos ||
            Math.abs(prevPos.lng - lng) > POS_EPS ||
            Math.abs(prevPos.lat - lat) > POS_EPS;
          if (moved) {
            existing.setLngLat(pos);
            lastPosRef.current.set(train.id, { lng, lat });
          }

          const prevVk = lastVisualKeyRef.current.get(train.id);
          if (prevVk === vk) continue;

          existing.remove();
          markersRef.current.delete(train.id);
          lastVisualKeyRef.current.delete(train.id);

          const el = createTrainMarkerElement(train, isSelected, th);
          el.addEventListener("click", () => {
            useTrainSelectionStore.getState().setSelectedTrain(train.id);
          });
          const marker = new maplibregl.Marker({
            element: el,
            anchor: "center",
          })
            .setLngLat(pos)
            .addTo(map);
          markersRef.current.set(train.id, marker);
          lastVisualKeyRef.current.set(train.id, vk);
          lastPosRef.current.set(train.id, { lng, lat });
        }
      });
    };

    const unsubs = [
      useFleetLiveStore.subscribe(scheduleSync),
      useTrainSelectionStore.subscribe(scheduleSync),
      useThemeStore.subscribe(scheduleSync),
      useLocaleStore.subscribe(scheduleSync),
    ];

    scheduleSync();

    return () => {
      unsubs.forEach((u) => u());
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [mapLoaded]);

  return (
    <div
      className="w-full h-full relative rounded-lg overflow-hidden"
      style={{ backgroundColor: "var(--map-canvas-bg)" }}
    >
      <div className="w-full h-full absolute inset-0" ref={mapContainerRef} />
      <style>{`
        .maplibregl-ctrl-bottom-right {
          bottom: 80px;
          right: 12px;
        }
        .maplibregl-ctrl button {
          background-color: var(--bg-panel) !important;
          border-color: var(--border-subtle) !important;
        }
        .maplibregl-ctrl button span {
          filter: invert(0.7);
        }
        [data-theme="light"] .maplibregl-ctrl button span {
          filter: invert(0.35);
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          70% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
