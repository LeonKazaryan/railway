import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CONFIG } from "@/shared/config/map.config";
import { MOCK_TRAINS } from "@/entities/train/model/mock";
import { TRAIN_STATUS_CONFIG } from "@/entities/train/model/config";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import { useLocaleStore } from "@/features/locale/model/store";
import { KZ_RAIL_ROUTES } from "../config/routes";
import { createTrainMarkerElement } from "./TrainMarker";

const STATUS_LINE_COLORS: Record<string, string> = {
  normal: "#38bdf8",
  warning: "#f59e0b",
  critical: "#f43f5e",
};

export function FleetMap() {
  const locale = useLocaleStore((s) => s.locale);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const { selectedTrainId, setSelectedTrain } = useTrainSelectionStore();

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_CONFIG.style,
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

      MOCK_TRAINS.forEach((train) => {
        const el = createTrainMarkerElement(train, false);

        el.addEventListener("click", () => {
          setSelectedTrain(train.id);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([train.position.lng, train.position.lat])
          .addTo(map);

        markersRef.current.set(train.id, marker);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [setSelectedTrain]);

  useEffect(() => {
    MOCK_TRAINS.forEach((train) => {
      const marker = markersRef.current.get(train.id);
      if (!marker) return;

      const el = createTrainMarkerElement(train, selectedTrainId === train.id);
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
  }, [selectedTrainId, setSelectedTrain, locale]);

  return (
    <div className="w-full h-full relative" ref={mapContainerRef}>
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
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          70% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
