import { useEffect, useState } from "react";
import { create } from "zustand";
import { getStompBrokerUrlForDebug, getStompClient } from "@/shared/lib/stomp";
import { apiClient } from "@/shared/api/client";
import type { Train, TrainStatus, TrainModel } from "@/entities/train/model/types";

const FLEET_UI_DEBOUNCE_MS = 120;

function fleetLog(...args: unknown[]) {
  if (import.meta.env.DEV) {
    console.info("[fleet-live]", ...args);
  }
}

function fleetErr(...args: unknown[]) {
  console.error("[fleet-live]", ...args);
}

export interface WsTrainState {
  locomotiveId: string;
  seq: number;
  ts: string;
  serialNumber: string | null;
  trainId: string | null;
  lineId: string | null;
  lineName: string | null;
  lat: number | null;
  lon: number | null;
  altM: number | null;
  speedKph: number | null;
  headingDeg: number | null;
  brakePipePressureKpa: number | null;
  mainReservoirPressureKpa: number | null;
  brakeCylinderPressureKpa: number | null;
  brakePipeLeakKpaPerMin: number | null;
  brakeStatus: string | null;
  batteryVoltageV: number | null;
  tractionVoltageV: number | null;
  currentA: number | null;
  engineRpm: number | null;
  engineTempC: number | null;
  oilTempC: number | null;
  fuelLevelPct: number | null;
  fuelConsumptionRateLph: number | null;
  tractiveEffortKn: number | null;
  dynamicBrakeForceKn: number | null;
  alerterTimerSec: number | null;
  pcsOpen: boolean | null;
  eabStatus: string | null;
  commState: string | null;
  alarmStatus: string | null;
  healthIndex: number | null;
  healthStatus: string | null;
  faultCodes: string[] | null;
  currentMode: string | null;
  parameterZones: Record<string, "green" | "yellow" | "red"> | null;
  routePathCoordinates: [number, number][] | null;
}

export function deriveTrainStatus(ws: WsTrainState): TrainStatus {
  if (ws.commState === "offline" || ws.commState === null) return "no_signal";
  const h = ws.healthIndex ?? 100;
  if (h < 70) return "critical";
  if (h <= 90) return "warning";
  return "normal";
}

function deriveModel(ws: WsTrainState): TrainModel {
  const id = ws.trainId ?? ws.serialNumber ?? "";
  if (id.startsWith("KZ8A")) return "KZ8A";
  if (id.startsWith("KZ4A")) return "KZ4A";
  return "TE33A";
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

export function wsToTrain(ws: WsTrainState): Train {
  return {
    id: ws.locomotiveId,
    label: ws.trainId ?? ws.serialNumber ?? ws.locomotiveId,
    model: deriveModel(ws),
    status: deriveTrainStatus(ws),
    healthScore: ws.healthIndex ?? 0,
    speed: Math.round(ws.speedKph ?? 0),
    position: { lng: ws.lon ?? 0, lat: ws.lat ?? 0 },
    route: ws.lineName ?? "",
    lastSeen: formatTime(ws.ts),
  };
}

interface FleetLiveState {
  trains: Map<string, WsTrainState>;
  connected: boolean;
  messageCount: number;
  _upsert: (ws: WsTrainState) => void;
  _hydrateBatch: (rows: WsTrainState[]) => void;
  _setConnected: (v: boolean) => void;
}

export const useFleetLiveStore = create<FleetLiveState>((set) => ({
  trains: new Map(),
  connected: false,
  messageCount: 0,
  _upsert: (ws) =>
    set((state) => {
      if (ws.locomotiveId == null || ws.locomotiveId === "") {
        return state;
      }
      const next = new Map(state.trains);
      next.set(ws.locomotiveId, ws);
      pushLiveEvent(ws);
      return { trains: next, messageCount: state.messageCount + 1 };
    }),
  _hydrateBatch: (rows) =>
    set((state) => {
      if (rows.length === 0) return state;
      const next = new Map(state.trains);
      for (const ws of rows) {
        if (ws.locomotiveId == null || ws.locomotiveId === "") continue;
        next.set(ws.locomotiveId, ws);
      }
      return { trains: next };
    }),
  _setConnected: (v) => set({ connected: v }),
}));

export async function hydrateFleetFromRest(): Promise<void> {
  const path = "/api/v1/fleet/live-trains";
  fleetLog("GET", path);
  const rows = await apiClient.get<WsTrainState[]>(path);
  fleetLog("hydrate rows:", rows.length);
  if (import.meta.env.DEV && rows.length > 0) {
    fleetLog("sample locomotiveId:", rows[0]?.locomotiveId, "trainId:", rows[0]?.trainId);
  }
  useFleetLiveStore.getState()._hydrateBatch(rows);
}

let started = false;

export async function startFleetLiveConnection(): Promise<void> {
  if (started) return;
  started = true;

  try {
    await hydrateFleetFromRest();
  } catch (e) {
    fleetErr(
      "REST hydrate failed (CORS? backend down? wrong VITE_API_URL?).",
      e,
    );
  }

  if (import.meta.env.DEV && useFleetLiveStore.getState().trains.size === 0) {
    fleetLog(
      "0 trains in API memory — start stream/version2.py + telemetry_bridge so POST /api/v1/telemetry/raw fills TrainLiveStateStore.",
    );
  }

  const store = useFleetLiveStore.getState();
  const stomp = getStompClient();

  fleetLog("STOMP broker URL:", getStompBrokerUrlForDebug());

  stomp.onConnect = () => {
    fleetLog("STOMP connected, subscribing /topic/fleet");
    store._setConnected(true);

    stomp.subscribe("/topic/fleet", (msg) => {
      try {
        const ws: WsTrainState = JSON.parse(msg.body);
        useFleetLiveStore.getState()._upsert(ws);
      } catch (err) {
        fleetErr("bad STOMP frame body", err);
      }
    });
  };

  stomp.onStompError = (frame) => {
    fleetErr("STOMP broker error:", frame.headers?.message ?? frame.body);
  };

  stomp.onWebSocketError = (event) => {
    fleetErr("WebSocket error:", event);
  };

  stomp.onDisconnect = () => {
    fleetLog("STOMP disconnected");
    store._setConnected(false);
  };

  stomp.onWebSocketClose = () => store._setConnected(false);

  stomp.activate();
}

function computeFleetStats() {
  const { trains, messageCount } = useFleetLiveStore.getState();
  const arr = Array.from(trains.values());
  const total = arr.length;
  let normalCount = 0;
  let warningCount = 0;
  let criticalCount = 0;
  let healthSum = 0;

  for (const ws of arr) {
    const st = deriveTrainStatus(ws);
    if (st === "critical" || st === "no_signal") criticalCount++;
    else if (st === "warning") warningCount++;
    else normalCount++;
    healthSum += ws.healthIndex ?? 0;
  }

  return {
    activeTrains: total,
    healthScore: total > 0 ? Math.round(healthSum / total) : 0,
    normalCount,
    warningCount,
    criticalCount,
    liveStreamValue: messageCount,
  };
}

function computeTopRiskRows() {
  return Array.from(useFleetLiveStore.getState().trains.values())
    .filter((ws) => (ws.healthIndex ?? 100) < 90)
    .sort((a, b) => (a.healthIndex ?? 100) - (b.healthIndex ?? 100))
    .slice(0, 5)
    .map((ws) => ({
      id: ws.locomotiveId,
      label: ws.trainId ?? ws.serialNumber ?? ws.locomotiveId,
      issue: ws.faultCodes?.[0] ?? deriveTrainStatus(ws),
      score: ws.healthIndex ?? 0,
    }));
}

export function useFleetTrains(): Train[] {
  const [rows, setRows] = useState<Train[]>(() =>
    Array.from(useFleetLiveStore.getState().trains.values()).map(wsToTrain),
  );
  useEffect(() => {
    let tid: ReturnType<typeof setTimeout> | undefined;
    const flush = () =>
      setRows(
        Array.from(useFleetLiveStore.getState().trains.values()).map(wsToTrain),
      );
    const unsub = useFleetLiveStore.subscribe(() => {
      if (tid) clearTimeout(tid);
      tid = setTimeout(flush, FLEET_UI_DEBOUNCE_MS);
    });
    flush();
    return () => {
      unsub();
      if (tid) clearTimeout(tid);
    };
  }, []);
  return rows;
}

export function useFleetStats() {
  const [stats, setStats] = useState(computeFleetStats);
  useEffect(() => {
    let tid: ReturnType<typeof setTimeout> | undefined;
    const flush = () => setStats(computeFleetStats());
    const unsub = useFleetLiveStore.subscribe(() => {
      if (tid) clearTimeout(tid);
      tid = setTimeout(flush, FLEET_UI_DEBOUNCE_MS);
    });
    flush();
    return () => {
      unsub();
      if (tid) clearTimeout(tid);
    };
  }, []);
  return stats;
}

export function useTopRiskTrains() {
  const [rows, setRows] = useState(computeTopRiskRows);
  useEffect(() => {
    let tid: ReturnType<typeof setTimeout> | undefined;
    const flush = () => setRows(computeTopRiskRows());
    const unsub = useFleetLiveStore.subscribe(() => {
      if (tid) clearTimeout(tid);
      tid = setTimeout(flush, FLEET_UI_DEBOUNCE_MS);
    });
    flush();
    return () => {
      unsub();
      if (tid) clearTimeout(tid);
    };
  }, []);
  return rows;
}

export function useFleetTrainsMapDebounced(
  ms: number = FLEET_UI_DEBOUNCE_MS,
): Map<string, WsTrainState> {
  const [trains, setTrains] = useState<Map<string, WsTrainState>>(() =>
    new Map(useFleetLiveStore.getState().trains),
  );
  useEffect(() => {
    let tid: ReturnType<typeof setTimeout> | undefined;
    const flush = () =>
      setTrains(new Map(useFleetLiveStore.getState().trains));
    const unsub = useFleetLiveStore.subscribe(() => {
      if (tid) clearTimeout(tid);
      tid = setTimeout(flush, ms);
    });
    flush();
    return () => {
      unsub();
      if (tid) clearTimeout(tid);
    };
  }, [ms]);
  return trains;
}

interface LiveEvent {
  time: string;
  trainId: string;
  level: "critical" | "warning" | "info";
}

const eventBuffer: LiveEvent[] = [];
const MAX_EVENTS = 20;

export function pushLiveEvent(ws: WsTrainState) {
  const st = deriveTrainStatus(ws);
  if (st === "normal") return;
  eventBuffer.unshift({
    time: formatTime(ws.ts),
    trainId: ws.trainId ?? ws.locomotiveId,
    level: st === "no_signal" ? "info" : st,
  });
  if (eventBuffer.length > MAX_EVENTS) eventBuffer.length = MAX_EVENTS;
}

export function useLiveEvents() {
  const [, bump] = useState(0);
  useEffect(() => {
    let tid: ReturnType<typeof setTimeout> | undefined;
    const unsub = useFleetLiveStore.subscribe(() => {
      if (tid) clearTimeout(tid);
      tid = setTimeout(() => bump((n) => n + 1), FLEET_UI_DEBOUNCE_MS);
    });
    return () => {
      unsub();
      if (tid) clearTimeout(tid);
    };
  }, []);
  return eventBuffer.slice(0, 5);
}

export function useWsTrainState(locomotiveId: string): WsTrainState | undefined {
  return useFleetLiveStore((s) => s.trains.get(locomotiveId));
}
