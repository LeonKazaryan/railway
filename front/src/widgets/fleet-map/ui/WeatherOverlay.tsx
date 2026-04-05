import { Cloud, Wind, Sun, CloudRain, CloudSnow, CloudLightning } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMapStore } from "../model/store";
import { fetchWeatherApi } from "openmeteo";
import { useQuery } from "@tanstack/react-query";

const getWeatherIconAndDesc = (code: number) => {
  if (code === 0) return { Icon: Sun, desc: "weather.clear" };
  if (code >= 1 && code <= 3) return { Icon: Cloud, desc: "weather.cloudy" };
  if (code >= 51 && code <= 67) return { Icon: CloudRain, desc: "weather.rain" };
  if (code >= 71 && code <= 77) return { Icon: CloudSnow, desc: "weather.snow" };
  if (code >= 80 && code <= 82) return { Icon: CloudRain, desc: "weather.showers" };
  if (code >= 95 && code <= 99) return { Icon: CloudLightning, desc: "weather.thunderstorm" };
  return { Icon: Cloud, desc: "weather.unknown" };
};

export function WeatherOverlay() {
  const { t, i18n } = useTranslation();
  const mapCenter = useMapStore((s) => s.mapCenter);
  const lang = i18n.language?.split("-")[0] || "ru";

  const { data: weather } = useQuery({
    queryKey: ["weather", mapCenter?.lat, mapCenter?.lng, lang],
    queryFn: async () => {
      if (!mapCenter) return null;
      
      const params = {
        latitude: mapCenter.lat,
        longitude: mapCenter.lng,
        current: ["temperature_2m", "wind_speed_10m", "weather_code"],
      };
      
      const url = "https://api.open-meteo.com/v1/forecast";
      const responses = await fetchWeatherApi(url, params);
      const response = responses[0];
      const current = response.current()!;
      
      let locationName = t("weather.title");
      try {
        const geoRes = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${mapCenter.lat}&longitude=${mapCenter.lng}&localityLanguage=${lang}`
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          locationName = geoData.city || geoData.locality || geoData.principalSubdivision || geoData.countryName || locationName;
        }
      } catch (err) {
        console.warn("Failed to fetch location name", err);
      }
      
      return {
        temp: Math.round(current.variables(0)!.value()),
        windSpeed: Math.round(current.variables(1)!.value()),
        code: current.variables(2)!.value(),
        locationName,
      };
    },
    enabled: !!mapCenter,
    staleTime: 5 * 60 * 1000,
  });

  if (!weather) {
    return (
      <div
        className="rounded-xl p-3 min-w-[110px]"
        style={{
          backgroundColor: "var(--bg-overlay)",
          border: "1px solid var(--border-subtle)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          className="text-[9px] font-bold tracking-wider uppercase mb-2 truncate max-w-[150px]"
          style={{ color: "var(--text-muted)" }}
        >
          {t("weather.title")}
        </div>
        <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
          {t("weather.loading", "Loading...")}
        </div>
      </div>
    );
  }

  const { Icon, desc } = getWeatherIconAndDesc(weather.code);

  return (
    <div
      className="rounded-xl p-3 min-w-[110px]"
      style={{
        backgroundColor: "var(--bg-overlay)",
        border: "1px solid var(--border-subtle)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="text-[9px] font-bold tracking-wider uppercase mb-2 truncate max-w-[150px]"
        style={{ color: "var(--text-muted)" }}
        title={weather.locationName}
      >
        {weather.locationName}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={20} style={{ color: "var(--text-secondary)" }} />
        <span
          className="text-2xl font-bold font-mono leading-none"
          style={{ color: "var(--text-primary)" }}
        >
          {weather.temp}°C
        </span>
      </div>
      <div
        className="text-[10px] mb-1"
        style={{ color: "var(--text-secondary)" }}
      >
        {t(desc)}
      </div>
      <div className="flex items-center gap-1">
        <Wind size={10} style={{ color: "var(--text-muted)" }} />
        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
          {t("weather.windValue", { value: weather.windSpeed })}
        </span>
      </div>
    </div>
  );
}
