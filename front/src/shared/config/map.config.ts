const key = import.meta.env.VITE_MAPTILER_KEY;

export const MAP_STYLE_DARK = `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`;
export const MAP_STYLE_LIGHT = `https://api.maptiler.com/maps/dataviz-light/style.json?key=${key}`;

export const MAP_CONFIG = {
  center: [67.5, 48.0] as [number, number],
  zoom: 5,
  minZoom: 4,
  maxZoom: 14,
  style: MAP_STYLE_DARK,
} as const;
