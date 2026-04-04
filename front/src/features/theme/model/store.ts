import { create } from "zustand";

export type AppTheme = "dark" | "light";

const STORAGE_KEY = "raillens.theme";

function readStoredTheme(): AppTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

function applyTheme(theme: AppTheme) {
  document.documentElement.dataset.theme = theme;
}

function persistTheme(theme: AppTheme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

applyTheme(readStoredTheme());

interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    persistTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));
