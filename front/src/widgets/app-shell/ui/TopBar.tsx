import { useState, useEffect } from 'react'
import { Search, Bell, Settings, Filter } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

const NAV_TABS = [
  { id: 'fleet', label: 'FLEET VIEW' },
  { id: 'dispatcher', label: 'DISPATCHER' },
  { id: 'engineer', label: 'ENGINEER' },
] as const

type TabId = (typeof NAV_TABS)[number]['id']

export function TopBar() {
  const [activeTab, setActiveTab] = useState<TabId>('fleet')
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <header
      className="flex items-center h-12 px-4 gap-6 border-b"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-2 min-w-[140px]">
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="4" width="12" height="6" rx="1.5" stroke="white" strokeWidth="1.2" />
            <rect x="3" y="7" width="2" height="3" rx="0.5" fill="white" />
            <rect x="9" y="7" width="2" height="3" rx="0.5" fill="white" />
            <circle cx="4" cy="10.5" r="1" fill="white" />
            <circle cx="10" cy="10.5" r="1" fill="white" />
          </svg>
        </div>
        <span
          className="text-sm font-bold tracking-widest uppercase"
          style={{ color: 'var(--text-primary)' }}
        >
          RAILLENS
        </span>
      </div>

      <nav className="flex items-center gap-1">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 h-12 text-xs font-semibold tracking-wider transition-all border-b-2',
              activeTab === tab.id
                ? 'border-b-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 max-w-xs ml-4">
        <div
          className="flex items-center gap-2 px-3 h-8 rounded-lg border text-xs"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          <Search size={12} />
          <span>Search train, route or location...</span>
          <Filter size={11} className="ml-auto" />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <button className="relative" style={{ color: 'var(--text-secondary)' }}>
          <Bell size={16} />
          <span
            className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
            style={{ backgroundColor: 'var(--danger)' }}
          />
        </button>
        <button style={{ color: 'var(--text-secondary)' }}>
          <Settings size={15} />
        </button>
        <div className="flex items-center gap-2 pl-4 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: 'var(--success)' }}
          />
          <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
            {formattedTime}
          </span>
          <span
            className="text-xs font-semibold tracking-wider px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: 'rgba(34,211,160,0.12)',
              color: 'var(--success)',
            }}
          >
            LIVE
          </span>
        </div>
      </div>
    </header>
  )
}
