import { Cloud, Wind } from 'lucide-react'

const WEATHER_DATA = {
  temp: 5,
  condition: 'Cloudy',
  windSpeed: 12,
}

export function WeatherOverlay() {
  return (
    <div
      className="rounded-xl p-3 min-w-[110px]"
      style={{
        backgroundColor: 'var(--bg-overlay)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="text-[9px] font-bold tracking-wider uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
        Weather
      </div>
      <div className="flex items-center gap-2 mb-1">
        <Cloud size={20} style={{ color: 'var(--text-secondary)' }} />
        <span className="text-2xl font-bold font-mono leading-none" style={{ color: 'var(--text-primary)' }}>
          {WEATHER_DATA.temp}°C
        </span>
      </div>
      <div className="text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>
        {WEATHER_DATA.condition}
      </div>
      <div className="flex items-center gap-1">
        <Wind size={10} style={{ color: 'var(--text-muted)' }} />
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
          Wind {WEATHER_DATA.windSpeed} km/h
        </span>
      </div>
    </div>
  )
}
