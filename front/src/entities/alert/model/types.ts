export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  trainId: string
  severity: AlertSeverity
  title: string
  description: string
  suggestedAction: string
  minutesAgo: number
  time: string
  isNew?: boolean
}
