export const LOCALE_STORAGE_KEY = "raillens.locale";

export type AppLocale = "en" | "ru" | "kk";

export function readStoredLocale(): AppLocale {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === "en" || v === "ru" || v === "kk") return v;
  } catch {
    /* ignore */
  }
  return "en";
}
