import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { readStoredLocale } from "./persist-locale";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { kk } from "./locales/kk";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en as unknown as Record<string, unknown> },
    ru: { translation: ru as unknown as Record<string, unknown> },
    kk: { translation: kk as unknown as Record<string, unknown> },
  },
  lng: readStoredLocale() as string,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export { i18n };
