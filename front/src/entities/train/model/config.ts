import type { TrainStatus } from './types'

export const TRAIN_STATUS_CONFIG: Record<
  TrainStatus,
  { label: string; color: string; cssVar: string }
> = {
  normal: { label: 'Normal', color: '#22d3a0', cssVar: '--success' },
  warning: { label: 'Warning', color: '#f59e0b', cssVar: '--warning' },
  critical: { label: 'Critical', color: '#f43f5e', cssVar: '--danger' },
  no_signal: { label: 'No Signal', color: '#4a5568', cssVar: '--text-muted' },
}
