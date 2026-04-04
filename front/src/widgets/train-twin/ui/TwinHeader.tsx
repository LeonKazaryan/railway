import { ChevronLeft } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { TRAIN_MODEL_ASSETS } from '@/entities/train/model/config'
import { useTrainSelectionStore } from '@/features/train-selection/model/store'
import type { TrainDetail } from '@/entities/train/model/types'

const TABS = ['OVERVIEW', 'SYSTEMS', 'TELEMETRY', 'EVENTS', 'CONFIG'] as const
type Tab = (typeof TABS)[number]

interface TwinHeaderProps {
  train: TrainDetail
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function TwinHeader({ train, activeTab, onTabChange }: TwinHeaderProps) {
  const setSelectedTrain = useTrainSelectionStore((s) => s.setSelectedTrain)
  const modelInfo = TRAIN_MODEL_ASSETS[train.model]

  return (
    <header
      className="flex items-center h-12 px-4 gap-6 border-b shrink-0"
      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
    >
      <button
        onClick={() => setSelectedTrain(null)}
        className="flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--text-primary)] shrink-0"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ChevronLeft size={14} />
        BACK TO FLEET
      </button>

      <div
        className="w-px h-5 shrink-0"
        style={{ backgroundColor: 'var(--border-subtle)' }}
      />

      <div className="flex items-center gap-3 min-w-0">
        <span
          className="text-base font-bold font-mono tracking-wide shrink-0"
          style={{ color: 'var(--text-primary)' }}
        >
          {train.id}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {modelInfo.label}
        </span>
      </div>

      <nav className="flex items-center gap-1 ml-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              'px-4 h-12 text-xs font-semibold tracking-wider transition-all border-b-2',
              activeTab === tab
                ? 'border-b-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            {tab}
          </button>
        ))}
      </nav>
    </header>
  )
}
