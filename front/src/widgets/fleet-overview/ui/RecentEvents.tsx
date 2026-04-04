import { MOCK_RECENT_EVENTS } from '@/entities/train/model/mock'

const LEVEL_CONFIG = {
  critical: { color: 'var(--danger)', label: 'CRIT' },
  warning: { color: 'var(--warning)', label: 'WARN' },
  info: { color: 'var(--info)', label: 'INFO' },
}

export function RecentEvents() {
  return (
    <div className="flex flex-col gap-1">
      {MOCK_RECENT_EVENTS.map((event, idx) => {
        const cfg = LEVEL_CONFIG[event.level]
        return (
          <div
            key={idx}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--bg-panel)] transition-colors"
          >
            <span className="text-[10px] font-mono tabular-nums w-10 shrink-0" style={{ color: 'var(--text-muted)' }}>
              {event.time}
            </span>
            <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
              {event.trainId}
            </span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{
                color: cfg.color,
                backgroundColor: `${cfg.color}15`,
              }}
            >
              {cfg.label}
            </span>
            {event.value ? (
              <span className="text-[10px] font-mono font-bold w-7 text-right" style={{ color: cfg.color }}>
                {event.value}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
