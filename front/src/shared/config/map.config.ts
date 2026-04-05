const stadiaApiKey = import.meta.env.VITE_STADIA_MAPS_API_KEY as
  | string
  | undefined;
const stadiaQs =
  stadiaApiKey && String(stadiaApiKey).trim() !== ""
    ? `?api_key=${encodeURIComponent(String(stadiaApiKey).trim())}`
    : "";

export const MAP_STYLE_LIGHT = `https://tiles.stadiamaps.com/styles/alidade_smooth.json${stadiaQs}`;
export const MAP_STYLE_DARK = `https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json${stadiaQs}`;
export const MAP_STYLE_SATELLITE = `https://tiles.stadiamaps.com/styles/alidade_satellite.json${stadiaQs}`;

export const MAP_CONFIG = {
  center: [67.5, 48.0] as [number, number],
  zoom: 5,
  minZoom: 4,
  maxZoom: 14,
  style: MAP_STYLE_DARK,
} as const;
