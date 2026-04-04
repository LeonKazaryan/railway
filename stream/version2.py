"""
TE33A Fleet Telemetry Simulation Service
=========================================
Single-file FastAPI service that streams realistic telemetry for a fleet
of 10 TE33A locomotives on the Astana-Almaty mainline.
All state is in-memory. No external dependencies beyond FastAPI + uvicorn.
"""

from __future__ import annotations

import asyncio
import collections
import dataclasses
import enum
import math
import os
import random
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

# ============================================================
# CONFIGURATION
# ============================================================

FLEET_SIZE: int = 10
STREAM_HZ: float = 2.0
TICK_INTERVAL: float = 1.0 / STREAM_HZ
HISTORY_SECONDS: int = 1800
HISTORY_MAXLEN: int = HISTORY_SECONDS * int(STREAM_HZ)
EVENT_MAXLEN: int = 5000
DEFAULT_HOST: str = "0.0.0.0"
DEFAULT_PORT: int = 8000
SIM_SEED: int | None = (
    int(os.environ["SIM_SEED"]) if os.environ.get("SIM_SEED") else None
)
TOTAL_FUEL_L: float = 6000.0
WS_QUEUE_MAX: int = 256

if SIM_SEED is not None:
    random.seed(SIM_SEED)

# ============================================================
# UTILITIES
# ============================================================

_R_EARTH_M = 6_371_000.0


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rlat1, rlon1 = math.radians(lat1), math.radians(lon1)
    rlat2, rlon2 = math.radians(lat2), math.radians(lon2)
    dlat, dlon = rlat2 - rlat1, rlon2 - rlon1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    )
    return _R_EARTH_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rlat1, rlon1 = math.radians(lat1), math.radians(lon1)
    rlat2, rlon2 = math.radians(lat2), math.radians(lon2)
    dlon = rlon2 - rlon1
    x = math.sin(dlon) * math.cos(rlat2)
    y = math.cos(rlat1) * math.sin(rlat2) - math.sin(rlat1) * math.cos(
        rlat2
    ) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def lerp(a: float, b: float, t: float) -> float:
    t = max(0.0, min(1.0, t))
    return a + (b - a) * t


def remap(
    value: float,
    in_min: float,
    in_max: float,
    out_min: float,
    out_max: float,
) -> float:
    if in_max == in_min:
        return out_min
    t = max(0.0, min(1.0, (value - in_min) / (in_max - in_min)))
    return out_min + (out_max - out_min) * t


def jitter(base: float, amplitude: float) -> float:
    return base + random.uniform(-amplitude, amplitude)


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utcnow_iso() -> str:
    return utcnow().isoformat()


# ============================================================
# PYDANTIC MODELS
# ============================================================


class WaypointModel(BaseModel):
    name: str
    lat: float
    lon: float
    alt_m: float


class SpeedLimitModel(BaseModel):
    segment: str
    min_kph: float
    max_kph: float


class GeofenceModel(BaseModel):
    geofence_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str
    center_lat: float
    center_lon: float
    radius_m: float
    rules: dict = Field(default_factory=dict)


class LocomotiveModel(BaseModel):
    locomotive_id: str
    model: str = "TE33A"
    serial_number: str
    operator_name: str = "KTZ Express"
    manufactured_year: int = 2023
    created_at: str


class TrainRunModel(BaseModel):
    train_run_id: str
    train_id: str
    locomotive_id: str
    route_id: str
    started_at: str
    ended_at: str | None = None
    status: str = "active"


class RouteModel(BaseModel):
    route_id: str
    name: str = "Astana — Almaty Mainline"
    waypoints: list[WaypointModel]
    speed_limits: list[SpeedLimitModel]
    geofences: list[GeofenceModel]


class RouteProgressModel(BaseModel):
    locomotive_id: str
    route_id: str
    active_segment_index: int
    active_segment_name: str
    direction: str
    segment_progress: float
    distance_to_next_waypoint_km: float
    next_waypoint_name: str
    lat: float
    lon: float
    alt_m: float
    heading_deg: float
    active_geofences: list[str]


class TelemetryRaw(BaseModel):
    ts: str
    locomotive_id: str
    seq: int
    train_run_id: str
    route_id: str
    geofence_id: str | None = None
    active_geofences: list[str] = Field(default_factory=list)
    lat: float
    lon: float
    alt_m: float
    speed_kph: float
    heading_deg: float
    brake_pipe_pressure_kpa: float
    main_reservoir_pressure_kpa: float
    brake_cylinder_pressure_kpa: float
    brake_pipe_leak_kpa_per_min: float
    brake_status: str
    battery_voltage_v: float
    traction_voltage_v: float
    current_a: float
    engine_rpm: float
    engine_temp_c: float
    oil_temp_c: float
    fuel_level_pct: float
    fuel_consumption_rate_lph: float
    tractive_effort_kn: float
    dynamic_brake_force_kn: float
    alerter_timer_sec: float
    pcs_open: bool
    eab_status: str
    comm_state: str
    alarm_status: str
    fault_codes: list[str]
    health_index: int
    driver_state: dict
    weather_factor: float
    track_grade_pct: float
    current_mode: str


class LocomotiveStateCurrent(BaseModel):
    locomotive_id: str
    serial_number: str
    train_id: str
    updated_at: str
    last_ts: str
    lat: float
    lon: float
    alt_m: float
    speed_kph: float
    heading_deg: float
    brake_status: str
    comm_state: str
    eab_status: str
    health_index: int
    alarm_status: str
    active_faults: list[str]
    active_geofences: list[str]
    current_mode: str
    fuel_level_pct: float
    engine_rpm: float
    engine_temp_c: float
    direction: str
    segment_name: str


class EventLogEntry(BaseModel):
    event_id: str
    ts: str
    locomotive_id: str
    severity: str
    event_type: str
    code: str
    message: str
    payload: dict = Field(default_factory=dict)


class FleetSummary(BaseModel):
    total_locomotives: int
    active_count: int
    stopped_count: int
    warning_count: int
    critical_count: int
    average_health_index: float
    locomotives: list[LocomotiveStateCurrent]


class HealthResponse(BaseModel):
    status: str = "ok"
    uptime_sec: float
    tick_count: int
    fleet_size: int


# ============================================================
# ROUTE DATA
# ============================================================

WAYPOINTS_DATA = [
    {"name": "Astana", "lat": 51.11422, "lon": 71.53142, "alt_m": 350},
    {"name": "Karaganda", "lat": 49.80599, "lon": 73.10948, "alt_m": 500},
    {"name": "Balkhash", "lat": 46.95473, "lon": 74.83692, "alt_m": 440},
    {"name": "Kashken", "lat": 45.79872, "lon": 73.39798, "alt_m": 520},
    {"name": "Almaty", "lat": 43.27377, "lon": 76.93902, "alt_m": 800},
]

SPEED_LIMITS_DATA = [
    {"segment": "Astana → Karaganda", "min_kph": 80, "max_kph": 110},
    {"segment": "Karaganda → Balkhash", "min_kph": 70, "max_kph": 100},
    {"segment": "Balkhash → Kashken", "min_kph": 75, "max_kph": 105},
    {"segment": "Kashken → Almaty", "min_kph": 60, "max_kph": 95},
]

GEOFENCES_DATA = [
    {
        "name": "astana_station",
        "type": "station",
        "lat": 51.11422,
        "lon": 71.53142,
        "radius_m": 5000,
        "rules": {},
    },
    {
        "name": "karaganda_station",
        "type": "station",
        "lat": 49.80599,
        "lon": 73.10948,
        "radius_m": 5000,
        "rules": {},
    },
    {
        "name": "balkhash_station",
        "type": "station",
        "lat": 46.95473,
        "lon": 74.83692,
        "radius_m": 4000,
        "rules": {},
    },
    {
        "name": "kashken_waypoint",
        "type": "waypoint",
        "lat": 45.79872,
        "lon": 73.39798,
        "radius_m": 3000,
        "rules": {},
    },
    {
        "name": "almaty_station",
        "type": "station",
        "lat": 43.27377,
        "lon": 76.93902,
        "radius_m": 6000,
        "rules": {},
    },
    {
        "name": "slow_zone_1",
        "type": "slow_zone",
        "lat": 48.38,
        "lon": 73.97,
        "radius_m": 15000,
        "rules": {"speed_limit_kph": 40},
    },
    {
        "name": "slow_zone_2",
        "type": "slow_zone",
        "lat": 43.55,
        "lon": 76.50,
        "radius_m": 12000,
        "rules": {"speed_limit_kph": 30},
    },
]

WAYPOINTS = [WaypointModel(**w) for w in WAYPOINTS_DATA]
SPEED_LIMITS = [SpeedLimitModel(**s) for s in SPEED_LIMITS_DATA]
GEOFENCES = [
    GeofenceModel(
        geofence_id=str(uuid.uuid5(uuid.NAMESPACE_DNS, g["name"])),
        name=g["name"],
        type=g["type"],
        center_lat=g["lat"],
        center_lon=g["lon"],
        radius_m=g["radius_m"],
        rules=g.get("rules", {}),
    )
    for g in GEOFENCES_DATA
]

_SEGMENT_NAMES_FWD = [
    f"{WAYPOINTS_DATA[i]['name']} → {WAYPOINTS_DATA[i + 1]['name']}"
    for i in range(len(WAYPOINTS_DATA) - 1)
]

_SEGMENT_LENGTHS_M: list[float] = []
for _i in range(len(WAYPOINTS_DATA) - 1):
    _w1, _w2 = WAYPOINTS_DATA[_i], WAYPOINTS_DATA[_i + 1]
    _SEGMENT_LENGTHS_M.append(
        haversine(_w1["lat"], _w1["lon"], _w2["lat"], _w2["lon"])
    )

_NUM_SEGMENTS = len(WAYPOINTS_DATA) - 1

# ============================================================
# ROUTE ENGINE
# ============================================================


class RouteEngine:
    def __init__(
        self,
        segment_index: int = 0,
        segment_progress: float = 0.0,
        direction: str = "forward",
    ) -> None:
        self.direction = direction
        self.segment_index = clamp(segment_index, 0, _NUM_SEGMENTS - 1)
        self.segment_progress = clamp(segment_progress, 0.0, 0.999)
        self.lat: float = 0.0
        self.lon: float = 0.0
        self.alt_m: float = 0.0
        self.heading_deg: float = 0.0
        self.distance_to_next_wp_km: float = 0.0
        self.active_geofences: list[GeofenceModel] = []
        self.prev_geofence_names: set[str] = set()
        self._interpolate_position()

    def _wp_start(self) -> dict:
        if self.direction == "forward":
            return WAYPOINTS_DATA[self.segment_index]
        return WAYPOINTS_DATA[self.segment_index + 1]

    def _wp_end(self) -> dict:
        if self.direction == "forward":
            return WAYPOINTS_DATA[self.segment_index + 1]
        return WAYPOINTS_DATA[self.segment_index]

    def _seg_len(self) -> float:
        return _SEGMENT_LENGTHS_M[self.segment_index]

    def segment_name(self) -> str:
        return _SEGMENT_NAMES_FWD[self.segment_index]

    def next_waypoint_name(self) -> str:
        return self._wp_end()["name"]

    def _interpolate_position(self) -> None:
        ws, we = self._wp_start(), self._wp_end()
        t = clamp(self.segment_progress, 0.0, 1.0)
        self.lat = lerp(ws["lat"], we["lat"], t)
        self.lon = lerp(ws["lon"], we["lon"], t)
        self.alt_m = lerp(ws["alt_m"], we["alt_m"], t)
        self.heading_deg = bearing(self.lat, self.lon, we["lat"], we["lon"])
        self.distance_to_next_wp_km = (
            haversine(self.lat, self.lon, we["lat"], we["lon"]) / 1000.0
        )

    def update(self, speed_kph: float) -> tuple[bool, bool]:
        distance_m = speed_kph / 3.6 * TICK_INTERVAL
        seg_len = self._seg_len()
        if seg_len > 0:
            self.segment_progress += distance_m / seg_len

        seg_changed = False
        route_reversed = False

        if self.segment_progress >= 1.0:
            self.segment_progress = 0.0
            seg_changed = True
            if self.direction == "forward":
                if self.segment_index < _NUM_SEGMENTS - 1:
                    self.segment_index += 1
                else:
                    self.direction = "reverse"
                    route_reversed = True
            else:
                if self.segment_index > 0:
                    self.segment_index -= 1
                else:
                    self.direction = "forward"
                    route_reversed = True

        self._interpolate_position()
        self._update_geofences()
        return seg_changed, route_reversed

    def _update_geofences(self) -> None:
        self.prev_geofence_names = {gf.name for gf in self.active_geofences}
        self.active_geofences = []
        for gf in GEOFENCES:
            d = haversine(self.lat, self.lon, gf.center_lat, gf.center_lon)
            if d <= gf.radius_m:
                self.active_geofences.append(gf)

    def geofence_entered(self) -> list[GeofenceModel]:
        current_names = {gf.name for gf in self.active_geofences}
        return [
            gf
            for gf in self.active_geofences
            if gf.name not in self.prev_geofence_names
        ]

    def geofence_exited_names(self) -> list[str]:
        current_names = {gf.name for gf in self.active_geofences}
        return [n for n in self.prev_geofence_names if n not in current_names]

    def primary_geofence(self) -> GeofenceModel | None:
        if self.active_geofences:
            for gf in self.active_geofences:
                if gf.type == "station":
                    return gf
            return self.active_geofences[0]
        return None

    def track_grade_pct(self) -> float:
        ws, we = self._wp_start(), self._wp_end()
        seg_len = self._seg_len()
        if seg_len == 0:
            return 0.0
        grade = (we["alt_m"] - ws["alt_m"]) / seg_len * 100.0
        if self.direction == "reverse":
            grade = -grade
        return jitter(grade, 0.05)

    def in_slow_zone(self) -> tuple[bool, float]:
        for gf in self.active_geofences:
            if gf.type == "slow_zone":
                return True, float(gf.rules.get("speed_limit_kph", 40))
        return False, 999.0

    def in_station_geofence(self) -> bool:
        return any(gf.type == "station" for gf in self.active_geofences)

    def approaching_station(self, threshold_m: float = 12000.0) -> bool:
        we = self._wp_end()
        d = haversine(self.lat, self.lon, we["lat"], we["lon"])
        if d > threshold_m:
            return False
        wp_name_lower = we["name"].lower()
        for gf in GEOFENCES:
            if gf.type == "station" and wp_name_lower in gf.name:
                return True
        return False

    def at_endpoint(self, threshold_m: float = 1500.0) -> bool:
        we = self._wp_end()
        return haversine(self.lat, self.lon, we["lat"], we["lon"]) <= threshold_m

    def active_geofence_names(self) -> list[str]:
        return [gf.name for gf in self.active_geofences]


# ============================================================
# ALERT ENGINE
# ============================================================

_SEV_RANK = {"info": 0, "warning": 1, "critical": 2}

ALERT_RULES: list[dict] = [
    {
        "metric": "brake_pipe_pressure_kpa",
        "op": "<",
        "threshold": 380,
        "severity": "warning",
        "code": "BRK_PIPE_WARN",
        "family": "brake_pipe",
        "msg": "Brake pipe pressure low: {value:.0f} kPa",
    },
    {
        "metric": "brake_pipe_pressure_kpa",
        "op": "<",
        "threshold": 310,
        "severity": "critical",
        "code": "BRK_PIPE_CRIT",
        "family": "brake_pipe",
        "msg": "Brake pipe pressure critical: {value:.0f} kPa",
    },
    {
        "metric": "brake_pipe_pressure_kpa",
        "op": "<",
        "threshold": 90,
        "severity": "critical",
        "code": "BRK_PIPE_EMER",
        "family": "brake_pipe",
        "msg": "Brake pipe pressure emergency: {value:.0f} kPa",
    },
    {
        "metric": "main_reservoir_pressure_kpa",
        "op": "<",
        "threshold": 414,
        "severity": "critical",
        "code": "MAIN_RES_CRIT",
        "family": "main_reservoir",
        "msg": "Main reservoir pressure low: {value:.0f} kPa",
    },
    {
        "metric": "engine_rpm",
        "op": ">",
        "threshold": 1050,
        "severity": "critical",
        "code": "RPM_OVER",
        "family": "engine_rpm",
        "msg": "Engine RPM critical: {value:.0f}",
    },
    {
        "metric": "engine_temp_c",
        "op": ">",
        "threshold": 100,
        "severity": "warning",
        "code": "ENG_TEMP_WARN",
        "family": "engine_temp",
        "msg": "Engine temperature high: {value:.1f}°C",
    },
    {
        "metric": "engine_temp_c",
        "op": ">",
        "threshold": 110,
        "severity": "critical",
        "code": "ENG_TEMP_CRIT",
        "family": "engine_temp",
        "msg": "Engine temperature critical: {value:.1f}°C",
    },
    {
        "metric": "oil_temp_c",
        "op": ">",
        "threshold": 105,
        "severity": "warning",
        "code": "OIL_TEMP_WARN",
        "family": "oil_temp",
        "msg": "Oil temperature high: {value:.1f}°C",
    },
    {
        "metric": "oil_temp_c",
        "op": ">",
        "threshold": 110,
        "severity": "critical",
        "code": "OIL_TEMP_CRIT",
        "family": "oil_temp",
        "msg": "Oil temperature critical: {value:.1f}°C",
    },
    {
        "metric": "brake_pipe_leak_kpa_per_min",
        "op": ">",
        "threshold": 25,
        "severity": "warning",
        "code": "LEAK_WARN",
        "family": "brake_leak",
        "msg": "Brake pipe leak rate high: {value:.1f} kPa/min",
    },
    {
        "metric": "brake_pipe_leak_kpa_per_min",
        "op": ">",
        "threshold": 34.5,
        "severity": "critical",
        "code": "LEAK_CRIT",
        "family": "brake_leak",
        "msg": "Brake pipe leak rate critical: {value:.1f} kPa/min",
    },
    {
        "metric": "alerter_timer_sec",
        "op": ">",
        "threshold": 20,
        "severity": "warning",
        "code": "ALERTER_WARN",
        "family": "alerter",
        "msg": "Alerter timeout warning: {value:.1f}s",
    },
    {
        "metric": "alerter_timer_sec",
        "op": ">",
        "threshold": 25,
        "severity": "critical",
        "code": "ALERTER_CRIT",
        "family": "alerter",
        "msg": "Alerter timeout critical: {value:.1f}s",
    },
    {
        "metric": "eab_status",
        "op": "==",
        "threshold": "degraded",
        "severity": "warning",
        "code": "EAB_DEGRADED",
        "family": "eab",
        "msg": "EAB system degraded",
    },
    {
        "metric": "eab_status",
        "op": "==",
        "threshold": "lost",
        "severity": "critical",
        "code": "EAB_LOST",
        "family": "eab",
        "msg": "EAB system lost",
    },
    {
        "metric": "comm_state",
        "op": "==",
        "threshold": "intermittent",
        "severity": "warning",
        "code": "COMM_INTERMIT",
        "family": "comm",
        "msg": "Communications intermittent",
    },
    {
        "metric": "comm_state",
        "op": "==",
        "threshold": "offline",
        "severity": "critical",
        "code": "COMM_OFFLINE",
        "family": "comm",
        "msg": "Communications offline",
    },
    {
        "metric": "health_index",
        "op": "<=",
        "threshold": 70,
        "severity": "warning",
        "code": "HEALTH_WARN",
        "family": "health",
        "msg": "Health index degraded: {value}",
    },
    {
        "metric": "health_index",
        "op": "<",
        "threshold": 40,
        "severity": "critical",
        "code": "HEALTH_CRIT",
        "family": "health",
        "msg": "Health index critical: {value}",
    },
]


def _rule_fires(rule: dict, value: Any) -> bool:
    op = rule["op"]
    thr = rule["threshold"]
    if op == "<":
        return value < thr
    if op == ">":
        return value > thr
    if op == "<=":
        return value <= thr
    if op == ">=":
        return value >= thr
    if op == "==":
        return value == thr
    return False


class AlertEngine:
    def __init__(self, locomotive_id: str) -> None:
        self.locomotive_id = locomotive_id
        self.active_alerts: dict[str, tuple[str, str]] = {}

    def evaluate(
        self, state: dict, event_log: collections.deque
    ) -> tuple[str, list[str]]:
        family_hits: dict[str, list[dict]] = {}
        for rule in ALERT_RULES:
            value = state.get(rule["metric"])
            if value is None:
                continue
            if _rule_fires(rule, value):
                family_hits.setdefault(rule["family"], []).append(rule)

        triggered: dict[str, tuple[str, str]] = {}
        for family, rules in family_hits.items():
            best = max(rules, key=lambda r: _SEV_RANK.get(r["severity"], 0))
            triggered[family] = (best["code"], best["severity"])

        all_families = set(list(triggered.keys()) + list(self.active_alerts.keys()))
        for family in all_families:
            new = triggered.get(family)
            old = self.active_alerts.get(family)

            if new and new != old:
                code, sev = new
                rule = next(
                    (r for r in ALERT_RULES if r["code"] == code), None
                )
                if rule:
                    try:
                        msg = rule["msg"].format(
                            value=state.get(rule["metric"], 0)
                        )
                    except Exception:
                        msg = rule["msg"]
                else:
                    msg = code
                event_log.append(
                    EventLogEntry(
                        event_id=str(uuid.uuid4()),
                        ts=utcnow_iso(),
                        locomotive_id=self.locomotive_id,
                        severity=sev,
                        event_type="alert",
                        code=code,
                        message=msg,
                    ).model_dump()
                )
            elif old and not new:
                old_code, _ = old
                event_log.append(
                    EventLogEntry(
                        event_id=str(uuid.uuid4()),
                        ts=utcnow_iso(),
                        locomotive_id=self.locomotive_id,
                        severity="info",
                        event_type="alert",
                        code="ALERT_RESOLVED",
                        message=f"Alert resolved: {old_code}",
                        payload={"resolved_code": old_code, "family": family},
                    ).model_dump()
                )

        self.active_alerts = triggered

        if any(s == "critical" for _, s in triggered.values()):
            alarm = "critical"
        elif any(s == "warning" for _, s in triggered.values()):
            alarm = "warning"
        else:
            alarm = "normal"

        codes = [c for c, _ in triggered.values()]
        return alarm, codes


# ============================================================
# ANOMALY MANAGER
# ============================================================

_ANOMALY_TYPES = [
    "brake_pressure_drift",
    "leak_rate_increase",
    "engine_overtemp",
    "comm_degradation",
    "alerter_timeout",
    "eab_degradation",
]


class _AnomalySlot:
    __slots__ = (
        "atype",
        "severity",
        "onset_ticks",
        "peak_ticks",
        "recovery_ticks",
        "total_ticks",
        "elapsed",
    )

    def __init__(
        self,
        atype: str,
        severity: str,
        onset: int,
        peak: int,
        recovery: int,
    ) -> None:
        self.atype = atype
        self.severity = severity
        self.onset_ticks = onset
        self.peak_ticks = peak
        self.recovery_ticks = recovery
        self.total_ticks = onset + peak + recovery
        self.elapsed = 0

    @property
    def phase(self) -> str:
        if self.elapsed < self.onset_ticks:
            return "onset"
        if self.elapsed < self.onset_ticks + self.peak_ticks:
            return "peak"
        return "recovery"

    @property
    def factor(self) -> float:
        if self.phase == "onset":
            return self.elapsed / max(1, self.onset_ticks)
        if self.phase == "peak":
            return 1.0
        rec = self.elapsed - self.onset_ticks - self.peak_ticks
        return 1.0 - rec / max(1, self.recovery_ticks)

    @property
    def done(self) -> bool:
        return self.elapsed >= self.total_ticks

    def tick(self) -> None:
        self.elapsed += 1


class AnomalyManager:
    def __init__(self) -> None:
        self.active: _AnomalySlot | None = None
        self._cooldown: int = random.randint(240, 1200)
        self._ticks: int = 0
        self._next_check: int = random.randint(240, 1200)

    def tick(self, allow_new: bool = True) -> None:
        self._ticks += 1
        if self.active is not None:
            self.active.tick()
            if self.active.done:
                self.active = None
                self._cooldown = random.randint(240, 1200)
            return
        if self._cooldown > 0:
            self._cooldown -= 1
            return
        if not allow_new:
            return
        if self._ticks >= self._next_check:
            self._ticks = 0
            self._next_check = random.randint(240, 1200)
            if random.random() < 0.20:
                self._spawn()

    def _spawn(self) -> None:
        atype = random.choice(_ANOMALY_TYPES)
        severity = random.choices(
            ["mild", "moderate", "severe"], weights=[75, 22, 3]
        )[0]
        onset = random.randint(40, 100)
        peak = random.randint(20, 60)
        recovery = random.randint(60, 120)
        self.active = _AnomalySlot(atype, severity, onset, peak, recovery)

    def apply(self, state: dict) -> dict:
        if self.active is None:
            return state
        a = self.active
        f = clamp(a.factor, 0.0, 1.0)

        if a.atype == "brake_pressure_drift":
            targets = {"mild": 395.0, "moderate": 340.0, "severe": 290.0}
            target = targets[a.severity]
            normal = state.get("brake_pipe_pressure_kpa", 480.0)
            state["brake_pipe_pressure_kpa"] = normal + (target - normal) * f

        elif a.atype == "leak_rate_increase":
            targets = {"mild": 22.0, "moderate": 30.0, "severe": 36.0}
            target = targets[a.severity]
            base = state.get("brake_pipe_leak_kpa_per_min", 3.0)
            state["brake_pipe_leak_kpa_per_min"] = base + (target - base) * f

        elif a.atype == "engine_overtemp":
            targets = {"mild": 102.0, "moderate": 108.0, "severe": 113.0}
            target = targets[a.severity]
            base = state.get("engine_temp_c", 85.0)
            state["engine_temp_c"] = base + (target - base) * f
            state["oil_temp_c"] = state["engine_temp_c"] - random.uniform(4, 8)

        elif a.atype == "comm_degradation":
            if f > 0.5:
                state["comm_state"] = (
                    "intermittent" if a.severity != "severe" else "offline"
                )

        elif a.atype == "alerter_timeout":
            if f > 0.3:
                targets = {"mild": 19.0, "moderate": 22.0, "severe": 26.0}
                state["alerter_timer_sec"] = targets[a.severity] * f

        elif a.atype == "eab_degradation":
            if f > 0.5:
                state["eab_status"] = (
                    "degraded" if a.severity != "severe" else "lost"
                )

        return state


# ============================================================
# LOCOMOTIVE RUNTIME
# ============================================================

LOCOMOTIVE_INIT_CONFIGS = [
    {
        "serial": "TE33A-0721",
        "train_id": "TRN-4872",
        "seg_idx": 0,
        "seg_prog": 0.10,
        "direction": "forward",
    },
    {
        "serial": "TE33A-0722",
        "train_id": "TRN-4873",
        "seg_idx": 0,
        "seg_prog": 0.52,
        "direction": "forward",
    },
    {
        "serial": "TE33A-0723",
        "train_id": "TRN-4874",
        "seg_idx": 0,
        "seg_prog": 0.83,
        "direction": "reverse",
    },
    {
        "serial": "TE33A-0724",
        "train_id": "TRN-4875",
        "seg_idx": 1,
        "seg_prog": 0.28,
        "direction": "forward",
    },
    {
        "serial": "TE33A-0725",
        "train_id": "TRN-4876",
        "seg_idx": 1,
        "seg_prog": 0.68,
        "direction": "forward",
    },
    {
        "serial": "TE33A-0726",
        "train_id": "TRN-4877",
        "seg_idx": 2,
        "seg_prog": 0.18,
        "direction": "reverse",
    },
    {
        "serial": "TE33A-0727",
        "train_id": "TRN-4878",
        "seg_idx": 2,
        "seg_prog": 0.62,
        "direction": "forward",
    },
    {
        "serial": "TE33A-0728",
        "train_id": "TRN-4879",
        "seg_idx": 3,
        "seg_prog": 0.14,
        "direction": "forward",
    },
    {
        "serial": "TE33A-0729",
        "train_id": "TRN-4880",
        "seg_idx": 3,
        "seg_prog": 0.53,
        "direction": "reverse",
    },
    {
        "serial": "TE33A-0730",
        "train_id": "TRN-4881",
        "seg_idx": 3,
        "seg_prog": 0.89,
        "direction": "forward",
    },
]


class LocomotiveRuntime:
    def __init__(self, config: dict, route_id: str) -> None:
        self.locomotive_id: str = str(uuid.uuid4())
        self.serial_number: str = config["serial"]
        self.train_id: str = config["train_id"]
        self.train_run_id: str = str(uuid.uuid4())
        self.route_id: str = route_id
        now = utcnow()
        self.created_at: str = now.isoformat()

        self.route = RouteEngine(
            config["seg_idx"], config["seg_prog"], config["direction"]
        )
        self.alert_engine = AlertEngine(self.locomotive_id)
        self.anomaly_mgr = AnomalyManager()

        self.history_buffer: collections.deque = collections.deque(
            maxlen=HISTORY_MAXLEN
        )
        self.event_log: collections.deque = collections.deque(
            maxlen=EVENT_MAXLEN
        )

        self.seq: int = 0
        self.mode: str = "cruising"
        self._initial_departure_done: bool = True

        seg_idx = config["seg_idx"]
        sl = SPEED_LIMITS_DATA[min(seg_idx, len(SPEED_LIMITS_DATA) - 1)]
        self.target_speed: float = random.uniform(sl["min_kph"], sl["max_kph"])
        self.speed_kph: float = self.target_speed * random.uniform(0.92, 1.0)
        self.throttle_pct: float = 0.35
        self.brake_demand: float = 0.0

        self.engine_rpm: float = jitter(700.0, 20)
        self.engine_temp_c: float = jitter(87.0, 3)
        self.oil_temp_c: float = self.engine_temp_c - random.uniform(5, 10)
        self.fuel_level_pct: float = random.uniform(55, 97)
        self.fuel_consumption_rate_lph: float = jitter(180.0, 20)

        self.brake_pipe_pressure_kpa: float = jitter(480.0, 3)
        self.main_reservoir_pressure_kpa: float = jitter(800.0, 5)
        self.brake_cylinder_pressure_kpa: float = 0.0
        self.brake_pipe_leak_kpa_per_min: float = jitter(3.5, 1)
        self.brake_status: str = "release"

        self.battery_voltage_v: float = jitter(74.0, 0.2)
        self.traction_voltage_v: float = jitter(600.0, 30)
        self.current_a: float = jitter(300.0, 30)

        self.tractive_effort_kn: float = jitter(200.0, 20)
        self.dynamic_brake_force_kn: float = 0.0

        self.alerter_timer_sec: float = random.uniform(0, 10)
        self._alerter_reset_at: float = random.uniform(10, 18)
        self.pcs_open: bool = False
        self.eab_status: str = "online"
        self.comm_state: str = "online"

        self.weather_factor: float = random.uniform(0.90, 1.0)
        self._weather_tick: int = random.randint(60, 240)
        self.driver_state: dict = {"alertness": "normal", "input_active": True}
        self._driver_tick: int = random.randint(600, 1200)

        self.health_index: int = 100
        self.alarm_status: str = "normal"
        self.fault_codes: list[str] = []

        self._station_wait_ticks: int = 0
        self._station_timer: int = 0

        self.latest_telemetry: dict | None = None
        self.current_state_snapshot: dict | None = None

        self.locomotive_model = LocomotiveModel(
            locomotive_id=self.locomotive_id,
            serial_number=self.serial_number,
            created_at=self.created_at,
        )
        self.train_run_model = TrainRunModel(
            train_run_id=self.train_run_id,
            train_id=self.train_id,
            locomotive_id=self.locomotive_id,
            route_id=self.route_id,
            started_at=self.created_at,
        )

        self._emit_event(
            "info", "system", "SIM_STARTED", "Locomotive simulation started"
        )

    # ---- helpers ----

    def _emit_event(
        self,
        severity: str,
        event_type: str,
        code: str,
        message: str,
        payload: dict | None = None,
    ) -> None:
        self.event_log.append(
            EventLogEntry(
                event_id=str(uuid.uuid4()),
                ts=utcnow_iso(),
                locomotive_id=self.locomotive_id,
                severity=severity,
                event_type=event_type,
                code=code,
                message=message,
                payload=payload or {},
            ).model_dump()
        )

    # ---- state machine ----

    def _update_mode(self) -> None:
        old = self.mode

        if self.mode == "depot_stop":
            if self._station_timer >= self._station_wait_ticks:
                self.mode = "accelerating"
                self._set_target_from_segment()
                self._initial_departure_done = True
            else:
                self._station_timer += 1
            self._emit_mode_if_changed(old)
            return

        if self.mode in ("station_stop", "idle_hold"):
            self._station_timer += 1
            if self._station_timer >= self._station_wait_ticks:
                self.mode = "accelerating"
                self._set_target_from_segment()
                self._emit_event(
                    "info",
                    "status",
                    "DEPARTED_STATION",
                    f"Departed station",
                    {"waypoint": self.route.next_waypoint_name()},
                )
            self._emit_mode_if_changed(old)
            return

        in_slow, slow_limit = self.route.in_slow_zone()
        approaching = self.route.approaching_station(threshold_m=12000.0)
        in_station = self.route.in_station_geofence()
        at_end = self.route.at_endpoint(threshold_m=1500.0)

        if self.mode == "accelerating":
            if in_slow and self.speed_kph > slow_limit:
                self.mode = "braking"
                self.target_speed = slow_limit
            elif approaching and in_station:
                self.mode = "braking"
                self.target_speed = 0.0
            elif self.speed_kph >= self.target_speed * 0.95:
                self.mode = "slow_zone" if in_slow else "cruising"

        elif self.mode == "cruising":
            self._set_target_from_segment_smooth()
            if in_slow and self.speed_kph > slow_limit:
                self.mode = "braking"
                self.target_speed = slow_limit
            elif approaching and in_station:
                self.mode = "braking"
                self.target_speed = 0.0

        elif self.mode == "slow_zone":
            if not in_slow:
                self.mode = "accelerating"
                self._set_target_from_segment()
            elif approaching and in_station:
                self.mode = "braking"
                self.target_speed = 0.0

        elif self.mode == "braking":
            if at_end and in_station and self.speed_kph < 2.0:
                self.speed_kph = 0.0
                self.mode = "station_stop"
                wp = self.route.next_waypoint_name()
                self._station_wait_ticks = random.randint(30, 90)
                self._station_timer = 0
                self._emit_event(
                    "info",
                    "status",
                    "ARRIVED_STATION",
                    f"Arrived at station {wp}",
                    {"waypoint": wp},
                )
            elif in_slow and self.speed_kph <= self.target_speed * 1.05 and self.target_speed > 0:
                self.mode = "slow_zone"
            elif (
                not approaching
                and not in_slow
                and self.speed_kph < 5.0
                and not at_end
            ):
                self.mode = "accelerating"
                self._set_target_from_segment()

        self._emit_mode_if_changed(old)

    def _emit_mode_if_changed(self, old: str) -> None:
        if self.mode != old:
            self._emit_event(
                "info",
                "status",
                "MODE_CHANGED",
                f"Mode: {old} → {self.mode}",
                {"old_mode": old, "new_mode": self.mode},
            )

    def _set_target_from_segment(self) -> None:
        idx = self.route.segment_index
        sl = SPEED_LIMITS_DATA[min(idx, len(SPEED_LIMITS_DATA) - 1)]
        self.target_speed = random.uniform(sl["min_kph"], sl["max_kph"])

    def _set_target_from_segment_smooth(self) -> None:
        idx = self.route.segment_index
        sl = SPEED_LIMITS_DATA[min(idx, len(SPEED_LIMITS_DATA) - 1)]
        new_t = random.uniform(sl["min_kph"], sl["max_kph"])
        self.target_speed = self.target_speed * 0.99 + new_t * 0.01

    # ---- speed ----

    def _update_speed(self) -> None:
        if self.mode == "accelerating":
            accel = random.uniform(0.3, 0.8)
            self.speed_kph = min(self.target_speed, self.speed_kph + accel)
            self.throttle_pct = clamp(
                self.speed_kph / max(1.0, self.target_speed), 0.0, 1.0
            )
            self.brake_demand = 0.0
        elif self.mode in ("cruising", "slow_zone"):
            delta = random.uniform(-0.12, 0.12)
            lo = self.target_speed * 0.92
            hi = self.target_speed * 1.03
            self.speed_kph = clamp(self.speed_kph + delta, lo, hi)
            self.throttle_pct = clamp(0.30 + random.uniform(-0.05, 0.05), 0, 1)
            self.brake_demand = 0.0
        elif self.mode == "braking":
            decel = random.uniform(0.5, 1.5)
            self.speed_kph = max(0.0, self.speed_kph - decel)
            self.throttle_pct = 0.0
            if self.target_speed > 0:
                self.brake_demand = clamp(
                    1.0 - self.speed_kph / max(1.0, self.target_speed + 20),
                    0.0,
                    1.0,
                )
            else:
                self.brake_demand = clamp(
                    1.0 - self.speed_kph / 120.0, 0.3, 1.0
                )
        else:
            self.speed_kph = 0.0
            self.throttle_pct = 0.0
            self.brake_demand = 0.0

    # ---- engine ----

    def _update_engine(self) -> None:
        idle_rpm, max_rpm = 300.0, 950.0

        if self.mode == "accelerating":
            self.engine_rpm = lerp(idle_rpm, max_rpm, self.throttle_pct)
            self.traction_voltage_v = lerp(200, 1200, self.throttle_pct)
            self.current_a = lerp(50, 1000, self.throttle_pct)
            self.tractive_effort_kn = lerp(50, 700, self.throttle_pct)
            self.dynamic_brake_force_kn = 0.0
            self.fuel_consumption_rate_lph = lerp(30, 450, self.throttle_pct)
            self.brake_cylinder_pressure_kpa = 0.0
            self.brake_status = "release"

        elif self.mode in ("cruising", "slow_zone"):
            grade = self.route.track_grade_pct()
            gf = clamp(1.0 + grade * 0.15, 0.5, 2.0)
            self.engine_rpm = jitter(
                lerp(600, 800, self.throttle_pct), 5
            )
            self.tractive_effort_kn = jitter(
                lerp(150, 300, self.throttle_pct) * gf, 5
            )
            self.traction_voltage_v = lerp(400, 800, self.throttle_pct)
            self.current_a = lerp(100, 500, self.throttle_pct)
            self.dynamic_brake_force_kn = 0.0
            self.fuel_consumption_rate_lph = jitter(
                lerp(150, 250, self.throttle_pct), 5
            )
            self.brake_cylinder_pressure_kpa = 0.0
            self.brake_status = "release"

        elif self.mode == "braking":
            self.engine_rpm += (idle_rpm - self.engine_rpm) * 0.05
            self.engine_rpm = jitter(self.engine_rpm, 3)
            self.tractive_effort_kn = max(
                0.0, self.tractive_effort_kn - 15
            )
            self.dynamic_brake_force_kn = lerp(0, 400, self.brake_demand)
            self.brake_cylinder_pressure_kpa = lerp(
                0, 350, self.brake_demand
            )
            self.traction_voltage_v = max(
                0.0, self.traction_voltage_v - 30
            )
            self.current_a = max(0.0, self.current_a - 20)
            self.fuel_consumption_rate_lph = max(
                20.0, self.fuel_consumption_rate_lph - 10
            )
            self.brake_status = "service"

        else:  # stopped modes
            self.engine_rpm = jitter(300.0, 5)
            self.tractive_effort_kn = 0.0
            self.dynamic_brake_force_kn = 0.0
            self.brake_cylinder_pressure_kpa = jitter(250.0, 10)
            self.traction_voltage_v = 0.0
            self.current_a = 0.0
            self.fuel_consumption_rate_lph = jitter(20.0, 3)
            self.brake_status = "release"

        self.engine_rpm = clamp(self.engine_rpm, 0, 1100)
        self.traction_voltage_v = clamp(self.traction_voltage_v, 0, 1400)
        self.current_a = clamp(self.current_a, 0, 1200)
        self.tractive_effort_kn = clamp(self.tractive_effort_kn, 0, 800)
        self.dynamic_brake_force_kn = clamp(
            self.dynamic_brake_force_kn, 0, 534
        )
        self.fuel_consumption_rate_lph = clamp(
            self.fuel_consumption_rate_lph, 0, 500
        )
        self.brake_cylinder_pressure_kpa = clamp(
            self.brake_cylinder_pressure_kpa, 0, 450
        )

    def _update_thermal(self) -> None:
        if self.mode in ("station_stop", "depot_stop", "idle_hold"):
            tgt = 75.0
        elif self.mode in ("cruising", "slow_zone"):
            tgt = 88.0
        elif self.mode == "accelerating":
            tgt = 88.0 + self.throttle_pct * 10.0
        else:
            tgt = 80.0
        self.engine_temp_c += (tgt - self.engine_temp_c) * (
            TICK_INTERVAL / 200.0
        )
        self.engine_temp_c = jitter(self.engine_temp_c, 0.2)

        tgt_oil = self.engine_temp_c - random.uniform(5, 10)
        self.oil_temp_c += (tgt_oil - self.oil_temp_c) * (
            TICK_INTERVAL / 300.0
        )
        self.oil_temp_c = jitter(self.oil_temp_c, 0.2)

    def _update_fuel(self) -> None:
        consumed = self.fuel_consumption_rate_lph / 3600.0 * TICK_INTERVAL
        self.fuel_level_pct -= consumed / TOTAL_FUEL_L * 100.0
        if self.fuel_level_pct < 15.0:
            self.fuel_level_pct = random.uniform(85, 97)

    def _update_brakes_normal(self) -> None:
        self.brake_pipe_pressure_kpa = jitter(480.0, 2.5)
        self.main_reservoir_pressure_kpa = jitter(800.0, 5)
        self.brake_pipe_leak_kpa_per_min = jitter(3.5, 1.0)
        self.battery_voltage_v = jitter(74.0, 0.15)

    def _update_safety(self) -> None:
        self.alerter_timer_sec += TICK_INTERVAL
        if self.alerter_timer_sec >= self._alerter_reset_at:
            self.alerter_timer_sec = 0.0
            self._alerter_reset_at = random.uniform(10, 18)

        self._weather_tick -= 1
        if self._weather_tick <= 0:
            self.weather_factor = clamp(
                self.weather_factor + random.uniform(-0.01, 0.01), 0.85, 1.0
            )
            self._weather_tick = random.randint(60, 240)

        self._driver_tick -= 1
        if self._driver_tick <= 0:
            self._driver_tick = random.randint(600, 1200)
            self.driver_state["alertness"] = random.choices(
                ["normal", "drowsy"], weights=[96, 4]
            )[0]
            self.driver_state["input_active"] = True

    # ---- health index (computed BEFORE alerts) ----

    def _compute_health(self, state: dict) -> int:
        score = 100.0
        bp = state["brake_pipe_pressure_kpa"]
        if bp < 420:
            score -= remap(bp, 280, 420, 35, 0)
        leak = state["brake_pipe_leak_kpa_per_min"]
        if leak > 10:
            score -= remap(leak, 10, 36, 0, 20)
        et = state["engine_temp_c"]
        if et > 95:
            score -= remap(et, 95, 115, 0, 25)
        ot = state["oil_temp_c"]
        if ot > 100:
            score -= remap(ot, 100, 115, 0, 20)
        if state["comm_state"] == "intermittent":
            score -= 5
        if state["comm_state"] == "offline":
            score -= 15
        if state["eab_status"] == "degraded":
            score -= 8
        if state["eab_status"] == "lost":
            score -= 20
        return max(0, min(100, int(score)))

    # ---- main tick ----

    def tick(self, allow_new_anomaly: bool = True) -> dict:
        self.seq += 1

        self._update_mode()
        self._update_speed()

        seg_changed, _rev = self.route.update(self.speed_kph)
        if seg_changed:
            self._emit_event(
                "info",
                "status",
                "SEGMENT_CHANGED",
                f"Entered segment: {self.route.segment_name()}",
                {"segment": self.route.segment_name()},
            )

        for gf in self.route.geofence_entered():
            etype = (
                "SLOW_ZONE_ENTER"
                if gf.type == "slow_zone"
                else "ENTER_GEOFENCE"
            )
            self._emit_event(
                "info",
                "geofence",
                etype,
                f"Entered {gf.type}: {gf.name}",
                {"geofence": gf.name, "type": gf.type},
            )
        for name in self.route.geofence_exited_names():
            self._emit_event(
                "info",
                "geofence",
                "EXIT_GEOFENCE",
                f"Exited geofence: {name}",
                {"geofence": name},
            )

        self._update_engine()
        self._update_thermal()
        self._update_fuel()
        self._update_brakes_normal()
        self._update_safety()

        self.anomaly_mgr.tick(allow_new=allow_new_anomaly)

        pgf = self.route.primary_geofence()
        state: dict[str, Any] = {
            "ts": utcnow_iso(),
            "locomotive_id": self.locomotive_id,
            "seq": self.seq,
            "train_run_id": self.train_run_id,
            "route_id": self.route_id,
            "geofence_id": pgf.geofence_id if pgf else None,
            "active_geofences": self.route.active_geofence_names(),
            "lat": round(self.route.lat, 6),
            "lon": round(self.route.lon, 6),
            "alt_m": round(self.route.alt_m, 1),
            "speed_kph": round(max(0.0, self.speed_kph), 2),
            "heading_deg": round(self.route.heading_deg, 1),
            "brake_pipe_pressure_kpa": round(
                self.brake_pipe_pressure_kpa, 1
            ),
            "main_reservoir_pressure_kpa": round(
                self.main_reservoir_pressure_kpa, 1
            ),
            "brake_cylinder_pressure_kpa": round(
                self.brake_cylinder_pressure_kpa, 1
            ),
            "brake_pipe_leak_kpa_per_min": round(
                self.brake_pipe_leak_kpa_per_min, 1
            ),
            "brake_status": self.brake_status,
            "battery_voltage_v": round(self.battery_voltage_v, 2),
            "traction_voltage_v": round(self.traction_voltage_v, 1),
            "current_a": round(self.current_a, 1),
            "engine_rpm": round(self.engine_rpm, 1),
            "engine_temp_c": round(self.engine_temp_c, 1),
            "oil_temp_c": round(self.oil_temp_c, 1),
            "fuel_level_pct": round(self.fuel_level_pct, 2),
            "fuel_consumption_rate_lph": round(
                self.fuel_consumption_rate_lph, 1
            ),
            "tractive_effort_kn": round(self.tractive_effort_kn, 1),
            "dynamic_brake_force_kn": round(
                self.dynamic_brake_force_kn, 1
            ),
            "alerter_timer_sec": round(self.alerter_timer_sec, 1),
            "pcs_open": self.pcs_open,
            "eab_status": self.eab_status,
            "comm_state": self.comm_state,
            "alarm_status": "normal",
            "fault_codes": [],
            "health_index": 100,
            "driver_state": dict(self.driver_state),
            "weather_factor": round(self.weather_factor, 3),
            "track_grade_pct": round(self.route.track_grade_pct(), 2),
            "current_mode": self.mode,
        }

        state = self.anomaly_mgr.apply(state)

        # sync back anomaly-modified fields for health calc
        self.brake_pipe_pressure_kpa = state["brake_pipe_pressure_kpa"]
        self.brake_pipe_leak_kpa_per_min = state[
            "brake_pipe_leak_kpa_per_min"
        ]
        self.engine_temp_c = state["engine_temp_c"]
        self.oil_temp_c = state["oil_temp_c"]
        self.comm_state = state["comm_state"]
        self.eab_status = state["eab_status"]

        # health BEFORE alerts
        self.health_index = self._compute_health(state)
        state["health_index"] = self.health_index

        # alerts AFTER health
        self.alarm_status, self.fault_codes = self.alert_engine.evaluate(
            state, self.event_log
        )
        state["alarm_status"] = self.alarm_status
        state["fault_codes"] = list(self.fault_codes)

        self.latest_telemetry = state
        self.history_buffer.append(state)

        self.current_state_snapshot = {
            "locomotive_id": self.locomotive_id,
            "serial_number": self.serial_number,
            "train_id": self.train_id,
            "updated_at": utcnow_iso(),
            "last_ts": state["ts"],
            "lat": state["lat"],
            "lon": state["lon"],
            "alt_m": state["alt_m"],
            "speed_kph": state["speed_kph"],
            "heading_deg": state["heading_deg"],
            "brake_status": state["brake_status"],
            "comm_state": state["comm_state"],
            "eab_status": state["eab_status"],
            "health_index": state["health_index"],
            "alarm_status": state["alarm_status"],
            "active_faults": state["fault_codes"],
            "active_geofences": state["active_geofences"],
            "current_mode": state["current_mode"],
            "fuel_level_pct": state["fuel_level_pct"],
            "engine_rpm": state["engine_rpm"],
            "engine_temp_c": state["engine_temp_c"],
            "direction": self.route.direction,
            "segment_name": self.route.segment_name(),
        }

        return state


# ============================================================
# FLEET SIMULATOR
# ============================================================


class FleetSimulator:
    def __init__(self) -> None:
        self.route_id: str = str(uuid.uuid4())
        self.runtimes: dict[str, LocomotiveRuntime] = {}
        self._ordered_ids: list[str] = []
        self.global_seq: int = 0

        for cfg in LOCOMOTIVE_INIT_CONFIGS[:FLEET_SIZE]:
            rt = LocomotiveRuntime(cfg, self.route_id)
            self.runtimes[rt.locomotive_id] = rt
            self._ordered_ids.append(rt.locomotive_id)

    def tick_all(self) -> list[dict]:
        self.global_seq += 1
        anomalous = sum(
            1
            for rt in self.runtimes.values()
            if rt.anomaly_mgr.active is not None
        )
        results: list[dict] = []
        for lid in self._ordered_ids:
            rt = self.runtimes[lid]
            allow = anomalous < 2 or rt.anomaly_mgr.active is not None
            state = rt.tick(allow_new_anomaly=allow)
            results.append(state)
            if (
                rt.anomaly_mgr.active is not None
                and anomalous < 2
            ):
                anomalous = sum(
                    1
                    for r in self.runtimes.values()
                    if r.anomaly_mgr.active is not None
                )
        return results

    def get_runtime(self, locomotive_id: str) -> LocomotiveRuntime | None:
        return self.runtimes.get(locomotive_id)

    def all_runtimes(self) -> list[LocomotiveRuntime]:
        return [self.runtimes[lid] for lid in self._ordered_ids]

    def build_fleet_summary(self) -> dict:
        locos: list[dict] = []
        warn_c = crit_c = active_c = stopped_c = 0
        total_hi = 0.0
        for rt in self.all_runtimes():
            snap = rt.current_state_snapshot
            if snap is None:
                continue
            locos.append(snap)
            total_hi += snap["health_index"]
            if snap["current_mode"] in (
                "station_stop",
                "depot_stop",
                "idle_hold",
            ):
                stopped_c += 1
            else:
                active_c += 1
            if snap["alarm_status"] == "warning":
                warn_c += 1
            elif snap["alarm_status"] == "critical":
                crit_c += 1
        n = len(locos) or 1
        return FleetSummary(
            total_locomotives=len(locos),
            active_count=active_c,
            stopped_count=stopped_c,
            warning_count=warn_c,
            critical_count=crit_c,
            average_health_index=round(total_hi / n, 1),
            locomotives=locos,
        ).model_dump()


# ============================================================
# WEBSOCKET CLIENT REGISTRY
# ============================================================


@dataclasses.dataclass
class _WSClient:
    websocket: WebSocket
    queue: asyncio.Queue
    locomotive_id: str | None  # None = all


_ws_clients: dict[int, _WSClient] = {}


def _broadcast(state: dict) -> None:
    lid = state["locomotive_id"]
    for cid, client in list(_ws_clients.items()):
        if client.locomotive_id is None or client.locomotive_id == lid:
            try:
                client.queue.put_nowait(state)
            except asyncio.QueueFull:
                pass  # slow consumer, drop frame


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(title="TE33A Fleet Telemetry Service", version="2.0.0")

fleet: FleetSimulator | None = None
_start_mono: float = 0.0
_sim_task: asyncio.Task | None = None


async def _simulation_loop() -> None:
    assert fleet is not None
    loop = asyncio.get_event_loop()
    while True:
        t0 = loop.time()
        results = fleet.tick_all()
        for state in results:
            _broadcast(state)
        elapsed = loop.time() - t0
        await asyncio.sleep(max(0.0, TICK_INTERVAL - elapsed))


@app.on_event("startup")
async def _on_startup() -> None:
    global fleet, _start_mono, _sim_task
    _start_mono = time.monotonic()
    fleet = FleetSimulator()
    _sim_task = asyncio.create_task(_simulation_loop())


@app.on_event("shutdown")
async def _on_shutdown() -> None:
    if _sim_task is not None:
        _sim_task.cancel()
        try:
            await _sim_task
        except asyncio.CancelledError:
            pass


def _get_runtime_or_404(locomotive_id: str) -> LocomotiveRuntime:
    assert fleet is not None
    rt = fleet.get_runtime(locomotive_id)
    if rt is None:
        raise HTTPException(status_code=404, detail="Locomotive not found")
    return rt


# ---- health ----

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        uptime_sec=round(time.monotonic() - _start_mono, 1),
        tick_count=fleet.global_seq if fleet else 0,
        fleet_size=FLEET_SIZE,
    )


# ---- fleet ----

@app.get("/fleet")
async def fleet_overview() -> dict:
    if fleet is None:
        return {"error": "not ready"}
    return fleet.build_fleet_summary()


@app.get("/fleet/latest")
async def fleet_latest() -> list[dict]:
    if fleet is None:
        return []
    return [
        rt.latest_telemetry
        for rt in fleet.all_runtimes()
        if rt.latest_telemetry is not None
    ]


@app.get("/fleet/states")
async def fleet_states() -> list[dict]:
    if fleet is None:
        return []
    return [
        rt.current_state_snapshot
        for rt in fleet.all_runtimes()
        if rt.current_state_snapshot is not None
    ]


@app.get("/fleet/events")
async def fleet_events(
    limit: int = Query(default=100, ge=1, le=5000),
) -> list[dict]:
    if fleet is None:
        return []
    merged: list[dict] = []
    for rt in fleet.all_runtimes():
        merged.extend(list(rt.event_log))
    merged.sort(key=lambda e: e.get("ts", ""), reverse=True)
    return merged[:limit]


# ---- locomotives ----

@app.get("/locomotives")
async def list_locomotives() -> list[dict]:
    if fleet is None:
        return []
    return [
        {
            "locomotive": rt.locomotive_model.model_dump(),
            "train_run": rt.train_run_model.model_dump(),
        }
        for rt in fleet.all_runtimes()
    ]


@app.get("/locomotives/{locomotive_id}")
async def get_locomotive(locomotive_id: str) -> dict:
    rt = _get_runtime_or_404(locomotive_id)
    return {
        "locomotive": rt.locomotive_model.model_dump(),
        "train_run": rt.train_run_model.model_dump(),
    }


@app.get("/locomotives/{locomotive_id}/latest")
async def loco_latest(locomotive_id: str) -> dict:
    rt = _get_runtime_or_404(locomotive_id)
    if rt.latest_telemetry is None:
        return {"error": "no data yet"}
    return rt.latest_telemetry


@app.get("/locomotives/{locomotive_id}/state/current")
async def loco_state_current(locomotive_id: str) -> dict:
    rt = _get_runtime_or_404(locomotive_id)
    if rt.current_state_snapshot is None:
        return {"error": "no data yet"}
    return rt.current_state_snapshot


@app.get("/locomotives/{locomotive_id}/history")
async def loco_history(
    locomotive_id: str,
    seconds: int = Query(default=300, ge=1, le=HISTORY_SECONDS),
) -> list[dict]:
    rt = _get_runtime_or_404(locomotive_id)
    max_items = int(seconds * STREAM_HZ)
    items = list(rt.history_buffer)
    return items[-max_items:]


@app.get("/locomotives/{locomotive_id}/events")
async def loco_events(
    locomotive_id: str,
    limit: int = Query(default=100, ge=1, le=5000),
) -> list[dict]:
    rt = _get_runtime_or_404(locomotive_id)
    items = list(rt.event_log)
    items.reverse()
    return items[:limit]


# ---- route ----

@app.get("/route")
async def get_route() -> dict:
    rid = fleet.route_id if fleet else "n/a"
    return RouteModel(
        route_id=rid,
        waypoints=WAYPOINTS,
        speed_limits=SPEED_LIMITS,
        geofences=GEOFENCES,
    ).model_dump()


@app.get("/route/progress/{locomotive_id}")
async def route_progress(locomotive_id: str) -> dict:
    rt = _get_runtime_or_404(locomotive_id)
    r = rt.route
    return RouteProgressModel(
        locomotive_id=rt.locomotive_id,
        route_id=rt.route_id,
        active_segment_index=r.segment_index,
        active_segment_name=r.segment_name(),
        direction=r.direction,
        segment_progress=round(r.segment_progress, 4),
        distance_to_next_waypoint_km=round(r.distance_to_next_wp_km, 2),
        next_waypoint_name=r.next_waypoint_name(),
        lat=round(r.lat, 6),
        lon=round(r.lon, 6),
        alt_m=round(r.alt_m, 1),
        heading_deg=round(r.heading_deg, 1),
        active_geofences=r.active_geofence_names(),
    ).model_dump()


# ---- websocket: all locomotives ----

@app.websocket("/ws/telemetry")
async def ws_telemetry_all(websocket: WebSocket) -> None:
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue(maxsize=WS_QUEUE_MAX)
    cid = id(websocket)
    _ws_clients[cid] = _WSClient(websocket, queue, locomotive_id=None)

    async def _sender() -> None:
        try:
            while True:
                data = await queue.get()
                await websocket.send_json(data)
        except Exception:
            pass

    async def _receiver() -> None:
        try:
            while True:
                await websocket.receive_bytes()
        except (WebSocketDisconnect, Exception):
            pass

    try:
        done, pending = await asyncio.wait(
            [asyncio.create_task(_sender()),
             asyncio.create_task(_receiver())],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
    finally:
        _ws_clients.pop(cid, None)


# ---- websocket: single locomotive ----

@app.websocket("/ws/telemetry/{locomotive_id}")
async def ws_telemetry_single(
    websocket: WebSocket, locomotive_id: str
) -> None:
    await websocket.accept()
    if fleet and fleet.get_runtime(locomotive_id) is None:
        await websocket.close(code=4004, reason="Locomotive not found")
        return

    queue: asyncio.Queue = asyncio.Queue(maxsize=WS_QUEUE_MAX)
    cid = id(websocket)
    _ws_clients[cid] = _WSClient(
        websocket, queue, locomotive_id=locomotive_id
    )

    async def _sender() -> None:
        try:
            while True:
                data = await queue.get()
                await websocket.send_json(data)
        except Exception:
            pass

    async def _receiver() -> None:
        try:
            while True:
                await websocket.receive_bytes()
        except (WebSocketDisconnect, Exception):
            pass

    try:
        done, pending = await asyncio.wait(
            [asyncio.create_task(_sender()),
             asyncio.create_task(_receiver())],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
    finally:
        _ws_clients.pop(cid, None)


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=DEFAULT_HOST, port=DEFAULT_PORT, log_level="info")