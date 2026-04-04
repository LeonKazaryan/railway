import { useState, useEffect, useRef, useCallback } from 'react'
import type { TelemetrySnapshot, TelemetryBuffer } from '../model/types'
import { MOCK_TELEMETRY } from '../model/mock'

const HISTORY_CAPACITY = 300
const INTERVAL_MS = 1000

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function jitter(value: number, amplitude: number): number {
  return value + (Math.random() - 0.5) * 2 * amplitude
}

function fluctuate(prev: TelemetrySnapshot): TelemetrySnapshot {
  const isOffline = prev.comm_state === 0
  if (isOffline) return { ...prev, ts: Date.now() }

  return {
    ...prev,
    ts: Date.now(),
    speed_kph: clamp(jitter(prev.speed_kph, 1.2), 0, 160),
    engine_temp_c: clamp(jitter(prev.engine_temp_c, 0.4), 35, 115),
    oil_temp_c: clamp(jitter(prev.oil_temp_c, 0.3), 30, 100),
    engine_rpm: clamp(jitter(prev.engine_rpm, 15), 0, 2000),
    fuel_consumption_rate: clamp(jitter(prev.fuel_consumption_rate, 3), 0, 400),
    fuel_level_pct: clamp(prev.fuel_level_pct - Math.random() * 0.002, 0, 100),
    brake_pipe_pressure_kpa: clamp(jitter(prev.brake_pipe_pressure_kpa, 5), 0, 800),
    main_reservoir_pressure_kpa: clamp(jitter(prev.main_reservoir_pressure_kpa, 4), 0, 1100),
    brake_cylinder_pressure_kpa: clamp(jitter(prev.brake_cylinder_pressure_kpa, 3), 0, 400),
    brake_pipe_leak_kpa_per_min: clamp(jitter(prev.brake_pipe_leak_kpa_per_min, 0.05), 0, 5),
    current_a: clamp(jitter(prev.current_a, 12), 0, 2000),
    traction_voltage_v: clamp(jitter(prev.traction_voltage_v, 20), 0, 30000),
    battery_voltage_v: clamp(jitter(prev.battery_voltage_v, 0.2), 90, 130),
    tractive_effort_kn: clamp(jitter(prev.tractive_effort_kn, 2), 0, 350),
    fire_temp_c: clamp(jitter(prev.fire_temp_c, 0.1), 15, 80),
    alerter_timer_sec: clamp(prev.alerter_timer_sec + 1, 0, 120),
  }
}

function getFallbackSnapshot(trainId: string): TelemetrySnapshot {
  return (
    MOCK_TELEMETRY[trainId] ?? {
      ts: Date.now(),
      lat: 48.0,
      lon: 67.5,
      speed_kph: 0,
      heading_deg: 0,
      engine_temp_c: 40,
      oil_temp_c: 35,
      oil_pressure_ok: true,
      engine_rpm: 600,
      fuel_level_pct: 80,
      fuel_consumption_rate: 0,
      brake_pipe_pressure_kpa: 500,
      main_reservoir_pressure_kpa: 850,
      brake_cylinder_pressure_kpa: 190,
      brake_pipe_leak_kpa_per_min: 0,
      brake_status: 'RELEASED',
      current_a: 100,
      traction_voltage_v: 3000,
      battery_voltage_v: 110,
      tractive_effort_kn: 0,
      dynamic_brake_force_kn: 0,
      health_index: 80,
      fault_codes: [],
      alarm_status: 0,
      fire_temp_c: 20,
      comm_state: 1,
      pcs_open: false,
      alerter_timer_sec: 0,
    }
  )
}

export function useLiveTelemetry(trainId: string): TelemetryBuffer {
  const seed = getFallbackSnapshot(trainId)
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot>(seed)
  const historyRef = useRef<TelemetrySnapshot[]>([seed])
  const snapshotRef = useRef<TelemetrySnapshot>(seed)

  const getHistory = useCallback(() => historyRef.current, [])
  const [, forceHistoryUpdate] = useState(0)

  useEffect(() => {
    const initial = getFallbackSnapshot(trainId)
    snapshotRef.current = initial
    historyRef.current = [initial]
    setSnapshot(initial)

    const timer = setInterval(() => {
      const next = fluctuate(snapshotRef.current)
      snapshotRef.current = next

      const buf = historyRef.current
      if (buf.length >= HISTORY_CAPACITY) {
        buf.shift()
      }
      buf.push(next)

      setSnapshot(next)
      forceHistoryUpdate((n) => n + 1)
    }, INTERVAL_MS)

    return () => clearInterval(timer)
  }, [trainId])

  return { snapshot, history: getHistory() }
}
