import type { TFunction } from "i18next";
import type { CSSProperties } from "react";
import {
  Cloud,
  Wind,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMapStore } from "../model/store";
import { useQuery } from "@tanstack/react-query";

type OpenMeteoForecastJson = {
  current?: {
    temperature_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
};

async function fetchOpenMeteoCurrent(lat: number, lng: number) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(lat));
  u.searchParams.set("longitude", String(lng));
  u.searchParams.set("current", "temperature_2m,wind_speed_10m,weather_code");
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = (await res.json()) as OpenMeteoForecastJson;
  const c = json.current;
  if (!c) throw new Error("Open-Meteo: no current");
  return {
    temp: Math.round(c.temperature_2m ?? 0),
    windSpeed: Math.round(c.wind_speed_10m ?? 0),
    code: Math.round(c.weather_code ?? 0),
  };
}

const getWeatherIconAndDesc = (code: number) => {
  if (code === 0) return { Icon: Sun, desc: "weather.clear" };
  if (code >= 1 && code <= 3) return { Icon: Cloud, desc: "weather.cloudy" };
  if (code >= 51 && code <= 67)
    return { Icon: CloudRain, desc: "weather.rain" };
  if (code >= 71 && code <= 77)
    return { Icon: CloudSnow, desc: "weather.snow" };
  if (code >= 80 && code <= 82)
    return { Icon: CloudRain, desc: "weather.showers" };
  if (code >= 95 && code <= 99)
    return { Icon: CloudLightning, desc: "weather.thunderstorm" };
  return { Icon: Cloud, desc: "weather.unknown" };
};

type WeatherData = {
  temp: number;
  windSpeed: number;
  code: number;
  locationName: string;
};

function WeatherDetails({
  weather,
  t,
}: {
  weather: WeatherData;
  t: TFunction;
}) {
  const { Icon, desc } = getWeatherIconAndDesc(weather.code);
  return (
    <>
      <div className="mb-1 flex min-h-[28px] items-center gap-2">
        <Icon size={20} style={{ color: "var(--text-secondary)" }} />
        <span
          className="font-mono text-2xl font-bold leading-none"
          style={{ color: "var(--text-primary)" }}
        >
          {weather.temp}°C
        </span>
      </div>
      <div
        className="mb-1 min-h-[14px] text-[10px]"
        style={{ color: "var(--text-secondary)" }}
      >
        {t(desc)}
      </div>
      <div className="flex min-h-[14px] items-center gap-1">
        <Wind size={10} style={{ color: "var(--text-muted)" }} />
        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
          {t("weather.windValue", { value: weather.windSpeed })}
        </span>
      </div>
    </>
  );
}

const cardShell = "rounded-xl p-3 w-[168px] min-w-[168px] flex flex-col";

const cardStyle: CSSProperties = {
  backgroundColor: "var(--bg-overlay)",
  border: "1px solid var(--border-subtle)",
  backdropFilter: "blur(12px)",
};

function WeatherSpinner() {
  return (
    <div
      className="size-7 shrink-0 rounded-full animate-spin"
      style={{
        border: "2px solid var(--border-subtle)",
        borderTopColor: "var(--text-secondary)",
      }}
      aria-busy
      aria-live="polite"
    />
  );
}

export function WeatherOverlay() {
  const { t, i18n } = useTranslation();
  const mapCenter = useMapStore((s) => s.mapCenter);
  const lang = i18n.language?.split("-")[0] || "ru";

  const {
    data: weather,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["weather", mapCenter?.lat, mapCenter?.lng, lang],
    queryFn: async () => {
      if (!mapCenter) return null;

      const { temp, windSpeed, code } = await fetchOpenMeteoCurrent(
        mapCenter.lat,
        mapCenter.lng,
      );

      let locationName = t("weather.title");
      try {
        const geoRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${mapCenter.lat}&longitude=${mapCenter.lng}&localityLanguage=${lang}`,
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          locationName =
            geoData.city ||
            geoData.locality ||
            geoData.principalSubdivision ||
            geoData.countryName ||
            locationName;
        }
      } catch (err) {
        console.warn("Failed to fetch location name", err);
      }

      return {
        temp,
        windSpeed,
        code,
        locationName,
      };
    },
    enabled: !!mapCenter,
    staleTime: 5 * 60 * 1000,
  });

  const showSpinner = !mapCenter || isPending;
  const titleText =
    weather && !showSpinner ? weather.locationName : t("weather.title");

  return (
    <div className={cardShell} style={cardStyle}>
      <div
        className="mb-2 max-w-[150px] truncate text-[9px] font-bold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
        title={weather && !showSpinner ? weather.locationName : undefined}
      >
        {titleText}
      </div>

      <div className="flex min-h-[76px] flex-1 flex-col">
        {showSpinner && (
          <div className="flex flex-1 items-center justify-center">
            <WeatherSpinner />
          </div>
        )}

        {!showSpinner && isError && (
          <div
            className="flex flex-1 items-center justify-center text-center text-[10px] leading-snug"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("weather.loadError")}
          </div>
        )}

        {!showSpinner && !isError && weather && (
          <WeatherDetails weather={weather} t={t} />
        )}
      </div>
    </div>
  );
}
