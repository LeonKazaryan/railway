export const MAP_CONFIG = {
  center: [67.5, 48.0] as [number, number],
  zoom: 5,
  minZoom: 4,
  maxZoom: 14,
  style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`,
} as const;
