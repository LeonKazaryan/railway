import { useState, useRef, useEffect, memo } from 'react'
import type { ECharts } from 'echarts'
import ReactECharts from 'echarts-for-react'
import type { TelemetrySnapshot } from '@/entities/train/model/types'
import { TELEMETRY_CHART_CONFIG } from '@/entities/train/model/config'
import { cn } from '@/shared/lib/cn'

const TIME_RANGES = [
  { label: '5m', points: 300 },
  { label: '15m', points: 900 },
  { label: '1h', points: 3600 },
  { label: '4h', points: 14400 },
] as const

type TimeRangeLabel = (typeof TIME_RANGES)[number]['label']

interface MiniChartProps {
  chartId: string
  label: string
  unit: string
  color: string
  data: [number, number][]
  currentValue: string
}

const MiniChart = memo(function MiniChart({ label, unit, color, data, currentValue, chartId }: MiniChartProps) {
  const echartsRef = useRef<ECharts | null>(null)

  const option = {
    backgroundColor: 'transparent',
    grid: { top: 4, bottom: 16, left: 4, right: 4 },
    xAxis: {
      type: 'time',
      show: true,
      axisLabel: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 8,
        formatter: (val: number) => {
          const d = new Date(val)
          return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
        },
      },
      axisLine: { show: false },
      splitLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      show: false,
    },
    series: [
      {
        type: 'line',
        data,
        smooth: true,
        symbol: 'none',
        lineStyle: { color, width: 1.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${color}30` },
              { offset: 1, color: `${color}00` },
            ],
          },
        },
      },
    ],
  }

  useEffect(() => {
    if (echartsRef.current && data.length > 0) {
      echartsRef.current.setOption({ series: [{ data }] })
    }
  }, [data])

  return (
    <div
      className="flex flex-col flex-1 min-w-0 rounded-xl p-2 border"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color }}>
          {label}
        </span>
        <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
          {currentValue} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{unit}</span>
        </span>
      </div>
      <div style={{ height: 64 }}>
        <ReactECharts
          key={chartId}
          option={option}
          style={{ width: '100%', height: '100%' }}
          opts={{ renderer: 'svg' }}
          onChartReady={(instance) => { echartsRef.current = instance }}
        />
      </div>
    </div>
  )
})

interface TwinTelemetryTimelineProps {
  history: TelemetrySnapshot[]
}

export function TwinTelemetryTimeline({ history }: TwinTelemetryTimelineProps) {
  const [range, setRange] = useState<TimeRangeLabel>('5m')

  const maxPoints = TIME_RANGES.find((r) => r.label === range)?.points ?? 300
  const slice = history.slice(-maxPoints)
  const latest = history[history.length - 1]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Telemetry Timeline
        </span>
        <div className="flex items-center gap-1">
          {TIME_RANGES.map(({ label }) => (
            <button
              key={label}
              onClick={() => setRange(label)}
              className={cn(
                'text-[9px] font-semibold px-2 py-0.5 rounded transition-all',
                range === label
                  ? 'text-[var(--accent-primary)] bg-[rgba(56,189,248,0.14)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {TELEMETRY_CHART_CONFIG.map((cfg) => {
          const divisor = cfg.divisor ?? 1
          const dp = cfg.decimalPlaces ?? 0
          const chartData: [number, number][] = slice.map((s) => [
            s.ts,
            parseFloat(((s[cfg.metricKey] as number) / divisor).toFixed(dp)),
          ])
          const currentRaw = latest ? (latest[cfg.metricKey] as number) / divisor : 0
          const currentValue = currentRaw.toFixed(dp)

          return (
            <MiniChart
              key={cfg.id}
              chartId={`${cfg.id}-${range}`}
              label={cfg.label}
              unit={cfg.unit}
              color={cfg.color}
              data={chartData}
              currentValue={currentValue}
            />
          )
        })}
      </div>
    </div>
  )
}
