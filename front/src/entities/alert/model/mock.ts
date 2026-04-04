import type { Alert } from './types'

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert-1',
    trainId: 'TE33A-047',
    severity: 'critical',
    title: 'Coolant temperature above threshold (104°C)',
    description: 'Coolant temperature above threshold (104°C)',
    suggestedAction: 'Reduce load, inspect cooling system',
    minutesAgo: 24,
    time: '11:18',
    isNew: true,
  },
  {
    id: 'alert-2',
    trainId: 'KZ8A-019',
    severity: 'warning',
    title: 'Inverter overheating',
    description: 'Inverter overheating (98°C)',
    suggestedAction: 'Check cooling fans, monitor',
    minutesAgo: 33,
    time: '11:37',
  },
  {
    id: 'alert-3',
    trainId: 'TE33A-031',
    severity: 'warning',
    title: 'Brake pressure drop',
    description: 'Brake pressure drop (4.1 bar)',
    suggestedAction: 'Check brake system',
    minutesAgo: 41,
    time: '11:38',
  },
  {
    id: 'alert-4',
    trainId: 'TE33A-018',
    severity: 'info',
    title: 'ETA to Karaganda updated',
    description: 'ETA to Karaganda updated',
    suggestedAction: '',
    minutesAgo: 0,
    time: '11:35',
  },
  {
    id: 'alert-5',
    trainId: 'KZ8A-007',
    severity: 'info',
    title: 'No signal for 12 min',
    description: 'No signal for 12 min. Last position: 52.123, 71.456',
    suggestedAction: '',
    minutesAgo: 30,
    time: '11:30',
  },
]

export const ALERT_SEVERITY_CONFIG = {
  critical: { label: 'CRITICAL', color: '#f43f5e', bgColor: 'rgba(244,63,94,0.12)' },
  warning: { label: 'WARNING', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.10)' },
  info: { label: 'INFO', color: '#38bdf8', bgColor: 'rgba(56,189,248,0.08)' },
} as const
