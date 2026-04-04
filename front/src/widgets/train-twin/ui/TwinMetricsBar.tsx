import { useState, useEffect } from 'react'
import type { TelemetrySnapshot } from '@/entities/train/model/types'
import type { TrainDetail } from '@/entities/train/model/types'

const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

function headingToCompass(deg: number): string {
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8
  return COMPASS_LABELS[idx]
}

interface MetricTileProps {
  label: string
  value: string
  sub?: string
  mono?: boolean
}

function MetricTile({ label, value, sub, mono }: MetricTileProps) {
  return (
    <div
      className="flex flex-col gap-0.5 px-4 border-r"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        className={`text-lg font-bold leading-none ${mono ? 'font-mono' : ''}`}
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

interface TwinMetricsBarProps {
  snapshot: TelemetrySnapshot
  train: TrainDetail
}

export function TwinMetricsBar({ snapshot, train }: TwinMetricsBarProps) {
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    setSecondsAgo(0)
    const t = setInterval(() => setSecondsAgo((s) => s + 0.1), 100)
    return () => clearInterval(t)
  }, [snapshot.ts])

  const lat = snapshot.lat.toFixed(4)
  const lon = snapshot.lon.toFixed(4)
  const compass = headingToCompass(snapshot.heading_deg)

  return (
    <div
      className="flex items-stretch border rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <MetricTile
        label="Health Index"
        value={String(snapshot.health_index)}
        sub="/ 100"
        mono
      />
      <MetricTile
        label="Speed"
        value={snapshot.speed_kph.toFixed(0)}
        sub="km/h"
        mono
      />
      <MetricTile
        label="Location"
        value={`${lat}° N`}
        sub={`${lon}° E`}
        mono
      />
      <MetricTile
        label="Direction"
        value={compass}
        sub={`${snapshot.heading_deg.toFixed(0)}°`}
      />
      <MetricTile
        label="Last Update"
        value={`${secondsAgo.toFixed(1)}s`}
        sub="ago"
        mono
      />
      <div className="flex flex-col gap-0.5 px-4">
        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Mode
        </span>
        <span
          className="text-sm font-bold tracking-wider px-2 py-0.5 rounded self-start"
          style={{
            backgroundColor: 'rgba(56,189,248,0.12)',
            color: 'var(--accent-primary)',
            border: '1px solid rgba(56,189,248,0.2)',
          }}
        >
          {train.mode}
        </span>
      </div>
    </div>
  )
}
