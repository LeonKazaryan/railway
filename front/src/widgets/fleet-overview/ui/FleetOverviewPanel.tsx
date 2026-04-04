import { TrendingUp, ChevronRight, Activity } from 'lucide-react'
import { MOCK_FLEET_STATS } from '@/entities/train/model/mock'
import { FleetHealthGauge } from './FleetHealthGauge'
import { LiveSparkline } from './LiveSparkline'
import { TopRiskTrains } from './TopRiskTrains'
import { RecentEvents } from './RecentEvents'

const STATUS_ROWS = [
  { label: 'Normal', value: MOCK_FLEET_STATS.normalCount, color: 'var(--success)' },
  { label: 'Warning', value: MOCK_FLEET_STATS.warningCount, color: 'var(--warning)' },
  { label: 'Critical', value: MOCK_FLEET_STATS.criticalCount, color: 'var(--danger)' },
]

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
        {title}
      </span>
      <ChevronRight size={11} style={{ color: 'var(--text-muted)' }} />
    </div>
  )
}

export function FleetOverviewPanel() {
  return (
    <div className="flex flex-col h-full">
      <div
        className="px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Fleet Overview
        </span>
      </div>

      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
              Active Trains
            </div>
            <div className="text-3xl font-bold font-mono leading-none" style={{ color: 'var(--text-primary)' }}>
              {MOCK_FLEET_STATS.activeTrains}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp size={10} style={{ color: 'var(--success)' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                +{MOCK_FLEET_STATS.activeDelta} from last hour
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>
              Fleet Health
            </div>
            <FleetHealthGauge score={MOCK_FLEET_STATS.healthScore} />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          {STATUS_ROWS.map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </span>
              </div>
              <span className="text-xs font-bold font-mono" style={{ color }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Activity size={11} style={{ color: 'var(--success)' }} />
            <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Live Stream
            </span>
          </div>
          <span className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
            {MOCK_FLEET_STATS.liveStreamValue.toLocaleString()}
          </span>
        </div>
        <LiveSparkline />
      </div>

      <div className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <SectionHeader title="Top Risk Trains" />
        <div className="px-1 py-1">
          <TopRiskTrains />
        </div>
      </div>

      <div className="flex-1">
        <SectionHeader title="Recent Events" />
        <div className="px-1 py-1">
          <RecentEvents />
        </div>
      </div>
    </div>
  )
}
