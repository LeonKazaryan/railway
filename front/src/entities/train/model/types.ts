export type TrainModel = 'KZ8A' | 'TE33A'

export type TrainStatus = 'normal' | 'warning' | 'critical' | 'no_signal'

export interface TrainPosition {
  lng: number
  lat: number
}

export interface Train {
  id: string
  model: TrainModel
  status: TrainStatus
  healthScore: number
  speed: number
  position: TrainPosition
  route: string
  lastSeen: string
}
