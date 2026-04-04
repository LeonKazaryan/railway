import type { Train } from './types'

export const MOCK_TRAINS: Train[] = [
  {
    id: 'KZ8A-019',
    model: 'KZ8A',
    status: 'warning',
    healthScore: 65,
    speed: 89,
    position: { lng: 63.6, lat: 50.3 },
    route: 'Aktobe — Kyzylorda',
    lastSeen: '11:42',
  },
  {
    id: 'KZ9A-005',
    model: 'KZ8A',
    status: 'normal',
    healthScore: 51,
    speed: 10,
    position: { lng: 76.9, lat: 51.2 },
    route: 'Astana — Semey',
    lastSeen: '11:42',
  },
  {
    id: 'TE33A-047',
    model: 'TE33A',
    status: 'critical',
    healthScore: 72,
    speed: 61,
    position: { lng: 68.5, lat: 46.8 },
    route: 'Shymkent — Kyzylorda',
    lastSeen: '11:42',
  },
  {
    id: 'TE33A-031',
    model: 'TE33A',
    status: 'warning',
    healthScore: 58,
    speed: 45,
    position: { lng: 75.4, lat: 43.5 },
    route: 'Almaty — Balkhash',
    lastSeen: '11:42',
  },
  {
    id: 'KZ3A-012',
    model: 'KZ8A',
    status: 'normal',
    healthScore: 88,
    speed: 98,
    position: { lng: 66.8, lat: 44.5 },
    route: 'Kyzylorda — Shymkent',
    lastSeen: '11:42',
  },
  {
    id: 'TE33A-018',
    model: 'TE33A',
    status: 'normal',
    healthScore: 93,
    speed: 0,
    position: { lng: 69.6, lat: 42.8 },
    route: 'Shymkent — Karaganda',
    lastSeen: '11:42',
  },
  {
    id: 'KZ8A-007',
    model: 'KZ8A',
    status: 'no_signal',
    healthScore: 0,
    speed: 0,
    position: { lng: 80.2, lat: 44.0 },
    route: 'Almaty — Druzhba',
    lastSeen: '11:30',
  },
]

export const MOCK_FLEET_STATS = {
  activeTrains: 24,
  activeDelta: 2,
  healthScore: 82,
  normalCount: 19,
  warningCount: 4,
  criticalCount: 1,
  liveStreamValue: 9842,
}

export const MOCK_TOP_RISK_TRAINS = [
  { id: 'TE33A-047', issue: 'High brake pressure', score: 72 },
  { id: 'KZ8A-019', issue: 'Inverter overheating', score: 65 },
  { id: 'TE33A-031', issue: 'Oil pressure drop', score: 58 },
]

export const MOCK_RECENT_EVENTS = [
  { time: '11:40', trainId: 'TE33A-047', level: 'critical' as const, value: '3.0' },
  { time: '11:37', trainId: 'KZ8A-019', level: 'warning' as const, value: '' },
  { time: '11:35', trainId: 'TE33A-018', level: 'info' as const, value: '' },
]
