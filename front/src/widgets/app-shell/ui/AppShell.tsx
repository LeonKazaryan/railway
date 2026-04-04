import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import { LeftNav } from './LeftNav'

interface AppShellProps {
  leftPanel: ReactNode
  main: ReactNode
  rightPanel: ReactNode
}

export function AppShell({ leftPanel, main, rightPanel }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftNav />
        <aside
          className="flex flex-col w-64 border-r overflow-y-auto shrink-0"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {leftPanel}
        </aside>
        <main className="flex-1 relative overflow-hidden">
          {main}
        </main>
        <aside
          className="flex flex-col w-72 border-l overflow-y-auto shrink-0"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {rightPanel}
        </aside>
      </div>
    </div>
  )
}
