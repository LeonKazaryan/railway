import { useState } from 'react'
import { LayoutGrid, Cpu, History, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

const NAV_ITEMS = [
  { id: 'fleet', icon: LayoutGrid, label: 'Fleet' },
  { id: 'twin', icon: Cpu, label: 'Twin' },
  { id: 'replay', icon: History, label: 'Replay' },
  { id: 'reports', icon: BarChart2, label: 'Reports' },
] as const

const BOTTOM_ITEMS = [{ id: 'settings', icon: Settings, label: 'Settings' }] as const

type NavId = (typeof NAV_ITEMS)[number]['id'] | (typeof BOTTOM_ITEMS)[number]['id']

export function LeftNav() {
  const [active, setActive] = useState<NavId>('fleet')

  return (
    <nav
      className="flex flex-col items-center py-3 gap-1 border-r w-14"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex-1 flex flex-col items-center gap-1">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => setActive(id)}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
              active === id
                ? 'text-[var(--accent-primary)] bg-[rgba(56,189,248,0.12)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]',
            )}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 mt-2 pt-2 border-t w-full" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-col items-center gap-1">
          {BOTTOM_ITEMS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              title={label}
              onClick={() => setActive(id)}
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
                active === id
                  ? 'text-[var(--accent-primary)] bg-[rgba(56,189,248,0.12)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]',
              )}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1 pb-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: 'var(--accent-primary)', color: '#0a0d14' }}
          >
            D
          </div>
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: 'var(--success)' }}
          />
        </div>
      </div>
    </nav>
  )
}
