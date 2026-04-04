export const TWIN_TAB_KEYS = [
  "overview",
  "systems",
  "telemetry",
  "events",
  "config",
] as const;

export type TwinTab = (typeof TWIN_TAB_KEYS)[number];
