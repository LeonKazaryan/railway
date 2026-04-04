import { create } from "zustand";
import { i18n } from "@/shared/config/i18n/instance";
import {
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  type AppLocale,
} from "@/shared/config/i18n/persist-locale";

export type { AppLocale };

function persistLocale(lng: AppLocale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
}

function applyHtmlLang(locale: AppLocale) {
  document.documentElement.lang =
    locale === "kk" ? "kk" : locale === "ru" ? "ru" : "en";
}

interface LocaleState {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: readStoredLocale(),
  setLocale: (locale) => {
    void i18n.changeLanguage(locale);
    persistLocale(locale);
    applyHtmlLang(locale);
    set({ locale });
  },
}));

applyHtmlLang(readStoredLocale());
