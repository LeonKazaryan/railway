import { X, Zap, Radio, Wifi } from 'lucide-react'

const NETWORK_ITEMS = [
  { icon: Zap, label: '25kV', sub: 'Power', color: 'var(--success)' },
  { icon: Radio, label: 'OK', sub: 'Signals', color: 'var(--success)' },
  { icon: Wifi, label: '99%', sub: 'Network', color: 'var(--success)' },
]

interface NetworkStatusOverlayProps {
  onClose?: () => void
}

export function NetworkStatusOverlay({ onClose }: NetworkStatusOverlayProps) {
  return (
    <div
      className="rounded-xl p-3 min-w-[200px]"
      style={{
        backgroundColor: 'var(--bg-overlay)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
          <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
            Network Status
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-semibold" style={{ color: 'var(--success)' }}>
            All Good
          </span>
          {onClose && (
            <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {NETWORK_ITEMS.map(({ icon: Icon, label, sub, color }) => (
          <div key={sub} className="flex flex-col items-center gap-0.5">
            <Icon size={14} style={{ color }} />
            <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-primary)' }}>
              {label}
            </span>
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {sub}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
