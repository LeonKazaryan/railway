import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MAP_CONFIG,
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
} from "@/shared/config/map.config";
import {
  deriveTrainStatus,
  useFleetTrainsMapDebounced,
  wsToTrain,
  type WsTrainState,
} from "@/features/fleet-live/model/store";
import { useTrainSelectionStore } from "@/features/train-selection/model/store";
import { useThemeStore } from "@/features/theme/model/store";
import type { AppTheme } from "@/features/theme/model/store";
import { TRAIN_STATUS_CONFIG } from "@/entities/train/model/config";
import { useMapStore } from "../model/store";

const FLEET_GRAPH_SOURCE = "fleet-graph-routes";
const FLEET_GRAPH_LAYER_GLOW = "fleet-graph-routes-glow";
const FLEET_GRAPH_LAYER = "fleet-graph-routes-line";
const FLEET_TRAIN_SOURCE = "fleet-train-points";
const FLEET_TRAIN_DOT_LAYER = "fleet-train-points-dot";
const FLEET_TRAIN_SELECTED_LAYER = "fleet-train-points-selected";
const FLEET_TRAIN_LABEL_LAYER = "fleet-train-points-label";

function mapStyleUrl(theme: AppTheme) {
  return theme === "light" ? MAP_STYLE_LIGHT : MAP_STYLE_DARK;
}

function ensureFleetGraphRouteLayers(map: maplibregl.Map) {
  if (map.getSource(FLEET_GRAPH_SOURCE)) return;

  map.addSource(FLEET_GRAPH_SOURCE, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  const lineColorExpr: maplibregl.ExpressionSpecification = [
    "match",
    ["get", "status"],
    "normal",
    TRAIN_STATUS_CONFIG.normal.color,
    "warning",
    TRAIN_STATUS_CONFIG.warning.color,
    "critical",
    TRAIN_STATUS_CONFIG.critical.color,
    "no_signal",
    TRAIN_STATUS_CONFIG.no_signal.color,
    TRAIN_STATUS_CONFIG.normal.color,
  ];

  map.addLayer({
    id: FLEET_GRAPH_LAYER_GLOW,
    type: "line",
    source: FLEET_GRAPH_SOURCE,
    paint: {
      "line-color": lineColorExpr,
      "line-width": 7,
      "line-opacity": 0.12,
      "line-blur": 3,
    },
  });

  map.addLayer({
    id: FLEET_GRAPH_LAYER,
    type: "line",
    source: FLEET_GRAPH_SOURCE,
    paint: {
      "line-color": lineColorExpr,
      "line-width": 2,
      "line-opacity": 0.75,
    },
  });
}

function ensureFleetTrainLayers(map: maplibregl.Map, theme: AppTheme) {
  if (!map.getSource(FLEET_TRAIN_SOURCE)) {
    map.addSource(FLEET_TRAIN_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  const circleColorExpr: maplibregl.ExpressionSpecification = [
    "match",
    ["get", "status"],
    "normal",
    TRAIN_STATUS_CONFIG.normal.color,
    "warning",
    TRAIN_STATUS_CONFIG.warning.color,
    "critical",
    TRAIN_STATUS_CONFIG.critical.color,
    "no_signal",
    TRAIN_STATUS_CONFIG.no_signal.color,
    TRAIN_STATUS_CONFIG.normal.color,
  ];

  if (!map.getLayer(FLEET_TRAIN_SELECTED_LAYER)) {
    map.addLayer({
      id: FLEET_TRAIN_SELECTED_LAYER,
      type: "circle",
      source: FLEET_TRAIN_SOURCE,
      filter: ["==", ["get", "selected"], true],
      paint: {
        "circle-radius": 11,
        "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-width": 2,
        "circle-stroke-color": circleColorExpr,
        "circle-opacity": 0.7,
      },
    });
  }

  if (!map.getLayer(FLEET_TRAIN_DOT_LAYER)) {
    map.addLayer({
      id: FLEET_TRAIN_DOT_LAYER,
      type: "circle",
      source: FLEET_TRAIN_SOURCE,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          5,
          6,
          6,
          10,
          7,
        ],
        "circle-color": circleColorExpr,
        "circle-stroke-width": 2,
        "circle-stroke-color":
          theme === "light" ? "rgba(255,255,255,0.95)" : "rgba(10,13,20,0.95)",
        "circle-blur": 0.02,
      },
    });
  }

  if (!map.getLayer(FLEET_TRAIN_LABEL_LAYER)) {
    map.addLayer({
      id: FLEET_TRAIN_LABEL_LAYER,
      type: "symbol",
      source: FLEET_TRAIN_SOURCE,
      layout: {
        "text-field": ["get", "labelText"],
        "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          4,
          10,
          8,
          11,
          12,
          12,
        ],
        "text-anchor": "bottom",
        "text-offset": [0, -1.1],
        "text-letter-spacing": 0.04,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": circleColorExpr,
        "text-halo-width": 3,
        "text-halo-blur": 0.6,
        "text-halo-color":
          theme === "light" ? "rgba(255,255,255,0.96)" : "rgba(10,13,20,0.92)",
      },
    });
  }
}

function setupMapOverlays(map: maplibregl.Map, theme: AppTheme) {
  ensureFleetGraphRouteLayers(map);
  ensureFleetTrainLayers(map, theme);
}

function buildFleetGraphRoutesFc(
  trainsMap: Map<string, WsTrainState>,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const ws of trainsMap.values()) {
    const coords = ws.routePathCoordinates;
    if (!coords || coords.length < 2) continue;
    features.push({
      type: "Feature",
      id: ws.locomotiveId,
      properties: {
        locomotiveId: ws.locomotiveId,
        status: deriveTrainStatus(ws),
      },
      geometry: { type: "LineString", coordinates: coords },
    });
  }
  return { type: "FeatureCollection", features };
}

function buildFleetTrainPointsFc(
  trainsMap: Map<string, WsTrainState>,
  selectedId: string | null,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const ws of trainsMap.values()) {
    const lng = ws.lon;
    const lat = ws.lat;
    if (
      ws.locomotiveId == null ||
      lng == null ||
      lat == null ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat)
    ) {
      continue;
    }
    const train = wsToTrain(ws);
    const health = ws.healthIndex ?? train.healthScore;
    const speed = Math.round(ws.speedKph ?? 0);
    const suffix = speed > 0 ? ` ${health} ${speed}` : ` ${health}`;
    features.push({
      type: "Feature",
      id: train.id,
      properties: {
        locomotiveId: train.id,
        status: train.status,
        selected: selectedId === train.id,
        labelText: `${train.label}${suffix}`,
      },
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function syncMapData(
  map: maplibregl.Map,
  trainsMap: Map<string, WsTrainState>,
  selectedId: string | null,
  theme: AppTheme,
) {
  if (!map.isStyleLoaded()) return;
  setupMapOverlays(map, theme);

  const routesSource = map.getSource(FLEET_GRAPH_SOURCE) as
    | maplibregl.GeoJSONSource
    | undefined;
  routesSource?.setData(buildFleetGraphRoutesFc(trainsMap));

  const trainsSource = map.getSource(FLEET_TRAIN_SOURCE) as
    | maplibregl.GeoJSONSource
    | undefined;
  trainsSource?.setData(buildFleetTrainPointsFc(trainsMap, selectedId));
}

export function FleetMap() {
  const theme = useThemeStore((s) => s.theme);
  const trainsMap = useFleetTrainsMapDebounced();
  const selectedId = useTrainSelectionStore((s) => s.selectedTrainId);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
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

    useMapStore.getState().setMapCenter({
      lat: MAP_CONFIG.center[1],
      lng: MAP_CONFIG.center[0],
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [FLEET_TRAIN_DOT_LAYER, FLEET_TRAIN_LABEL_LAYER],
      });
      const locomotiveId = features[0]?.properties?.locomotiveId;
      useTrainSelectionStore
        .getState()
        .setSelectedTrain(
          typeof locomotiveId === "string" && locomotiveId.length > 0
            ? locomotiveId
            : null,
        );
    });

    map.on("mousemove", (e) => {
      const interactive = map.queryRenderedFeatures(e.point, {
        layers: [FLEET_TRAIN_DOT_LAYER, FLEET_TRAIN_LABEL_LAYER],
      });
      map.getCanvas().style.cursor = interactive.length > 0 ? "pointer" : "";
    });

    map.on("moveend", () => {
      const center = map.getCenter();
      useMapStore.getState().setMapCenter({ lat: center.lat, lng: center.lng });
    });

    map.on("load", () => {
      map.setProjection({ type: "mercator" });
      const themeNow = useThemeStore.getState().theme;
      if (themeNow !== initialTheme) {
        map.setStyle(mapStyleUrl(themeNow));
        map.once("styledata", () => {
          if (!map.isStyleLoaded()) return;
          map.setProjection({ type: "mercator" });
          setupMapOverlays(map, themeNow);
        });
      } else {
        setupMapOverlays(map, themeNow);
      }
      setMapLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
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
      map.setProjection({ type: "mercator" });
      syncMapData(map, trainsMap, selectedId, theme);
    });
  }, [theme, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    syncMapData(mapRef.current, trainsMap, selectedId, theme);
  }, [mapLoaded, trainsMap, selectedId, theme]);

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
