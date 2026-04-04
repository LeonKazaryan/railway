# Backend Integration Checklist

This file tracks all places where mock/static data must be replaced with real API calls when the backend is ready.

---

## 1. Train List & Positions

**File:** `src/entities/train/model/mock.ts` → `MOCK_TRAINS`
**Replace with:** `GET /api/trains` — returns array of active trains with id, model, status, healthScore, speed, position (lng/lat), route, lastSeen
**Hook location:** `src/entities/train/api/useTrains.ts` (create using TanStack Query)

---

## 2. Fleet Statistics

**File:** `src/entities/train/model/mock.ts` → `MOCK_FLEET_STATS`
**Replace with:** `GET /api/fleet/stats` — returns activeTrains, activeDelta, healthScore, normalCount, warningCount, criticalCount, liveStreamValue
**Hook location:** `src/entities/train/api/useFleetStats.ts`

---

## 3. Top Risk Trains

**File:** `src/entities/train/model/mock.ts` → `MOCK_TOP_RISK_TRAINS`
**Replace with:** `GET /api/trains/risk?limit=3` — returns top N trains by risk score with id, issue description, score
**Hook location:** `src/entities/train/api/useTopRiskTrains.ts`

---

## 4. Recent Events

**File:** `src/entities/train/model/mock.ts` → `MOCK_RECENT_EVENTS`
**Replace with:** `GET /api/events/recent?limit=10` — returns recent system events with time, trainId, level (critical/warning/info), value
**Hook location:** `src/entities/alert/api/useRecentEvents.ts`

---

## 5. Priority Alert Feed

**File:** `src/entities/alert/model/mock.ts` → `MOCK_ALERTS`
**Replace with:** `GET /api/alerts?status=active&sort=severity` — returns active alerts with full detail
**WebSocket upgrade:** `WS /ws/alerts` — push new alerts in real time, update feed without polling
**Hook location:** `src/entities/alert/api/useAlerts.ts`

---

## 6. Live Train Positions (Real-Time)

**Current behavior:** Static positions on map
**Replace with:** `WS /ws/trains/positions` — streams position updates per train (id, lng, lat, speed)
**Location:** `src/widgets/fleet-map/ui/FleetMap.tsx` — replace `MOCK_TRAINS` positions with live store updates
**Pattern:** Use Zustand store in `src/features/train-selection/model/store.ts` to hold live positions

---

## 7. Live Stream Telemetry Value

**File:** `src/widgets/fleet-overview/ui/FleetOverviewPanel.tsx` → LiveSparkline static data
**Replace with:** `WS /ws/telemetry/stream` or `GET /api/telemetry/live` — returns current throughput value and last N data points for sparkline
**Location:** `src/widgets/fleet-overview/ui/LiveSparkline.tsx`

---

## 8. Rail Route GeoJSON

**File:** `src/widgets/fleet-map/config/routes.ts` → `KZ_RAIL_ROUTES`
**Replace with:** `GET /api/routes/geojson` — returns GeoJSON FeatureCollection with route statuses
**Note:** Route status (normal/warning/critical) drives line color on the map

---

## 9. Network Status

**File:** `src/widgets/fleet-map/ui/NetworkStatusOverlay.tsx` → hardcoded values
**Replace with:** `GET /api/network/status` — returns power (kV), signalsStatus (ok/degraded/outage), networkUptime (%)
**Hook location:** `src/widgets/fleet-map/api/useNetworkStatus.ts`

---

## 10. Weather Data

**File:** `src/widgets/fleet-map/ui/WeatherOverlay.tsx` → hardcoded values
**Replace with:** External weather API or `GET /api/weather/current?region=kz` — returns temp, condition, windSpeed
**Hook location:** `src/widgets/fleet-map/api/useWeather.ts`

---

## 11. Train Detail / Digital Twin

**Future screen:** Twin view
**Replace with:** `GET /api/trains/:id/detail` — returns full telemetry, system health by zone, metadata
**WebSocket:** `WS /ws/trains/:id/telemetry` — live telemetry for selected train

---

## 12. Authentication

**Current:** No auth
**Add:** JWT-based auth, role check (dispatcher / engineer / admin)
**Location:** `src/app/providers/` — add AuthProvider, guard routes per role

---

---

## 13. Train Twin — Current State Snapshot

**Screen:** Twin detail page
**Replace with:** `GET /api/trains/:id/state` — returns full `LOCOMOTIVE_STATE_CURRENT` row: lat, lon, speed_kph, heading_deg, engine_temp_c, oil_temp_c, fuel_level_pct, health_index, active_faults, comm_state, alarm_status, etc.
**Hook location:** `src/entities/train/hooks/useTrainCurrentState.ts` (TanStack Query, refresh every 5s)
**Current mock:** `MOCK_TELEMETRY[trainId]` in `src/entities/train/model/mock.ts`

---

## 14. Train Twin — Live Telemetry WebSocket

**Screen:** Twin detail page — all live-updating metrics, system cards, charts
**Replace with:** `WS /ws/trains/:id/telemetry` — streams `TELEMETRY_RAW` rows at 1Hz per train
**Location:** Replace `useLiveTelemetry` simulation (`src/entities/train/hooks/useLiveTelemetry.ts`) with a real WebSocket consumer
**Pattern:**
- Connect on mount, disconnect on unmount
- Parse incoming JSON into `TelemetrySnapshot`
- Push into rolling history buffer (same `useRef` pattern, keep circular buffer logic)
**Helper to create:** `src/shared/lib/ws.ts` — WebSocket wrapper with auto-reconnect

---

## 15. Train Twin — Static Train Detail

**Screen:** Twin sidebar (serial number, operator, route, mode, start time)
**Replace with:** `GET /api/trains/:id` — returns `LOCOMOTIVE` + active `TRAIN_RUN` merged
**Hook location:** `src/entities/train/hooks/useTrainDetail.ts`
**Current mock:** `MOCK_TRAIN_DETAIL` in `src/entities/train/model/mock.ts`

---

## 16. Train Twin — Event Log

**Screen:** EVENTS tab (not yet implemented in UI)
**Replace with:** `GET /api/trains/:id/events?limit=50` — returns `EVENT_LOG` rows ordered by ts desc
**Hook location:** `src/entities/train/hooks/useTrainEvents.ts`

---

## 17. Fault Code Labels

**Location:** `src/entities/train/model/mock.ts` → `FAULT_CODE_LABELS`
**Replace with:** `GET /api/alert-rules` — returns `ALERT_RULE` table with metric_code, title, description, action_hint
**Map:** `code → { title, description, action_hint }` and use in `TwinAlertBanner`

---

## Notes

- All API calls should go through `src/shared/api/client.ts` — the base HTTP client is already stubbed
- All backend DTOs must be mapped to frontend domain models before reaching UI — add mapper functions in `src/entities/*/model/`
- Add `.env.local` variable `VITE_API_URL` pointing to the backend base URL
- For WebSocket connections, create a dedicated `src/shared/lib/ws.ts` helper
