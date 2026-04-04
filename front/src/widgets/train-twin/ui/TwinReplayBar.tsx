import { useState } from 'react'
import { Play, Pause, SkipForward } from 'lucide-react'

export function TwinReplayBar() {
  const [isPlaying, setIsPlaying] = useState(true)

  return (
    <div
      className="flex items-center gap-4 px-4 py-2.5 border-t"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsPlaying((p) => !p)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
          style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <button
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
          style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <SkipForward size={12} />
        </button>
      </div>

      <div className="flex items-center gap-2 flex-1">
        <span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
          11:27
        </span>

        <div className="flex-1 relative h-1.5 rounded-full" style={{ backgroundColor: 'var(--border-subtle)' }}>
          <div
            className="absolute inset-y-0 left-0 right-4 rounded-full"
            style={{ backgroundColor: 'var(--accent-primary)', opacity: 0.4 }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 cursor-pointer hover:scale-110 transition-transform"
            style={{
              right: 16,
              backgroundColor: 'var(--accent-primary)',
              borderColor: 'var(--bg-base)',
            }}
          />
        </div>

        <span className="text-[9px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
          11:42
        </span>
      </div>

      <div
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg"
        style={{
          backgroundColor: 'rgba(34,211,160,0.12)',
          border: '1px solid rgba(34,211,160,0.25)',
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }} />
        <span className="text-[10px] font-bold tracking-wider" style={{ color: 'var(--success)' }}>
          LIVE
        </span>
      </div>
    </div>
  )
}
