import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import type { TelemetrySnapshot } from '@/entities/train/model/types'
import { FAULT_CODE_LABELS } from '@/entities/train/model/mock'

interface TwinAlertBannerProps {
  snapshot: TelemetrySnapshot
}

export function TwinAlertBanner({ snapshot }: TwinAlertBannerProps) {
  const hasFaults = snapshot.fault_codes.length > 0 || snapshot.alarm_status > 0
  const faultLabels = snapshot.fault_codes
    .map((code) => FAULT_CODE_LABELS[code] ?? code)
    .slice(0, 2)
  const count = snapshot.fault_codes.length

  return (
    <AnimatePresence>
      {hasFaults && (
        <motion.div
          key="alert-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl"
          style={{
            backgroundColor: 'rgba(244,63,94,0.10)',
            border: '1px solid rgba(244,63,94,0.3)',
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
            <div className="flex flex-col gap-0.5">
              {faultLabels.map((label, i) => (
                <span key={i} className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>
                  {i === 0 ? label : `+ ${label}`}
                </span>
              ))}
              {snapshot.fault_codes.length > 2 && (
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  +{snapshot.fault_codes.length - 2} more
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {count} active alert{count !== 1 ? 's' : ''}
            </span>
            <button
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{
                backgroundColor: 'rgba(244,63,94,0.18)',
                color: 'var(--danger)',
                border: '1px solid rgba(244,63,94,0.35)',
              }}
            >
              VIEW
              <ExternalLink size={10} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
