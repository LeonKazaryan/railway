import { useState } from 'react'
import { SlidersHorizontal, ChevronRight } from 'lucide-react'
import { MOCK_ALERTS } from '@/entities/alert/model/mock'
import { AlertCard } from './AlertCard'

export function PriorityFeed() {
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--danger)' }} />
          <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-primary)' }}>
            Priority Feed
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded"
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <SlidersHorizontal size={9} />
            Filter
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1 p-2">
          {MOCK_ALERTS.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              isSelected={selectedAlertId === alert.id}
              onSelect={(id) => setSelectedAlertId(id === selectedAlertId ? null : id)}
            />
          ))}
        </div>
      </div>

      <div
        className="px-3 py-2 border-t shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <button
          className="w-full flex items-center justify-center gap-1 text-[10px] font-semibold py-1.5 rounded-lg transition-all hover:opacity-80"
          style={{
            color: 'var(--accent-primary)',
            backgroundColor: 'rgba(56,189,248,0.08)',
            border: '1px solid rgba(56,189,248,0.2)',
          }}
        >
          View All Alerts
          <ChevronRight size={11} />
        </button>
      </div>
    </div>
  )
}
