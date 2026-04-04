import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MAP_CONFIG,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
} from "@/shared/config/map.config";
import { MOCK_TRAINS } from "@/entities/train/model/mock";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import { useLocaleStore } from "@/features/locale/model/store";
import { useThemeStore } from "@/features/theme/model/store";
import type { AppTheme } from "@/features/theme/model/store";
import { KZ_RAIL_ROUTES } from "../config/routes";
import { createTrainMarkerElement } from "./TrainMarker";

const STATUS_LINE_COLORS: Record<string, string> = {
  normal: "#38bdf8",
  warning: "#f59e0b",
  critical: "#f43f5e",
};

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
  const locale = useLocaleStore((s) => s.locale);
  const theme = useThemeStore((s) => s.theme);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const skipThemeStyleOnce = useRef(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const { selectedTrainId, setSelectedTrain } = useTrainSelectionStore();

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
      MOCK_TRAINS.forEach((train) => {
        const el = createTrainMarkerElement(
          train,
          false,
          themeNow,
        );
        el.addEventListener("click", () => {
          setSelectedTrain(train.id);
        });
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([train.position.lng, train.position.lat])
          .addTo(map);
        markersRef.current.set(train.id, marker);
      });
      setMapLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [setSelectedTrain]);

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
    MOCK_TRAINS.forEach((train) => {
      const marker = markersRef.current.get(train.id);
      if (!marker) return;

      const el = createTrainMarkerElement(
        train,
        selectedTrainId === train.id,
        theme,
      );
      el.addEventListener("click", () => setSelectedTrain(train.id));
      marker.getElement().replaceWith(el);

      const newMarker = new maplibregl.Marker({
        element: el,
        anchor: "center",
      }).setLngLat([train.position.lng, train.position.lat]);

      if (mapRef.current) {
        newMarker.addTo(mapRef.current);
      }

      markersRef.current.set(train.id, newMarker);
      marker.remove();
    });
  }, [selectedTrainId, setSelectedTrain, locale, theme]);

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
