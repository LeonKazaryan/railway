import type { GeoJSON } from "geojson";

export const KZ_RAIL_ROUTES: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Astana — Almaty", status: "normal" },
      geometry: {
        type: "LineString",
        coordinates: [
          [71.45, 51.18],
          [70.8, 49.5],
          [70.0, 48.0],
          [69.5, 46.5],
          [68.8, 45.5],
          [68.5, 44.0],
          [69.4, 43.5],
          [76.9, 43.2],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Astana — Aktobe", status: "normal" },
      geometry: {
        type: "LineString",
        coordinates: [
          [71.45, 51.18],
          [69.0, 51.5],
          [67.0, 51.2],
          [65.0, 51.0],
          [63.6, 50.3],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Astana — Semey", status: "normal" },
      geometry: {
        type: "LineString",
        coordinates: [
          [71.45, 51.18],
          [73.5, 51.0],
          [75.0, 50.8],
          [76.5, 50.5],
          [80.2, 50.4],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Shymkent — Kyzylorda", status: "warning" },
      geometry: {
        type: "LineString",
        coordinates: [
          [69.6, 42.3],
          [68.5, 44.0],
          [68.0, 45.5],
          [68.0, 46.5],
          [68.5, 47.5],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Almaty — Druzhba", status: "normal" },
      geometry: {
        type: "LineString",
        coordinates: [
          [76.9, 43.2],
          [78.0, 43.5],
          [79.5, 43.8],
          [80.2, 44.0],
        ],
      },
    },
    {
      type: "Feature",
      properties: { name: "Kyzylorda — Shymkent", status: "normal" },
      geometry: {
        type: "LineString",
        coordinates: [
          [65.5, 44.8],
          [66.8, 44.5],
          [68.0, 44.0],
          [69.0, 43.5],
          [69.6, 42.3],
        ],
      },
    },
  ],
};
