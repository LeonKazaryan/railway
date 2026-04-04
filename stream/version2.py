"""
TE33A Multi-Line Fleet Telemetry Simulation Service
====================================================
4 railway lines × 10 TE33A locomotives = 40 locomotives.
Single async tick loop at 2 Hz. All state in-memory.

v3.1 — Aggressive anomalies & alert testing
"""

from __future__ import annotations

import asyncio
import collections
import dataclasses
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

LOCOS_PER_LINE: int = 10
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
_LOCO_NS: uuid.UUID = uuid.UUID("7f3b4d2e-1a9c-4e5f-b8d6-3c7a2f1e9d0b")
WS_QUEUE_MAX: int = 512
# ── v3.1: Fleet anomaly budget raised for 40 locos ──
MAX_FLEET_ANOMALIES: int = 12

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
    return a + (b - a) * max(0.0, min(1.0, t))


def remap(
    value: float, in_lo: float, in_hi: float, out_lo: float, out_hi: float
) -> float:
    if in_hi == in_lo:
        return out_lo
    t = max(0.0, min(1.0, (value - in_lo) / (in_hi - in_lo)))
    return out_lo + (out_hi - out_lo) * t


def jitter(base: float, amp: float) -> float:
    return base + random.uniform(-amp, amp)


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    line_id: str
    line_name: str
    created_at: str


class TrainRunModel(BaseModel):
    train_run_id: str
    train_id: str
    locomotive_id: str
    route_id: str
    line_id: str
    started_at: str
    ended_at: str | None = None
    status: str = "active"


class RailwayLineInfo(BaseModel):
    line_id: str
    name: str
    waypoints: list[WaypointModel]
    speed_limits: list[SpeedLimitModel]
    geofences: list[GeofenceModel]
    total_distance_km: float
    num_locomotives: int


class RouteProgressModel(BaseModel):
    locomotive_id: str
    line_id: str
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


class LocomotiveStateCurrent(BaseModel):
    locomotive_id: str
    serial_number: str
    train_id: str
    line_id: str
    line_name: str
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
    line_id: str
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
    lines: list[dict]
    locomotives: list[dict]


class HealthResponse(BaseModel):
    status: str = "ok"
    uptime_sec: float
    tick_count: int
    fleet_size: int
    num_lines: int
    active_anomalies: int


# ============================================================
# LINE DEFINITIONS
# ============================================================

LINES_CONFIG: list[dict] = [
    {
        "line_id": "astana-shu",
        "name": "Astana–Shu Line",
        "waypoints": [
            {"name": "Astana", "lat": 51.1954259, "lon": 71.391907, "alt_m": 350},
            {
                "name": "Karaganda",
                "lat": 49.7926276,
                "lon": 72.8053229,
                "alt_m": 500,
            },
            {"name": "Balkhash", "lat": 46.8609, "lon": 74.8976911, "alt_m": 350},
            {"name": "Shu", "lat": 43.6014393, "lon": 73.7603113, "alt_m": 600},
        ],
        "speed_limits": [
            {"segment": "Astana → Karaganda", "min_kph": 80, "max_kph": 120},
            {"segment": "Karaganda → Balkhash", "min_kph": 70, "max_kph": 100},
            {"segment": "Balkhash → Shu", "min_kph": 75, "max_kph": 105},
        ],
        "geofences": [
            {
                "name": "astana_station",
                "type": "station",
                "lat": 51.1954259,
                "lon": 71.391907,
                "radius_m": 5000,
            },
            {
                "name": "karaganda_station",
                "type": "station",
                "lat": 49.7926276,
                "lon": 72.8053229,
                "radius_m": 5000,
            },
            {
                "name": "balkhash_station",
                "type": "station",
                "lat": 46.8609,
                "lon": 74.8976911,
                "radius_m": 4000,
            },
            {
                "name": "shu_station",
                "type": "station",
                "lat": 43.6014393,
                "lon": 73.7603113,
                "radius_m": 5000,
            },
            {
                "name": "sz_astana_shu_1",
                "type": "slow_zone",
                "lat": 48.3,
                "lon": 73.9,
                "radius_m": 15000,
                "rules": {"speed_limit_kph": 40},
            },
            {
                "name": "sz_astana_shu_2",
                "type": "slow_zone",
                "lat": 44.8,
                "lon": 74.1,
                "radius_m": 12000,
                "rules": {"speed_limit_kph": 35},
            },
        ],
        "base_serial": 100,
        "base_train": 1000,
    },
    {
        "line_id": "turksib",
        "name": "Turkestan–Siberia Line",
        "waypoints": [
            {"name": "Arys", "lat": 42.4287345, "lon": 68.7827391, "alt_m": 300},
            {
                "name": "Shymkent",
                "lat": 42.3170027,
                "lon": 69.5795664,
                "alt_m": 500,
            },
            {"name": "Taraz", "lat": 42.8700107, "lon": 71.3761308, "alt_m": 650},
            {"name": "Almaty", "lat": 43.2737785, "lon": 76.934677, "alt_m": 800},
        ],
        "speed_limits": [
            {"segment": "Arys → Shymkent", "min_kph": 60, "max_kph": 90},
            {"segment": "Shymkent → Taraz", "min_kph": 80, "max_kph": 110},
            {"segment": "Taraz → Almaty", "min_kph": 70, "max_kph": 100},
        ],
        "geofences": [
            {
                "name": "arys_station",
                "type": "station",
                "lat": 42.4287345,
                "lon": 68.7827391,
                "radius_m": 5000,
            },
            {
                "name": "shymkent_station",
                "type": "station",
                "lat": 42.3170027,
                "lon": 69.5795664,
                "radius_m": 5000,
            },
            {
                "name": "taraz_station",
                "type": "station",
                "lat": 42.8700107,
                "lon": 71.3761308,
                "radius_m": 5000,
            },
            {
                "name": "almaty_turksib_station",
                "type": "station",
                "lat": 43.2737785,
                "lon": 76.934677,
                "radius_m": 6000,
            },
            {
                "name": "sz_turksib_1",
                "type": "slow_zone",
                "lat": 43.05,
                "lon": 74.0,
                "radius_m": 12000,
                "rules": {"speed_limit_kph": 35},
            },
        ],
        "base_serial": 200,
        "base_train": 2000,
    },
    {
        "line_id": "trans-aral",
        "name": "Trans‑Aral Railway",
        "waypoints": [
            {"name": "Aktobe", "lat": 50.281139, "lon": 57.211977, "alt_m": 220},
            {
                "name": "Aralsk",
                "lat": 46.8009486,
                "lon": 61.6750584,
                "alt_m": 65,
            },
            {
                "name": "Kyzylorda",
                "lat": 44.8544669,
                "lon": 65.4926015,
                "alt_m": 130,
            },
            {
                "name": "Turkestan",
                "lat": 43.2859281,
                "lon": 68.2132103,
                "alt_m": 210,
            },
            {"name": "Arys", "lat": 42.4287345, "lon": 68.7827391, "alt_m": 300},
        ],
        "speed_limits": [
            {"segment": "Aktobe → Aralsk", "min_kph": 60, "max_kph": 90},
            {"segment": "Aralsk → Kyzylorda", "min_kph": 70, "max_kph": 100},
            {"segment": "Kyzylorda → Turkestan", "min_kph": 65, "max_kph": 95},
            {"segment": "Turkestan → Arys", "min_kph": 60, "max_kph": 85},
        ],
        "geofences": [
            {
                "name": "aktobe_station",
                "type": "station",
                "lat": 50.281139,
                "lon": 57.211977,
                "radius_m": 5000,
            },
            {
                "name": "aralsk_station",
                "type": "station",
                "lat": 46.8009486,
                "lon": 61.6750584,
                "radius_m": 4000,
            },
            {
                "name": "kyzylorda_station",
                "type": "station",
                "lat": 44.8544669,
                "lon": 65.4926015,
                "radius_m": 5000,
            },
            {
                "name": "turkestan_station",
                "type": "station",
                "lat": 43.2859281,
                "lon": 68.2132103,
                "radius_m": 4000,
            },
            {
                "name": "arys_ta_station",
                "type": "station",
                "lat": 42.4287345,
                "lon": 68.7827391,
                "radius_m": 5000,
            },
            {
                "name": "sz_transaral_1",
                "type": "slow_zone",
                "lat": 45.8,
                "lon": 63.5,
                "radius_m": 14000,
                "rules": {"speed_limit_kph": 40},
            },
        ],
        "base_serial": 300,
        "base_train": 3000,
    },
    {
        "line_id": "almaty-dostyk",
        "name": "Almaty–Dostyk Line",
        "waypoints": [
            {"name": "Almaty", "lat": 43.2737785, "lon": 76.934677, "alt_m": 800},
            {
                "name": "Aktogay",
                "lat": 46.9533818,
                "lon": 79.6815207,
                "alt_m": 600,
            },
            {"name": "Dostyk", "lat": 45.2619021, "lon": 82.465803, "alt_m": 500},
        ],
        "speed_limits": [
            {"segment": "Almaty → Aktogay", "min_kph": 70, "max_kph": 100},
            {"segment": "Aktogay → Dostyk", "min_kph": 60, "max_kph": 90},
        ],
        "geofences": [
            {
                "name": "almaty_ad_station",
                "type": "station",
                "lat": 43.2737785,
                "lon": 76.934677,
                "radius_m": 6000,
            },
            {
                "name": "aktogay_station",
                "type": "station",
                "lat": 46.9533818,
                "lon": 79.6815207,
                "radius_m": 4000,
            },
            {
                "name": "dostyk_station",
                "type": "station",
                "lat": 45.2619021,
                "lon": 82.465803,
                "radius_m": 5000,
            },
            {
                "name": "sz_dostyk_1",
                "type": "slow_zone",
                "lat": 46.1,
                "lon": 81.0,
                "radius_m": 13000,
                "rules": {"speed_limit_kph": 35},
            },
        ],
        "base_serial": 400,
        "base_train": 4000,
    },
]


# ============================================================
# RAILWAY LINE OBJECT
# ============================================================


class RailwayLine:
    def __init__(self, cfg: dict) -> None:
        self.line_id: str = cfg["line_id"]
        self.name: str = cfg["name"]
        self.waypoints_data: list[dict] = cfg["waypoints"]
        self.speed_limits_data: list[dict] = cfg["speed_limits"]

        self.waypoints = [WaypointModel(**w) for w in self.waypoints_data]
        self.speed_limits = [SpeedLimitModel(**s) for s in self.speed_limits_data]
        self.geofences: list[GeofenceModel] = []
        for g in cfg["geofences"]:
            self.geofences.append(
                GeofenceModel(
                    geofence_id=str(
                        uuid.uuid5(
                            uuid.NAMESPACE_DNS, f"{self.line_id}:{g['name']}"
                        )
                    ),
                    name=g["name"],
                    type=g["type"],
                    center_lat=g["lat"],
                    center_lon=g["lon"],
                    radius_m=g["radius_m"],
                    rules=g.get("rules", {}),
                )
            )

        self.num_segments: int = len(self.waypoints_data) - 1
        self.segment_names: list[str] = [
            f"{self.waypoints_data[i]['name']} → {self.waypoints_data[i + 1]['name']}"
            for i in range(self.num_segments)
        ]
        self.segment_lengths_m: list[float] = [
            haversine(
                self.waypoints_data[i]["lat"],
                self.waypoints_data[i]["lon"],
                self.waypoints_data[i + 1]["lat"],
                self.waypoints_data[i + 1]["lon"],
            )
            for i in range(self.num_segments)
        ]
        self.total_distance_km: float = sum(self.segment_lengths_m) / 1000.0

    def info_model(self, num_locos: int) -> dict:
        return RailwayLineInfo(
            line_id=self.line_id,
            name=self.name,
            waypoints=self.waypoints,
            speed_limits=self.speed_limits,
            geofences=self.geofences,
            total_distance_km=round(self.total_distance_km, 1),
            num_locomotives=num_locos,
        ).model_dump()


RAILWAY_LINES: dict[str, RailwayLine] = {}
for _cfg in LINES_CONFIG:
    _rl = RailwayLine(_cfg)
    RAILWAY_LINES[_rl.line_id] = _rl


# ============================================================
# ROUTE ENGINE
# ============================================================


class RouteEngine:
    def __init__(
        self,
        line: RailwayLine,
        segment_index: int = 0,
        segment_progress: float = 0.0,
        direction: str = "forward",
    ) -> None:
        self.line = line
        self.direction = direction
        self.segment_index: int = int(clamp(segment_index, 0, line.num_segments - 1))
        self.segment_progress: float = clamp(segment_progress, 0.0, 0.999)
        self.lat: float = 0.0
        self.lon: float = 0.0
        self.alt_m: float = 0.0
        self.heading_deg: float = 0.0
        self.distance_to_next_wp_km: float = 0.0
        self.active_geofences: list[GeofenceModel] = []
        self._prev_gf_names: set[str] = set()
        self._interpolate()

    def _wp_start(self) -> dict:
        return (
            self.line.waypoints_data[self.segment_index]
            if self.direction == "forward"
            else self.line.waypoints_data[self.segment_index + 1]
        )

    def _wp_end(self) -> dict:
        return (
            self.line.waypoints_data[self.segment_index + 1]
            if self.direction == "forward"
            else self.line.waypoints_data[self.segment_index]
        )

    def _seg_len(self) -> float:
        return self.line.segment_lengths_m[self.segment_index]

    def segment_name(self) -> str:
        return self.line.segment_names[self.segment_index]

    def next_waypoint_name(self) -> str:
        return self._wp_end()["name"]

    def _interpolate(self) -> None:
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
        dist_m = speed_kph / 3.6 * TICK_INTERVAL
        seg_len = self._seg_len()
        if seg_len > 0:
            self.segment_progress += dist_m / seg_len
        seg_changed = False
        route_reversed = False
        if self.segment_progress >= 1.0:
            self.segment_progress = 0.0
            seg_changed = True
            if self.direction == "forward":
                if self.segment_index < self.line.num_segments - 1:
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
        self._interpolate()
        self._update_geofences()
        return seg_changed, route_reversed

    def _update_geofences(self) -> None:
        self._prev_gf_names = {gf.name for gf in self.active_geofences}
        self.active_geofences = [
            gf
            for gf in self.line.geofences
            if haversine(self.lat, self.lon, gf.center_lat, gf.center_lon)
            <= gf.radius_m
        ]

    def geofence_entered(self) -> list[GeofenceModel]:
        return [
            gf for gf in self.active_geofences if gf.name not in self._prev_gf_names
        ]

    def geofence_exited_names(self) -> list[str]:
        cur = {gf.name for gf in self.active_geofences}
        return [n for n in self._prev_gf_names if n not in cur]

    def primary_geofence(self) -> GeofenceModel | None:
        for gf in self.active_geofences:
            if gf.type == "station":
                return gf
        return self.active_geofences[0] if self.active_geofences else None

    def active_geofence_names(self) -> list[str]:
        return [gf.name for gf in self.active_geofences]

    def track_grade_pct(self) -> float:
        ws, we = self._wp_start(), self._wp_end()
        sl = self._seg_len()
        if sl == 0:
            return 0.0
        g = (we["alt_m"] - ws["alt_m"]) / sl * 100.0
        return jitter(-g if self.direction == "reverse" else g, 0.05)

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
        name_lower = we["name"].lower()
        return any(
            gf.type == "station" and name_lower in gf.name
            for gf in self.line.geofences
        )

    def at_endpoint(self, threshold_m: float = 1500.0) -> bool:
        we = self._wp_end()
        return haversine(self.lat, self.lon, we["lat"], we["lon"]) <= threshold_m


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
    op, thr = rule["op"], rule["threshold"]
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
    def __init__(self, locomotive_id: str, line_id: str) -> None:
        self.locomotive_id = locomotive_id
        self.line_id = line_id
        self.active_alerts: dict[str, tuple[str, str]] = {}

    def evaluate(
        self, state: dict, event_log: collections.deque
    ) -> tuple[str, list[str]]:
        family_hits: dict[str, list[dict]] = {}
        for rule in ALERT_RULES:
            val = state.get(rule["metric"])
            if val is None:
                continue
            if _rule_fires(rule, val):
                family_hits.setdefault(rule["family"], []).append(rule)

        triggered: dict[str, tuple[str, str]] = {}
        for fam, rules in family_hits.items():
            best = max(rules, key=lambda r: _SEV_RANK.get(r["severity"], 0))
            triggered[fam] = (best["code"], best["severity"])

        all_families = set(list(triggered.keys()) + list(self.active_alerts.keys()))
        for fam in all_families:
            new, old = triggered.get(fam), self.active_alerts.get(fam)
            if new and new != old:
                code, sev = new
                rule = next((r for r in ALERT_RULES if r["code"] == code), None)
                msg = code
                if rule:
                    try:
                        msg = rule["msg"].format(
                            value=state.get(rule["metric"], 0)
                        )
                    except Exception:
                        msg = rule["msg"]
                event_log.append(
                    EventLogEntry(
                        event_id=str(uuid.uuid4()),
                        ts=utcnow_iso(),
                        locomotive_id=self.locomotive_id,
                        line_id=self.line_id,
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
                        line_id=self.line_id,
                        severity="info",
                        event_type="alert",
                        code="ALERT_RESOLVED",
                        message=f"Alert resolved: {old_code}",
                        payload={"resolved_code": old_code, "family": fam},
                    ).model_dump()
                )

        self.active_alerts = triggered
        if any(s == "critical" for _, s in triggered.values()):
            alarm = "critical"
        elif any(s == "warning" for _, s in triggered.values()):
            alarm = "warning"
        else:
            alarm = "normal"
        return alarm, [c for c, _ in triggered.values()]


# ============================================================
# ANOMALY MANAGER  — v3.1 REWRITE
# ============================================================
# ── v3.1: added rpm_surge & main_reservoir_drop ──
_ANOMALY_TYPES = [
    "brake_pressure_drift",
    "leak_rate_increase",
    "engine_overtemp",
    "comm_degradation",
    "alerter_timeout",
    "eab_degradation",
    "rpm_surge",
    "main_reservoir_drop",
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
        self, atype: str, severity: str, onset: int, peak: int, recovery: int
    ) -> None:
        self.atype, self.severity = atype, severity
        self.onset_ticks, self.peak_ticks, self.recovery_ticks = onset, peak, recovery
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
    """
    v3.1 changes vs v3.0
    ─────────────────────
    • Supports up to 2 simultaneous anomalies per locomotive
    • Cooldowns shortened 8× (60-300 ticks = 30s-2.5min)
    • Spawn probability raised to 35 %
    • Severity weights shifted toward moderate/severe (35/40/25)
    • Onset faster (8-25), peak longer (40-160), recovery faster (15-50)
    """

    MAX_PER_LOCO: int = 2

    def __init__(self) -> None:
        self.active: list[_AnomalySlot] = []
        self._cooldown: int = random.randint(60, 300)
        self._ticks: int = 0
        self._next_check: int = random.randint(60, 300)

    # ── helpers ──

    def has_type(self, atype: str) -> bool:
        return any(a.atype == atype for a in self.active)

    @property
    def count(self) -> int:
        return len(self.active)

    def inject(
        self,
        atype: str | None = None,
        severity: str | None = None,
    ) -> _AnomalySlot | None:
        """Force-inject an anomaly (for /inject endpoint)."""
        if len(self.active) >= self.MAX_PER_LOCO:
            return None
        at = atype or random.choice(_ANOMALY_TYPES)
        sv = severity or random.choice(["moderate", "severe"])
        slot = _AnomalySlot(at, sv, onset=8, peak=100, recovery=25)
        self.active.append(slot)
        return slot

    # ── tick ──

    def tick(self, allow_new: bool = True) -> None:
        self._ticks += 1
        # advance existing
        done_indices: list[int] = []
        for i, slot in enumerate(self.active):
            slot.tick()
            if slot.done:
                done_indices.append(i)
        for i in reversed(done_indices):
            self.active.pop(i)
            self._cooldown = random.randint(60, 300)

        if not allow_new or len(self.active) >= self.MAX_PER_LOCO:
            return
        if self._cooldown > 0:
            self._cooldown -= 1
            return
        if self._ticks >= self._next_check:
            self._ticks = 0
            self._next_check = random.randint(60, 300)
            if random.random() < 0.35:
                self._spawn()

    def _spawn(self) -> None:
        # avoid duplicating the same type
        existing_types = {a.atype for a in self.active}
        candidates = [t for t in _ANOMALY_TYPES if t not in existing_types]
        if not candidates:
            return
        atype = random.choice(candidates)
        severity = random.choices(
            ["mild", "moderate", "severe"], weights=[35, 40, 25]
        )[0]
        onset = random.randint(8, 25)
        peak = random.randint(40, 160)
        recovery = random.randint(15, 50)
        self.active.append(_AnomalySlot(atype, severity, onset, peak, recovery))

    def apply(self, state: dict) -> dict:
        for a in self.active:
            f = clamp(a.factor, 0.0, 1.0)
            si = {"mild": 0, "moderate": 1, "severe": 2}[a.severity]

            if a.atype == "brake_pressure_drift":
                tgt = [395.0, 320.0, 260.0][si]
                state["brake_pipe_pressure_kpa"] = (
                    state["brake_pipe_pressure_kpa"]
                    + (tgt - state["brake_pipe_pressure_kpa"]) * f
                )
            elif a.atype == "leak_rate_increase":
                tgt = [26.0, 32.0, 38.0][si]
                state["brake_pipe_leak_kpa_per_min"] = (
                    state["brake_pipe_leak_kpa_per_min"]
                    + (tgt - state["brake_pipe_leak_kpa_per_min"]) * f
                )
            elif a.atype == "engine_overtemp":
                tgt = [103.0, 112.0, 118.0][si]
                base = state["engine_temp_c"]
                state["engine_temp_c"] = base + (tgt - base) * f
                state["oil_temp_c"] = state["engine_temp_c"] - random.uniform(
                    2, 5
                )
            elif a.atype == "comm_degradation":
                if f > 0.3:
                    state["comm_state"] = (
                        "intermittent" if si < 2 else "offline"
                    )
            elif a.atype == "alerter_timeout":
                if f > 0.2:
                    tgt = [21.0, 24.0, 28.0][si]
                    state["alerter_timer_sec"] = tgt * f
            elif a.atype == "eab_degradation":
                if f > 0.3:
                    state["eab_status"] = "degraded" if si < 2 else "lost"
            elif a.atype == "rpm_surge":
                tgt = [1020.0, 1060.0, 1090.0][si]
                state["engine_rpm"] = (
                    state["engine_rpm"]
                    + (tgt - state["engine_rpm"]) * f
                )
            elif a.atype == "main_reservoir_drop":
                tgt = [420.0, 380.0, 340.0][si]
                state["main_reservoir_pressure_kpa"] = (
                    state["main_reservoir_pressure_kpa"]
                    + (tgt - state["main_reservoir_pressure_kpa"]) * f
                )
        return state


# ============================================================
# LOCOMOTIVE RUNTIME
# ============================================================


def _generate_loco_configs(line_cfg: dict, line: RailwayLine) -> list[dict]:
    configs = []
    ns = line.num_segments
    for i in range(LOCOS_PER_LINE):
        frac = (i + 0.5) / LOCOS_PER_LINE
        seg_f = frac * ns
        seg_idx = min(int(seg_f), ns - 1)
        seg_prog = seg_f - seg_idx
        seg_prog = clamp(seg_prog, 0.06, 0.94)
        direction = "reverse" if i in (2, 5, 8) else "forward"
        configs.append(
            {
                "serial": f"TE33A-{line_cfg['base_serial'] + i + 1:04d}",
                "train_id": f"TRN-{line_cfg['base_train'] + i + 1}",
                "line_id": line.line_id,
                "seg_idx": seg_idx,
                "seg_prog": round(seg_prog, 3),
                "direction": direction,
            }
        )
    return configs


class LocomotiveRuntime:
    def __init__(self, config: dict, line: RailwayLine) -> None:
        self.locomotive_id: str = str(uuid.uuid5(_LOCO_NS, config["serial"]))
        self.serial_number: str = config["serial"]
        self.train_id: str = config["train_id"]
        self.train_run_id: str = str(
            uuid.uuid5(_LOCO_NS, f"{config['train_id']}:run")
        )
        self.line_id: str = line.line_id
        self.line_name: str = line.name
        self.line: RailwayLine = line
        now_iso = utcnow_iso()
        self.created_at: str = now_iso

        self.route = RouteEngine(
            line, config["seg_idx"], config["seg_prog"], config["direction"]
        )
        self.alert_engine = AlertEngine(self.locomotive_id, self.line_id)
        self.anomaly_mgr = AnomalyManager()

        self.history_buffer: collections.deque = collections.deque(
            maxlen=HISTORY_MAXLEN
        )
        self.event_log: collections.deque = collections.deque(maxlen=EVENT_MAXLEN)

        self.seq: int = 0
        self.mode: str = "cruising"

        sl = line.speed_limits_data[
            min(config["seg_idx"], len(line.speed_limits_data) - 1)
        ]
        self.target_speed: float = random.uniform(sl["min_kph"], sl["max_kph"])
        self.speed_kph: float = self.target_speed * random.uniform(0.92, 1.0)
        self.throttle_pct: float = 0.35
        self.brake_demand: float = 0.0

        self.engine_rpm: float = jitter(700.0, 20)
        self.engine_temp_c: float = jitter(87.0, 3)
        self.oil_temp_c: float = self.engine_temp_c - random.uniform(5, 10)
        self.fuel_level_pct: float = random.uniform(50, 97)
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
            line_id=self.line_id,
            line_name=self.line_name,
            created_at=self.created_at,
        )
        self.train_run_model = TrainRunModel(
            train_run_id=self.train_run_id,
            train_id=self.train_id,
            locomotive_id=self.locomotive_id,
            route_id=self.line_id,
            line_id=self.line_id,
            started_at=self.created_at,
        )

        # ── v3.1: 25 % of locos start with a pre-existing anomaly ──
        if random.random() < 0.25:
            self.anomaly_mgr.inject()

        self._emit_event(
            "info",
            "system",
            "SIM_STARTED",
            f"Locomotive {self.serial_number} started on {self.line_name}",
        )

    def _emit_event(
        self,
        severity: str,
        etype: str,
        code: str,
        message: str,
        payload: dict | None = None,
    ) -> None:
        self.event_log.append(
            EventLogEntry(
                event_id=str(uuid.uuid4()),
                ts=utcnow_iso(),
                locomotive_id=self.locomotive_id,
                line_id=self.line_id,
                severity=severity,
                event_type=etype,
                code=code,
                message=message,
                payload=payload or {},
            ).model_dump()
        )

    # ── state machine ──

    def _update_mode(self) -> None:
        old = self.mode

        if self.mode in ("station_stop", "depot_stop", "idle_hold"):
            self._station_timer += 1
            if self._station_timer >= self._station_wait_ticks:
                self.mode = "accelerating"
                self._set_target()
                self._emit_event(
                    "info",
                    "status",
                    "DEPARTED_STATION",
                    f"Departed from {self.route.next_waypoint_name()}",
                    {"waypoint": self.route.next_waypoint_name()},
                )
            self._emit_mode_change(old)
            return

        in_slow, slow_lim = self.route.in_slow_zone()
        approaching = self.route.approaching_station(threshold_m=12000.0)
        in_station = self.route.in_station_geofence()
        at_end = self.route.at_endpoint(threshold_m=1500.0)

        if self.mode == "accelerating":
            if in_slow and self.speed_kph > slow_lim:
                self.mode = "braking"
                self.target_speed = slow_lim
            elif approaching and in_station:
                self.mode = "braking"
                self.target_speed = 0.0
            elif self.speed_kph >= self.target_speed * 0.95:
                self.mode = "slow_zone" if in_slow else "cruising"

        elif self.mode == "cruising":
            self._smooth_target()
            if in_slow and self.speed_kph > slow_lim:
                self.mode = "braking"
                self.target_speed = slow_lim
            elif approaching and in_station:
                self.mode = "braking"
                self.target_speed = 0.0

        elif self.mode == "slow_zone":
            if not in_slow:
                self.mode = "accelerating"
                self._set_target()
            elif approaching and in_station:
                self.mode = "braking"
                self.target_speed = 0.0

        elif self.mode == "braking":
            if at_end and in_station and self.speed_kph < 2.0:
                self.speed_kph = 0.0
                self.mode = "station_stop"
                self._station_wait_ticks = random.randint(30, 90)
                self._station_timer = 0
                wp = self.route.next_waypoint_name()
                self._emit_event(
                    "info",
                    "status",
                    "ARRIVED_STATION",
                    f"Arrived at {wp}",
                    {"waypoint": wp},
                )
            elif (
                in_slow
                and self.target_speed > 0
                and self.speed_kph <= self.target_speed * 1.05
            ):
                self.mode = "slow_zone"
            elif (
                not approaching
                and not in_slow
                and self.speed_kph < 5.0
                and not at_end
            ):
                self.mode = "accelerating"
                self._set_target()

        self._emit_mode_change(old)

    def _emit_mode_change(self, old: str) -> None:
        if self.mode != old:
            self._emit_event(
                "info",
                "status",
                "MODE_CHANGED",
                f"Mode: {old} → {self.mode}",
                {"old_mode": old, "new_mode": self.mode},
            )

    def _set_target(self) -> None:
        idx = self.route.segment_index
        sl = self.line.speed_limits_data[
            min(idx, len(self.line.speed_limits_data) - 1)
        ]
        self.target_speed = random.uniform(sl["min_kph"], sl["max_kph"])

    def _smooth_target(self) -> None:
        idx = self.route.segment_index
        sl = self.line.speed_limits_data[
            min(idx, len(self.line.speed_limits_data) - 1)
        ]
        new_t = random.uniform(sl["min_kph"], sl["max_kph"])
        self.target_speed = self.target_speed * 0.99 + new_t * 0.01

    # ── speed ──

    def _update_speed(self) -> None:
        if self.mode == "accelerating":
            self.speed_kph = min(
                self.target_speed,
                self.speed_kph + random.uniform(0.3, 0.8),
            )
            self.throttle_pct = clamp(
                self.speed_kph / max(1.0, self.target_speed), 0, 1
            )
            self.brake_demand = 0.0
        elif self.mode in ("cruising", "slow_zone"):
            self.speed_kph = clamp(
                self.speed_kph + random.uniform(-0.12, 0.12),
                self.target_speed * 0.92,
                self.target_speed * 1.03,
            )
            self.throttle_pct = clamp(
                0.30 + random.uniform(-0.05, 0.05), 0, 1
            )
            self.brake_demand = 0.0
        elif self.mode == "braking":
            self.speed_kph = max(
                0.0, self.speed_kph - random.uniform(0.5, 1.5)
            )
            self.throttle_pct = 0.0
            self.brake_demand = (
                clamp(
                    1.0 - self.speed_kph / max(1.0, self.target_speed + 20),
                    0.0,
                    1.0,
                )
                if self.target_speed > 0
                else clamp(1.0 - self.speed_kph / 120.0, 0.3, 1.0)
            )
        else:
            self.speed_kph = 0.0
            self.throttle_pct = 0.0
            self.brake_demand = 0.0

    # ── engine ──

    def _update_engine(self) -> None:
        idle, mx = 300.0, 950.0
        if self.mode == "accelerating":
            self.engine_rpm = lerp(idle, mx, self.throttle_pct)
            self.traction_voltage_v = lerp(200, 1200, self.throttle_pct)
            self.current_a = lerp(50, 1000, self.throttle_pct)
            self.tractive_effort_kn = lerp(50, 700, self.throttle_pct)
            self.dynamic_brake_force_kn = 0.0
            self.fuel_consumption_rate_lph = lerp(30, 450, self.throttle_pct)
            self.brake_cylinder_pressure_kpa = 0.0
            self.brake_status = "release"
        elif self.mode in ("cruising", "slow_zone"):
            gf = clamp(
                1.0 + self.route.track_grade_pct() * 0.15, 0.5, 2.0
            )
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
            self.engine_rpm += (idle - self.engine_rpm) * 0.05
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
        else:
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

    # ── v3.1 FIX: thermal model respects overtemp anomaly ──
    def _update_thermal(self) -> None:
        if self.anomaly_mgr.has_type("engine_overtemp"):
            # let anomaly.apply() drive temperature — only add tiny jitter
            self.engine_temp_c = jitter(self.engine_temp_c, 0.1)
            self.oil_temp_c = jitter(self.oil_temp_c, 0.1)
            return
        tgt = {
            "station_stop": 75.0,
            "depot_stop": 75.0,
            "idle_hold": 75.0,
            "cruising": 88.0,
            "slow_zone": 86.0,
            "braking": 80.0,
        }.get(self.mode, 88.0 + self.throttle_pct * 10.0)
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
            self.fuel_level_pct = random.uniform(82, 97)

    # ── v3.1 FIX: brake baseline respects active anomalies ──
    def _update_brakes_baseline(self) -> None:
        if not self.anomaly_mgr.has_type("brake_pressure_drift"):
            self.brake_pipe_pressure_kpa = jitter(480.0, 2.5)
        # else: anomaly controls this value — don't reset

        if not self.anomaly_mgr.has_type("main_reservoir_drop"):
            self.main_reservoir_pressure_kpa = jitter(800.0, 5)

        if not self.anomaly_mgr.has_type("leak_rate_increase"):
            self.brake_pipe_leak_kpa_per_min = jitter(3.5, 1.0)

        self.battery_voltage_v = jitter(74.0, 0.15)

    # ── v3.1 FIX: safety systems respect active anomalies ──
    def _update_safety(self) -> None:
        if not self.anomaly_mgr.has_type("alerter_timeout"):
            self.alerter_timer_sec += TICK_INTERVAL
            if self.alerter_timer_sec >= self._alerter_reset_at:
                self.alerter_timer_sec = 0.0
                self._alerter_reset_at = random.uniform(10, 18)
        # else: anomaly controls alerter_timer_sec

        if not self.anomaly_mgr.has_type("comm_degradation"):
            self.comm_state = "online"

        if not self.anomaly_mgr.has_type("eab_degradation"):
            self.eab_status = "online"

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

    # ── health (BEFORE alerts) ──

    def _compute_health(self, state: dict) -> int:
        s = 100.0
        bp = state["brake_pipe_pressure_kpa"]
        if bp < 420:
            s -= remap(bp, 280, 420, 35, 0)
        leak = state["brake_pipe_leak_kpa_per_min"]
        if leak > 10:
            s -= remap(leak, 10, 36, 0, 20)
        et = state["engine_temp_c"]
        if et > 95:
            s -= remap(et, 95, 115, 0, 25)
        ot = state["oil_temp_c"]
        if ot > 100:
            s -= remap(ot, 100, 115, 0, 20)
        mr = state["main_reservoir_pressure_kpa"]
        if mr < 600:
            s -= remap(mr, 340, 600, 20, 0)
        rpm = state["engine_rpm"]
        if rpm > 1000:
            s -= remap(rpm, 1000, 1100, 0, 15)
        if state["comm_state"] == "intermittent":
            s -= 5
        if state["comm_state"] == "offline":
            s -= 15
        if state["eab_status"] == "degraded":
            s -= 8
        if state["eab_status"] == "lost":
            s -= 20
        return max(0, min(100, int(s)))

    # ── main tick ──

    def tick(self, allow_new_anomaly: bool = True) -> dict:
        self.seq += 1
        self._update_mode()
        self._update_speed()

        seg_changed, _ = self.route.update(self.speed_kph)
        if seg_changed:
            self._emit_event(
                "info",
                "status",
                "SEGMENT_CHANGED",
                f"Entered segment: {self.route.segment_name()}",
                {"segment": self.route.segment_name()},
            )

        for gf in self.route.geofence_entered():
            c = (
                "SLOW_ZONE_ENTER"
                if gf.type == "slow_zone"
                else "ENTER_GEOFENCE"
            )
            self._emit_event(
                "info",
                "geofence",
                c,
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
        self._update_brakes_baseline()  # ← renamed
        self._update_safety()

        self.anomaly_mgr.tick(allow_new=allow_new_anomaly)

        pgf = self.route.primary_geofence()
        state: dict[str, Any] = {
            "ts": utcnow_iso(),
            "locomotive_id": self.locomotive_id,
            "serial_number": self.serial_number,
            "train_id": self.train_id,
            "line_id": self.line_id,
            "line_name": self.line_name,
            "seq": self.seq,
            "train_run_id": self.train_run_id,
            "route_id": self.line_id,
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

        # ── v3.1: write-back ALL anomaly-affected values ──
        self.brake_pipe_pressure_kpa = state["brake_pipe_pressure_kpa"]
        self.main_reservoir_pressure_kpa = state[
            "main_reservoir_pressure_kpa"
        ]
        self.brake_pipe_leak_kpa_per_min = state[
            "brake_pipe_leak_kpa_per_min"
        ]
        self.engine_temp_c = state["engine_temp_c"]
        self.oil_temp_c = state["oil_temp_c"]
        self.engine_rpm = state["engine_rpm"]
        self.comm_state = state["comm_state"]
        self.eab_status = state["eab_status"]
        self.alerter_timer_sec = state["alerter_timer_sec"]

        self.health_index = self._compute_health(state)
        state["health_index"] = self.health_index

        self.alarm_status, self.fault_codes = self.alert_engine.evaluate(
            state, self.event_log
        )
        state["alarm_status"] = self.alarm_status
        state["fault_codes"] = list(self.fault_codes)

        self.latest_telemetry = state
        self.history_buffer.append(state)

        self.current_state_snapshot = LocomotiveStateCurrent(
            locomotive_id=self.locomotive_id,
            serial_number=self.serial_number,
            train_id=self.train_id,
            line_id=self.line_id,
            line_name=self.line_name,
            updated_at=utcnow_iso(),
            last_ts=state["ts"],
            lat=state["lat"],
            lon=state["lon"],
            alt_m=state["alt_m"],
            speed_kph=state["speed_kph"],
            heading_deg=state["heading_deg"],
            brake_status=state["brake_status"],
            comm_state=state["comm_state"],
            eab_status=state["eab_status"],
            health_index=state["health_index"],
            alarm_status=state["alarm_status"],
            active_faults=state["fault_codes"],
            active_geofences=state["active_geofences"],
            current_mode=state["current_mode"],
            fuel_level_pct=state["fuel_level_pct"],
            engine_rpm=state["engine_rpm"],
            engine_temp_c=state["engine_temp_c"],
            direction=self.route.direction,
            segment_name=self.route.segment_name(),
        ).model_dump()

        return state


# ============================================================
# FLEET SIMULATOR
# ============================================================


class FleetSimulator:
    def __init__(self) -> None:
        self.runtimes: dict[str, LocomotiveRuntime] = {}
        self._ordered_ids: list[str] = []
        self._line_locos: dict[str, list[str]] = {}
        self.global_seq: int = 0

        for lcfg in LINES_CONFIG:
            line = RAILWAY_LINES[lcfg["line_id"]]
            loco_configs = _generate_loco_configs(lcfg, line)
            line_ids: list[str] = []
            for cfg in loco_configs:
                rt = LocomotiveRuntime(cfg, line)
                self.runtimes[rt.locomotive_id] = rt
                self._ordered_ids.append(rt.locomotive_id)
                line_ids.append(rt.locomotive_id)
            self._line_locos[line.line_id] = line_ids

    @property
    def fleet_size(self) -> int:
        return len(self.runtimes)

    @property
    def active_anomaly_count(self) -> int:
        return sum(rt.anomaly_mgr.count for rt in self.runtimes.values())

    def tick_all(self) -> list[dict]:
        self.global_seq += 1
        anom_count = sum(
            rt.anomaly_mgr.count for rt in self.runtimes.values()
        )
        results: list[dict] = []
        for lid in self._ordered_ids:
            rt = self.runtimes[lid]
            allow = (
                anom_count < MAX_FLEET_ANOMALIES
                or rt.anomaly_mgr.count > 0
            )
            state = rt.tick(allow_new_anomaly=allow)
            results.append(state)
            if rt.anomaly_mgr.count > 0:
                anom_count = sum(
                    r.anomaly_mgr.count for r in self.runtimes.values()
                )
        return results

    def get_runtime(self, loco_id: str) -> LocomotiveRuntime | None:
        return self.runtimes.get(loco_id)

    def all_runtimes(self) -> list[LocomotiveRuntime]:
        return [self.runtimes[lid] for lid in self._ordered_ids]

    def line_runtimes(self, line_id: str) -> list[LocomotiveRuntime]:
        ids = self._line_locos.get(line_id, [])
        return [self.runtimes[lid] for lid in ids]

    def build_fleet_summary(
        self, runtimes: list[LocomotiveRuntime] | None = None
    ) -> dict:
        rts = runtimes if runtimes is not None else self.all_runtimes()
        locos: list[dict] = []
        warn_c, crit_c, active_c, stopped_c, total_hi = 0, 0, 0, 0, 0.0
        for rt in rts:
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
        line_summaries = []
        for line_id, line in RAILWAY_LINES.items():
            l_rts = self.line_runtimes(line_id)
            l_active = sum(
                1
                for r in l_rts
                if r.current_state_snapshot
                and r.current_state_snapshot["current_mode"]
                not in ("station_stop", "depot_stop", "idle_hold")
            )
            l_warn = sum(
                1
                for r in l_rts
                if r.current_state_snapshot
                and r.current_state_snapshot["alarm_status"] == "warning"
            )
            l_crit = sum(
                1
                for r in l_rts
                if r.current_state_snapshot
                and r.current_state_snapshot["alarm_status"] == "critical"
            )
            l_hi = [
                r.current_state_snapshot["health_index"]
                for r in l_rts
                if r.current_state_snapshot
            ]
            line_summaries.append(
                {
                    "line_id": line_id,
                    "name": line.name,
                    "locomotive_count": len(l_rts),
                    "active_count": l_active,
                    "warning_count": l_warn,
                    "critical_count": l_crit,
                    "average_health_index": round(
                        sum(l_hi) / max(1, len(l_hi)), 1
                    ),
                }
            )
        return FleetSummary(
            total_locomotives=len(locos),
            active_count=active_c,
            stopped_count=stopped_c,
            warning_count=warn_c,
            critical_count=crit_c,
            average_health_index=round(total_hi / n, 1),
            lines=line_summaries,
            locomotives=locos,
        ).model_dump()


# ============================================================
# WEBSOCKET REGISTRY
# ============================================================


@dataclasses.dataclass
class _WSClient:
    websocket: WebSocket
    queue: asyncio.Queue
    locomotive_id: str | None
    line_id: str | None


_ws_clients: dict[int, _WSClient] = {}


def _broadcast(state: dict) -> None:
    lid = state["locomotive_id"]
    line_id = state.get("line_id")
    for cid, c in list(_ws_clients.items()):
        send = False
        if c.locomotive_id is None and c.line_id is None:
            send = True
        elif c.locomotive_id == lid:
            send = True
        elif (
            c.line_id is not None
            and c.line_id == line_id
            and c.locomotive_id is None
        ):
            send = True
        if send:
            try:
                c.queue.put_nowait(state)
            except asyncio.QueueFull:
                pass


async def _ws_handler(websocket: WebSocket, queue: asyncio.Queue) -> None:
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

    done, pending = await asyncio.wait(
        [
            asyncio.create_task(_sender()),
            asyncio.create_task(_receiver()),
        ],
        return_when=asyncio.FIRST_COMPLETED,
    )
    for t in pending:
        t.cancel()


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="TE33A Multi-Line Fleet Telemetry Service", version="3.1.0"
)
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
    if _sim_task:
        _sim_task.cancel()
        try:
            await _sim_task
        except asyncio.CancelledError:
            pass


def _rt_or_404(loco_id: str) -> LocomotiveRuntime:
    assert fleet is not None
    rt = fleet.get_runtime(loco_id)
    if rt is None:
        raise HTTPException(404, "Locomotive not found")
    return rt


def _line_or_404(line_id: str) -> RailwayLine:
    line = RAILWAY_LINES.get(line_id)
    if line is None:
        raise HTTPException(404, "Line not found")
    return line


# ────────────────────────────────────────
#  REST ENDPOINTS
# ────────────────────────────────────────

# ── health ──


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        uptime_sec=round(time.monotonic() - _start_mono, 1),
        tick_count=fleet.global_seq if fleet else 0,
        fleet_size=fleet.fleet_size if fleet else 0,
        num_lines=len(RAILWAY_LINES),
        active_anomalies=fleet.active_anomaly_count if fleet else 0,
    )


# ── lines ──


@app.get("/lines")
async def list_lines() -> list[dict]:
    assert fleet is not None
    return [
        line.info_model(len(fleet.line_runtimes(line.line_id)))
        for line in RAILWAY_LINES.values()
    ]


@app.get("/lines/{line_id}")
async def get_line(line_id: str) -> dict:
    assert fleet is not None
    line = _line_or_404(line_id)
    return line.info_model(len(fleet.line_runtimes(line_id)))


@app.get("/lines/{line_id}/fleet")
async def line_fleet(line_id: str) -> dict:
    assert fleet is not None
    _line_or_404(line_id)
    rts = fleet.line_runtimes(line_id)
    return fleet.build_fleet_summary(rts)


@app.get("/lines/{line_id}/locomotives")
async def line_locos(line_id: str) -> list[dict]:
    assert fleet is not None
    _line_or_404(line_id)
    return [
        {
            "locomotive": rt.locomotive_model.model_dump(),
            "train_run": rt.train_run_model.model_dump(),
        }
        for rt in fleet.line_runtimes(line_id)
    ]


@app.get("/lines/{line_id}/latest")
async def line_latest(line_id: str) -> list[dict]:
    assert fleet is not None
    _line_or_404(line_id)
    return [
        rt.latest_telemetry
        for rt in fleet.line_runtimes(line_id)
        if rt.latest_telemetry
    ]


@app.get("/lines/{line_id}/events")
async def line_events(
    line_id: str, limit: int = Query(default=100, ge=1, le=5000)
) -> list[dict]:
    assert fleet is not None
    _line_or_404(line_id)
    merged: list[dict] = []
    for rt in fleet.line_runtimes(line_id):
        merged.extend(list(rt.event_log))
    merged.sort(key=lambda e: e.get("ts", ""), reverse=True)
    return merged[:limit]


# ── fleet (global) ──


@app.get("/fleet")
async def fleet_overview() -> dict:
    assert fleet is not None
    return fleet.build_fleet_summary()


@app.get("/fleet/latest")
async def fleet_latest() -> list[dict]:
    assert fleet is not None
    return [
        rt.latest_telemetry
        for rt in fleet.all_runtimes()
        if rt.latest_telemetry
    ]


@app.get("/fleet/states")
async def fleet_states() -> list[dict]:
    assert fleet is not None
    return [
        rt.current_state_snapshot
        for rt in fleet.all_runtimes()
        if rt.current_state_snapshot
    ]


@app.get("/fleet/events")
async def fleet_events(
    limit: int = Query(default=200, ge=1, le=10000),
) -> list[dict]:
    assert fleet is not None
    merged: list[dict] = []
    for rt in fleet.all_runtimes():
        merged.extend(list(rt.event_log))
    merged.sort(key=lambda e: e.get("ts", ""), reverse=True)
    return merged[:limit]


# ── v3.1: anomaly injection endpoints ──


@app.post("/locomotives/{locomotive_id}/inject")
async def inject_anomaly(
    locomotive_id: str,
    anomaly_type: str = Query(default="random"),
    severity: str = Query(default="severe"),
) -> dict:
    """Manually inject an anomaly into a specific locomotive for testing."""
    rt = _rt_or_404(locomotive_id)
    if anomaly_type == "random":
        anomaly_type = random.choice(_ANOMALY_TYPES)
    if anomaly_type not in _ANOMALY_TYPES:
        raise HTTPException(
            400,
            f"Unknown anomaly_type. Valid: {_ANOMALY_TYPES}",
        )
    if severity not in ("mild", "moderate", "severe"):
        raise HTTPException(
            400, "severity must be: mild, moderate, severe"
        )
    slot = rt.anomaly_mgr.inject(atype=anomaly_type, severity=severity)
    if slot is None:
        raise HTTPException(
            409,
            f"Locomotive already has {rt.anomaly_mgr.MAX_PER_LOCO} active anomalies",
        )
    rt._emit_event(
        "warning",
        "anomaly",
        "ANOMALY_INJECTED",
        f"Injected {anomaly_type} ({severity})",
        {"anomaly_type": anomaly_type, "severity": severity},
    )
    return {
        "status": "injected",
        "locomotive_id": locomotive_id,
        "serial_number": rt.serial_number,
        "anomaly_type": anomaly_type,
        "severity": severity,
        "active_anomalies": [
            {"type": a.atype, "severity": a.severity, "phase": a.phase}
            for a in rt.anomaly_mgr.active
        ],
    }


@app.post("/fleet/stress_test")
async def fleet_stress_test(
    count: int = Query(default=15, ge=1, le=40),
) -> dict:
    """Inject severe anomalies into random locomotives fleet-wide."""
    assert fleet is not None
    rts = random.sample(
        fleet.all_runtimes(), min(count, fleet.fleet_size)
    )
    injected: list[dict] = []
    for rt in rts:
        atype = random.choice(_ANOMALY_TYPES)
        severity = random.choices(
            ["moderate", "severe"], weights=[30, 70]
        )[0]
        slot = rt.anomaly_mgr.inject(atype=atype, severity=severity)
        if slot:
            rt._emit_event(
                "warning",
                "anomaly",
                "ANOMALY_INJECTED",
                f"Stress test: {atype} ({severity})",
                {"anomaly_type": atype, "severity": severity},
            )
            injected.append(
                {
                    "locomotive_id": rt.locomotive_id,
                    "serial": rt.serial_number,
                    "line": rt.line_id,
                    "anomaly": atype,
                    "severity": severity,
                }
            )
    return {"injected_count": len(injected), "details": injected}


@app.get("/fleet/anomalies")
async def fleet_anomalies() -> list[dict]:
    """Show all currently active anomalies across the fleet."""
    assert fleet is not None
    result: list[dict] = []
    for rt in fleet.all_runtimes():
        for a in rt.anomaly_mgr.active:
            result.append(
                {
                    "locomotive_id": rt.locomotive_id,
                    "serial_number": rt.serial_number,
                    "line_id": rt.line_id,
                    "anomaly_type": a.atype,
                    "severity": a.severity,
                    "phase": a.phase,
                    "factor": round(a.factor, 3),
                    "elapsed": a.elapsed,
                    "total_ticks": a.total_ticks,
                    "remaining_ticks": a.total_ticks - a.elapsed,
                }
            )
    return result


# ── locomotives ──


@app.get("/locomotives")
async def list_locos() -> list[dict]:
    assert fleet is not None
    return [
        {
            "locomotive": rt.locomotive_model.model_dump(),
            "train_run": rt.train_run_model.model_dump(),
        }
        for rt in fleet.all_runtimes()
    ]


@app.get("/locomotives/{locomotive_id}")
async def get_loco(locomotive_id: str) -> dict:
    rt = _rt_or_404(locomotive_id)
    return {
        "locomotive": rt.locomotive_model.model_dump(),
        "train_run": rt.train_run_model.model_dump(),
    }


@app.get("/locomotives/{locomotive_id}/latest")
async def loco_latest(locomotive_id: str) -> dict:
    rt = _rt_or_404(locomotive_id)
    return rt.latest_telemetry or {"error": "no data yet"}


@app.get("/locomotives/{locomotive_id}/state/current")
async def loco_state(locomotive_id: str) -> dict:
    rt = _rt_or_404(locomotive_id)
    return rt.current_state_snapshot or {"error": "no data yet"}


@app.get("/locomotives/{locomotive_id}/history")
async def loco_history(
    locomotive_id: str,
    seconds: int = Query(default=300, ge=1, le=HISTORY_SECONDS),
) -> list[dict]:
    rt = _rt_or_404(locomotive_id)
    n = int(seconds * STREAM_HZ)
    return list(rt.history_buffer)[-n:]


@app.get("/locomotives/{locomotive_id}/events")
async def loco_events(
    locomotive_id: str,
    limit: int = Query(default=100, ge=1, le=5000),
) -> list[dict]:
    rt = _rt_or_404(locomotive_id)
    items = list(rt.event_log)
    items.reverse()
    return items[:limit]


# ── route ──


@app.get("/route")
async def get_all_routes() -> list[dict]:
    return [
        {
            "line_id": line.line_id,
            "name": line.name,
            "waypoints": [w.model_dump() for w in line.waypoints],
            "speed_limits": [s.model_dump() for s in line.speed_limits],
            "geofences": [g.model_dump() for g in line.geofences],
            "total_distance_km": round(line.total_distance_km, 1),
        }
        for line in RAILWAY_LINES.values()
    ]


@app.get("/route/progress/{locomotive_id}")
async def route_progress(locomotive_id: str) -> dict:
    rt = _rt_or_404(locomotive_id)
    r = rt.route
    return RouteProgressModel(
        locomotive_id=rt.locomotive_id,
        line_id=rt.line_id,
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


# ── websockets ──


@app.websocket("/ws/telemetry")
async def ws_all(websocket: WebSocket) -> None:
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue(maxsize=WS_QUEUE_MAX)
    cid = id(websocket)
    _ws_clients[cid] = _WSClient(
        websocket, queue, locomotive_id=None, line_id=None
    )
    try:
        await _ws_handler(websocket, queue)
    finally:
        _ws_clients.pop(cid, None)


@app.websocket("/ws/telemetry/{locomotive_id}")
async def ws_single(
    websocket: WebSocket, locomotive_id: str
) -> None:
    await websocket.accept()
    if fleet and fleet.get_runtime(locomotive_id) is None:
        await websocket.close(code=4004, reason="Locomotive not found")
        return
    queue: asyncio.Queue = asyncio.Queue(maxsize=WS_QUEUE_MAX)
    cid = id(websocket)
    _ws_clients[cid] = _WSClient(
        websocket, queue, locomotive_id=locomotive_id, line_id=None
    )
    try:
        await _ws_handler(websocket, queue)
    finally:
        _ws_clients.pop(cid, None)


@app.websocket("/ws/line/{line_id}")
async def ws_line(websocket: WebSocket, line_id: str) -> None:
    await websocket.accept()
    if line_id not in RAILWAY_LINES:
        await websocket.close(code=4004, reason="Line not found")
        return
    queue: asyncio.Queue = asyncio.Queue(maxsize=WS_QUEUE_MAX)
    cid = id(websocket)
    _ws_clients[cid] = _WSClient(
        websocket, queue, locomotive_id=None, line_id=line_id
    )
    try:
        await _ws_handler(websocket, queue)
    finally:
        _ws_clients.pop(cid, None)


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=DEFAULT_HOST, port=DEFAULT_PORT, log_level="info")