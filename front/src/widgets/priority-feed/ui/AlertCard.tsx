import { ExternalLink, AlertTriangle, Info, Zap } from 'lucide-react'
import type { Alert } from '@/entities/alert/model/types'
import { ALERT_SEVERITY_CONFIG } from '@/entities/alert/model/mock'
import { cn } from '@/shared/lib/cn'

const SEVERITY_ICONS = {
  critical: Zap,
  warning: AlertTriangle,
  info: Info,
}

interface AlertCardProps {
  alert: Alert
  isSelected?: boolean
  onSelect?: (id: string) => void
}

export function AlertCard({ alert, isSelected, onSelect }: AlertCardProps) {
  const cfg = ALERT_SEVERITY_CONFIG[alert.severity]
  const Icon = SEVERITY_ICONS[alert.severity]

  return (
    <div
      onClick={() => onSelect?.(alert.id)}
      className={cn(
        'relative flex gap-2 p-2.5 rounded-lg cursor-pointer transition-all border',
        isSelected && 'border-[var(--border-accent)]',
      )}
      style={{
        backgroundColor: isSelected ? cfg.bgColor : 'transparent',
        borderColor: isSelected ? cfg.color + '40' : 'var(--border-subtle)',
      }}
    >
      <div
        className="w-0.5 rounded-full shrink-0 self-stretch"
        style={{ backgroundColor: cfg.color }}
      />

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <Icon size={11} style={{ color: cfg.color }} />
            <span
              className="text-[9px] font-bold tracking-wider uppercase"
              style={{ color: cfg.color }}
            >
              {cfg.label}
            </span>
            {alert.minutesAgo > 0 && (
              <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                {alert.minutesAgo}m
              </span>
            )}
          </div>
          {alert.isNew && (
            <span
              className="text-[8px] font-bold px-1 py-0.5 rounded"
              style={{ backgroundColor: cfg.color + '20', color: cfg.color }}
            >
              NEW
            </span>
          )}
        </div>

        <div className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
          {alert.trainId}
        </div>

        <div className="text-[10px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
          {alert.description}
        </div>

        {alert.suggestedAction && (
          <div className="text-[9px] leading-tight mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Suggested: {alert.suggestedAction}
          </div>
        )}

        {alert.severity !== 'info' && (
          <button
            className="mt-1 flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded self-start transition-all hover:opacity-80"
            style={{
              backgroundColor: cfg.color + '18',
              color: cfg.color,
              border: `1px solid ${cfg.color}30`,
            }}
          >
            <ExternalLink size={9} />
            OPEN TWIN
          </button>
        )}
      </div>
    </div>
  )
}
