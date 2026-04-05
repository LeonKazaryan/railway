from __future__ import annotations

import asyncio
import collections
import dataclasses
import heapq
import json
import math
import os
import random
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

# ============================================================
# CONFIGURATION
# ============================================================

FLEET_SIZE: int = 25
SINGLE_TRAIN_SPEED_KPH: float = float(os.environ.get("SINGLE_TRAIN_SPEED_KPH", "18"))
_MODEL_ROTATION: tuple[str, ...] = ("KZ4A", "KZ8A", "TE33A")
STREAM_HZ: float = 2.0
TICK_INTERVAL: float = 1.0 / STREAM_HZ
HISTORY_SECONDS: int = 1800
HISTORY_MAXLEN: int = HISTORY_SECONDS * int(STREAM_HZ)
EVENT_MAXLEN: int = 5000
DEFAULT_HOST: str = "0.0.0.0"
DEFAULT_PORT: int = 8000
TOTAL_FUEL_L: float = 6000.0
WS_QUEUE_MAX: int = 512
MAX_FLEET_ANOMALIES: int = 12
SIM_SEED: int | None = (
    int(os.environ["SIM_SEED"]) if os.environ.get("SIM_SEED") else None
)
NETWORK_ID: str = "kz-synthetic-150"
NETWORK_NAME: str = "Kazakhstan Synthetic Railway Network"
NETWORK_JSON_ENV: str = "NETWORK_JSON_PATH"
NETWORK_STATIONS_ENV: str = "NETWORK_STATIONS_CSV"
NETWORK_EDGES_ENV: str = "NETWORK_EDGES_CSV"
STATION_GEOFENCE_RADIUS_M: float = 2200.0
APPROACH_THRESHOLD_M: float = 18000.0
ARRIVAL_THRESHOLD_M: float = 1200.0
MIN_ROUTE_DISTANCE_KM: float = 120.0
MAX_ROUTE_RETRIES: int = 40
ROUTE_DISPLAY_SAMPLE_STEP_M: float = 5_000.0

if SIM_SEED is not None:
    random.seed(SIM_SEED)

SINGLE_TRAIN_MODE: bool = FLEET_SIZE <= 1

# ============================================================
# UTILITIES
# ============================================================

_R_EARTH_M = 6_371_000.0
_LOCO_NS = uuid.UUID("7f3b4d2e-1a9c-4e5f-b8d6-3c7a2f1e9d0b")


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    rlat1, rlon1 = math.radians(lat1), math.radians(lon1)
    rlat2, rlon2 = math.radians(lat2), math.radians(lon2)
    dlat, dlon = rlat2 - rlat1, rlon2 - rlon1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    )
    return _R_EARTH_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def great_circle_interpolate(
    lat1: float, lon1: float, lat2: float, lon2: float, t: float
) -> tuple[float, float]:
    t = max(0.0, min(1.0, t))
    if t <= 0.0:
        return lat1, lon1
    if t >= 1.0:
        return lat2, lon2
    φ1 = math.radians(lat1)
    λ1 = math.radians(lon1)
    φ2 = math.radians(lat2)
    λ2 = math.radians(lon2)
    dlat = φ2 - φ1
    dlon = λ2 - λ1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(φ1) * math.cos(φ2) * math.sin(dlon / 2) ** 2
    )
    d = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    if d < 1e-12:
        return lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t
    sd = math.sin(d)
    a_frac = math.sin((1 - t) * d) / sd
    b_frac = math.sin(t * d) / sd
    x = a_frac * math.cos(φ1) * math.cos(λ1) + b_frac * math.cos(φ2) * math.cos(λ2)
    y = a_frac * math.cos(φ1) * math.sin(λ1) + b_frac * math.cos(φ2) * math.sin(λ2)
    z = a_frac * math.sin(φ1) + b_frac * math.sin(φ2)
    φi = math.atan2(z, math.sqrt(x * x + y * y))
    λi = math.atan2(y, x)
    return math.degrees(φi), math.degrees(λi)


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


def slugify_station(name: str) -> str:
    chars = []
    for ch in name.lower():
        if ch.isalnum():
            chars.append(ch)
        elif ch in {" ", "-", "_"}:
            chars.append("-")
    text = "".join(chars).strip("-")
    while "--" in text:
        text = text.replace("--", "-")
    return text or "station"


def synthetic_altitude(lat: float, lon: float) -> float:
    base = 260.0 + (lat - 41.0) * 18.0 + (lon - 51.0) * 2.3
    wave = 110.0 * math.sin(math.radians(lat * 4.2))
    ridge = 75.0 * math.cos(math.radians(lon * 2.6))
    return round(clamp(base + wave + ridge, 40.0, 1450.0), 1)


# ============================================================
# PYDANTIC MODELS
# ============================================================


class GeofenceModel(BaseModel):
    geofence_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str
    center_lat: float
    center_lon: float
    radius_m: float
    rules: dict = Field(default_factory=dict)


class StationModel(BaseModel):
    station_id: str
    station_name: str
    anchor: str
    lat: float
    lon: float
    alt_m: float
    kind: str


class EdgeModel(BaseModel):
    edge_id: str
    from_station: str
    to_station: str
    edge_type: str
    approx_km: float


class LocomotiveModel(BaseModel):
    locomotive_id: str
    model: str = "TE33A"
    serial_number: str
    operator_name: str = "KTZ Express"
    manufactured_year: int = 2023
    network_id: str
    network_name: str
    created_at: str


class TrainRunModel(BaseModel):
    train_run_id: str
    train_id: str
    locomotive_id: str
    route_id: str
    started_at: str
    ended_at: str | None = None
    status: str = "active"


class RouteProgressModel(BaseModel):
    locomotive_id: str
    route_id: str
    origin_station: str
    destination_station: str
    current_station: str
    next_station_name: str
    active_segment_index: int
    active_segment_name: str
    segment_progress: float
    distance_to_next_waypoint_km: float
    route_remaining_km: float
    lat: float
    lon: float
    alt_m: float
    heading_deg: float
    active_geofences: list[str]
    path_stations: list[str]


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
    segment_name: str
    origin_station: str
    destination_station: str
    route_remaining_km: float
    path_stations: list[str]


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
    locomotives: list[dict]


class HealthResponse(BaseModel):
    status: str = "ok"
    uptime_sec: float
    tick_count: int
    fleet_size: int
    active_anomalies: int
    network_id: str


# ============================================================
# NETWORK GRAPH
# ============================================================


@dataclasses.dataclass(frozen=True)
class Station:
    station_id: str
    station_name: str
    anchor: str
    lat: float
    lon: float
    alt_m: float
    kind: str


@dataclasses.dataclass(frozen=True)
class Edge:
    edge_id: str
    from_station: str
    to_station: str
    edge_type: str
    length_m: float


def densify_graph_edges(
    stations: list[Station],
    edges: list[Edge],
    max_segment_m: float,
) -> tuple[list[Station], list[Edge]]:
    if max_segment_m <= 0:
        return stations, edges
    by_name: dict[str, Station] = {s.station_name: s for s in stations}
    out_stations: list[Station] = list(stations)
    new_edges: list[Edge] = []
    wp_counter = 0

    for e in edges:
        sa = by_name.get(e.from_station)
        sb = by_name.get(e.to_station)
        if sa is None or sb is None:
            new_edges.append(e)
            continue
        dist = e.length_m
        if dist <= max_segment_m:
            new_edges.append(e)
            continue
        n_sub = max(2, int(math.ceil(dist / max_segment_m)))
        prev_name = e.from_station
        prev_s = sa
        for k in range(1, n_sub + 1):
            if k == n_sub:
                next_name = e.to_station
                next_s = sb
            else:
                t = k / n_sub
                lat, lon = great_circle_interpolate(
                    sa.lat, sa.lon, sb.lat, sb.lon, t
                )
                wp_counter += 1
                next_name = f"__waypoint_{wp_counter}"
                alt = synthetic_altitude(lat, lon)
                st = Station(
                    station_id=f"via-{wp_counter}",
                    station_name=next_name,
                    anchor=next_name,
                    lat=lat,
                    lon=lon,
                    alt_m=alt,
                    kind="waypoint",
                )
                out_stations.append(st)
                by_name[next_name] = st
                next_s = st
            seg_len = haversine(prev_s.lat, prev_s.lon, next_s.lat, next_s.lon)
            new_edges.append(
                Edge(
                    edge_id=f"{e.edge_id}_s{k-1}",
                    from_station=prev_name,
                    to_station=next_name,
                    edge_type=e.edge_type,
                    length_m=seg_len,
                )
            )
            prev_name = next_name
            prev_s = next_s

    return out_stations, new_edges


def maybe_densify_network(
    stations: list[Station], edges: list[Edge]
) -> tuple[list[Station], list[Edge]]:
    raw = os.environ.get("NETWORK_DENSIFY_MAX_M", "90000")
    if not raw or raw.strip().lower() in ("0", "off", "false", "no"):
        return stations, edges
    try:
        max_m = float(raw)
    except ValueError:
        return stations, edges
    if max_m <= 0:
        return stations, edges
    return densify_graph_edges(stations, edges, max_m)


class GraphNetwork:
    def __init__(self, stations: list[Station], edges: list[Edge]) -> None:
        self.network_id = NETWORK_ID
        self.name = NETWORK_NAME
        self.stations_by_name: dict[str, Station] = {
            s.station_name: s for s in stations
        }
        self.station_names: list[str] = sorted(self.stations_by_name.keys())
        self.station_models: list[StationModel] = [
            StationModel(
                station_id=s.station_id,
                station_name=s.station_name,
                anchor=s.anchor,
                lat=s.lat,
                lon=s.lon,
                alt_m=s.alt_m,
                kind=s.kind,
            )
            for s in stations
        ]
        self.geofences: list[GeofenceModel] = [
            GeofenceModel(
                geofence_id=str(
                    uuid.uuid5(uuid.NAMESPACE_DNS, f"station:{s.station_name}")
                ),
                name=f"{slugify_station(s.station_name)}_station",
                type="station",
                center_lat=s.lat,
                center_lon=s.lon,
                radius_m=STATION_GEOFENCE_RADIUS_M,
            )
            for s in stations
        ]
        self.geofence_by_station: dict[str, GeofenceModel] = {
            s.station_name: gf for s, gf in zip(stations, self.geofences)
        }
        self.edges_by_pair: dict[frozenset[str], Edge] = {}
        self.edge_models: list[EdgeModel] = []
        self.adj: dict[str, list[tuple[str, float, Edge]]] = {
            s.station_name: [] for s in stations
        }
        for edge in edges:
            key = frozenset((edge.from_station, edge.to_station))
            self.edges_by_pair[key] = edge
            self.edge_models.append(
                EdgeModel(
                    edge_id=edge.edge_id,
                    from_station=edge.from_station,
                    to_station=edge.to_station,
                    edge_type=edge.edge_type,
                    approx_km=round(edge.length_m / 1000.0, 1),
                )
            )
            self.adj[edge.from_station].append((edge.to_station, edge.length_m, edge))
            self.adj[edge.to_station].append((edge.from_station, edge.length_m, edge))
        self.total_distance_km = round(sum(e.length_m for e in edges) / 1000.0, 1)

    @classmethod
    def load(cls) -> "GraphNetwork":
        here = Path(__file__).resolve().parent
        candidates_json = [
            os.environ.get(NETWORK_JSON_ENV),
            str(here / "kz_railway_network.json"),
            str(here / "kz_synthetic_network_150_244.json"),
            str(here / "kz_synthetic_network_150_244(2).json"),
            "/mnt/data/kz_synthetic_network_150_244.json",
        ]
        for path_str in candidates_json:
            if not path_str:
                continue
            p = Path(path_str)
            if p.exists():
                with p.open("r", encoding="utf-8") as f:
                    payload = json.load(f)
                stations: list[Station] = []
                for raw in payload["stations"]:
                    stations.append(
                        Station(
                            station_id=str(raw["station_id"]),
                            station_name=raw["station_name"],
                            anchor=raw.get("anchor", raw["station_name"]),
                            lat=float(raw["lat"]),
                            lon=float(raw["lon"]),
                            alt_m=float(raw.get("alt_m") or synthetic_altitude(float(raw["lat"]), float(raw["lon"]))),
                            kind=raw.get("kind", "synthetic"),
                        )
                    )
                edges: list[Edge] = []
                for raw in payload["edges"]:
                    a = raw["from_station"]
                    b = raw["to_station"]
                    sa, sb = next(s for s in stations if s.station_name == a), next(s for s in stations if s.station_name == b)
                    length_m = haversine(sa.lat, sa.lon, sb.lat, sb.lon)
                    edges.append(
                        Edge(
                            edge_id=str(raw["edge_id"]),
                            from_station=a,
                            to_station=b,
                            edge_type=raw.get("edge_type", "corridor"),
                            length_m=length_m,
                        )
                    )
                stations, edges = maybe_densify_network(stations, edges)
                return cls(stations, edges)

        import csv

        env_s = os.environ.get(NETWORK_STATIONS_ENV)
        env_e = os.environ.get(NETWORK_EDGES_ENV)
        csv_pairs: list[tuple[str, str]] = []
        if env_s and env_e:
            csv_pairs.append((env_s, env_e))
        csv_pairs.extend(
            [
                (
                    str(here / "kz_synthetic_stations_150.csv"),
                    str(here / "kz_synthetic_edges_244.csv"),
                ),
                (
                    str(here / "kz_synthetic_stations_150(2).csv"),
                    str(here / "kz_synthetic_edges_244(1).csv"),
                ),
                (
                    "/mnt/data/kz_synthetic_stations_150.csv",
                    "/mnt/data/kz_synthetic_edges_244.csv",
                ),
            ]
        )
        stations_csv: str | None = None
        edges_csv: str | None = None
        for sc, ec in csv_pairs:
            if Path(sc).exists() and Path(ec).exists():
                stations_csv, edges_csv = sc, ec
                break
        if stations_csv is None or edges_csv is None:
            raise RuntimeError("Network files not found. Provide NETWORK_JSON_PATH or CSV paths.")

        stations: list[Station] = []
        with open(stations_csv, newline="", encoding="utf-8") as f:
            for raw in csv.DictReader(f):
                lat = float(raw["lat"])
                lon = float(raw["lon"])
                stations.append(
                    Station(
                        station_id=str(raw["station_id"]),
                        station_name=raw["station_name"],
                        anchor=raw.get("anchor", raw["station_name"]),
                        lat=lat,
                        lon=lon,
                        alt_m=synthetic_altitude(lat, lon),
                        kind=raw.get("kind", "synthetic"),
                    )
                )
        stations_by_name = {s.station_name: s for s in stations}
        edges: list[Edge] = []
        with open(edges_csv, newline="", encoding="utf-8") as f:
            for raw in csv.DictReader(f):
                a = raw["from_station"]
                b = raw["to_station"]
                sa = stations_by_name[a]
                sb = stations_by_name[b]
                edges.append(
                    Edge(
                        edge_id=str(raw["edge_id"]),
                        from_station=a,
                        to_station=b,
                        edge_type=raw.get("edge_type", "corridor"),
                        length_m=haversine(sa.lat, sa.lon, sb.lat, sb.lon),
                    )
                )
        stations, edges = maybe_densify_network(stations, edges)
        return cls(stations, edges)

    def shortest_path(self, start: str, end: str) -> tuple[list[str], float]:
        if start == end:
            return [start], 0.0
        if start not in self.adj or end not in self.adj:
            return [], math.inf
        heap: list[tuple[float, str]] = [(0.0, start)]
        dist: dict[str, float] = {start: 0.0}
        prev: dict[str, str] = {}
        seen: set[str] = set()
        while heap:
            cur_dist, node = heapq.heappop(heap)
            if node in seen:
                continue
            seen.add(node)
            if node == end:
                break
            for nxt, weight, _edge in self.adj[node]:
                nd = cur_dist + weight
                if nd < dist.get(nxt, math.inf):
                    dist[nxt] = nd
                    prev[nxt] = node
                    heapq.heappush(heap, (nd, nxt))
        if end not in dist:
            return [], math.inf
        path = [end]
        cur = end
        while cur != start:
            cur = prev[cur]
            path.append(cur)
        path.reverse()
        return path, dist[end]

    def pick_random_trip(
        self,
        exclude_origin: str | None = None,
        min_distance_km: float = MIN_ROUTE_DISTANCE_KM,
    ) -> tuple[str, str, list[str], float]:
        names = [
            n
            for n in self.station_names
            if self.stations_by_name[n].kind != "waypoint"
        ]
        if not names:
            names = self.station_names
        for _ in range(MAX_ROUTE_RETRIES):
            origin = exclude_origin or random.choice(names)
            destination = random.choice(names)
            if destination == origin:
                continue
            path, dist_m = self.shortest_path(origin, destination)
            if len(path) >= 2 and dist_m >= min_distance_km * 1000.0:
                return origin, destination, path, dist_m
            if exclude_origin is not None:
                origin = exclude_origin
        # fallback: any reachable pair
        while True:
            origin = exclude_origin or random.choice(names)
            destination = random.choice(names)
            if destination == origin:
                continue
            path, dist_m = self.shortest_path(origin, destination)
            if len(path) >= 2:
                return origin, destination, path, dist_m

    def edge_for(self, a: str, b: str) -> Edge:
        edge = self.edges_by_pair.get(frozenset((a, b)))
        if edge is None:
            raise KeyError(f"Edge not found for {a} <-> {b}")
        return edge


NETWORK = GraphNetwork.load()


# ============================================================
# ROUTE ENGINE
# ============================================================


class GraphRouteEngine:
    def __init__(
        self,
        network: GraphNetwork,
        origin_station: str,
        destination_station: str,
        path_stations: list[str],
        route_distance_m: float,
        initial_edge_progress: float = 0.0,
    ) -> None:
        self.network = network
        self.trip_id: str = str(uuid.uuid4())
        self.origin_station = origin_station
        self.destination_station = destination_station
        self.path_stations = list(path_stations)
        self.route_distance_m = route_distance_m
        self.edge_index: int = 0
        self.edge_progress: float = clamp(initial_edge_progress, 0.0, 0.98)
        self.lat: float = 0.0
        self.lon: float = 0.0
        self.alt_m: float = 0.0
        self.heading_deg: float = 0.0
        self.distance_to_next_wp_km: float = 0.0
        self.active_geofences: list[GeofenceModel] = []
        self._prev_gf_names: set[str] = set()
        self._sync_position()

    @property
    def num_segments(self) -> int:
        return max(0, len(self.path_stations) - 1)

    def current_station_name(self) -> str:
        return self.path_stations[self.edge_index]

    def next_waypoint_name(self) -> str:
        if self.num_segments == 0:
            return self.path_stations[0]
        return self.path_stations[min(self.edge_index + 1, len(self.path_stations) - 1)]

    def segment_name(self) -> str:
        return f"{self.current_station_name()} → {self.next_waypoint_name()}"

    def current_edge(self) -> Edge:
        return self.network.edge_for(self.current_station_name(), self.next_waypoint_name())

    def current_edge_length_m(self) -> float:
        return self.current_edge().length_m

    def remaining_route_distance_m(self) -> float:
        if self.num_segments == 0:
            return 0.0
        rem = self.current_edge_length_m() * (1.0 - self.edge_progress)
        for idx in range(self.edge_index + 1, self.num_segments):
            edge = self.network.edge_for(self.path_stations[idx], self.path_stations[idx + 1])
            rem += edge.length_m
        return rem

    def at_final_destination(self) -> bool:
        return (
            self.edge_index >= self.num_segments - 1
            and self.distance_to_next_wp_km * 1000.0 <= ARRIVAL_THRESHOLD_M
        )

    def track_grade_pct(self) -> float:
        a = self.network.stations_by_name[self.current_station_name()]
        b = self.network.stations_by_name[self.next_waypoint_name()]
        seg_len = max(self.current_edge_length_m(), 1.0)
        grade = (b.alt_m - a.alt_m) / seg_len * 100.0
        return jitter(grade, 0.04)

    def in_slow_zone(self) -> tuple[bool, float]:
        edge_type = self.current_edge().edge_type
        if edge_type == "local":
            return False, 55.0
        return False, 999.0

    def in_station_geofence(self) -> bool:
        return any(gf.type == "station" for gf in self.active_geofences)

    def approaching_station(self, threshold_m: float = APPROACH_THRESHOLD_M) -> bool:
        return self.distance_to_next_wp_km * 1000.0 <= threshold_m

    def at_endpoint(self, threshold_m: float = ARRIVAL_THRESHOLD_M) -> bool:
        return self.distance_to_next_wp_km * 1000.0 <= threshold_m

    def active_geofence_names(self) -> list[str]:
        return [gf.name for gf in self.active_geofences]

    def geofence_entered(self) -> list[GeofenceModel]:
        return [gf for gf in self.active_geofences if gf.name not in self._prev_gf_names]

    def geofence_exited_names(self) -> list[str]:
        current = {gf.name for gf in self.active_geofences}
        return [n for n in self._prev_gf_names if n not in current]

    def primary_geofence(self) -> GeofenceModel | None:
        for gf in self.active_geofences:
            if gf.type == "station":
                return gf
        return self.active_geofences[0] if self.active_geofences else None

    def reset_trip(self, origin_station: str, destination_station: str, path_stations: list[str], route_distance_m: float) -> None:
        self.trip_id = str(uuid.uuid4())
        self.origin_station = origin_station
        self.destination_station = destination_station
        self.path_stations = list(path_stations)
        self.route_distance_m = route_distance_m
        self.edge_index = 0
        self.edge_progress = 0.0
        self._sync_position()

    def _sync_position(self) -> None:
        if self.num_segments == 0:
            station = self.network.stations_by_name[self.path_stations[0]]
            self.lat = station.lat
            self.lon = station.lon
            self.alt_m = station.alt_m
            self.heading_deg = 0.0
            self.distance_to_next_wp_km = 0.0
            self._update_geofences()
            return
        start = self.network.stations_by_name[self.current_station_name()]
        end = self.network.stations_by_name[self.next_waypoint_name()]
        t = clamp(self.edge_progress, 0.0, 1.0)
        self.lat, self.lon = great_circle_interpolate(
            start.lat, start.lon, end.lat, end.lon, t
        )
        self.alt_m = lerp(start.alt_m, end.alt_m, t)
        self.heading_deg = bearing(self.lat, self.lon, end.lat, end.lon)
        self.distance_to_next_wp_km = haversine(self.lat, self.lon, end.lat, end.lon) / 1000.0
        self._update_geofences()

    def _update_geofences(self) -> None:
        self._prev_gf_names = {gf.name for gf in self.active_geofences}
        current: list[GeofenceModel] = []
        for station_name in {self.current_station_name(), self.next_waypoint_name()}:
            station = self.network.stations_by_name[station_name]
            if haversine(self.lat, self.lon, station.lat, station.lon) <= STATION_GEOFENCE_RADIUS_M:
                current.append(self.network.geofence_by_station[station_name])
        self.active_geofences = current

    def update(self, speed_kph: float) -> tuple[bool, bool]:
        if self.num_segments == 0:
            self._sync_position()
            return False, False
        remaining_dist_m = max(0.0, speed_kph / 3.6 * TICK_INTERVAL)
        seg_changed = False
        destination_reached = False
        while remaining_dist_m > 0 and self.num_segments > 0:
            edge_len = self.current_edge_length_m()
            rem_on_edge = edge_len * (1.0 - self.edge_progress)
            if rem_on_edge <= 0.01:
                rem_on_edge = 0.01
            if remaining_dist_m < rem_on_edge:
                self.edge_progress += remaining_dist_m / edge_len
                remaining_dist_m = 0.0
            else:
                remaining_dist_m -= rem_on_edge
                self.edge_progress = 1.0
                seg_changed = True
                if self.edge_index >= self.num_segments - 1:
                    destination_reached = True
                    break
                self.edge_index += 1
                self.edge_progress = 0.0
        self._sync_position()
        return seg_changed, destination_reached


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
    def __init__(self, locomotive_id: str) -> None:
        self.locomotive_id = locomotive_id
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
# ANOMALY MANAGER
# ============================================================

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
    MAX_PER_LOCO: int = 2

    def __init__(self) -> None:
        self.active: list[_AnomalySlot] = []
        self._cooldown: int = random.randint(60, 300)
        self._ticks: int = 0
        self._next_check: int = random.randint(60, 300)

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
        if len(self.active) >= self.MAX_PER_LOCO:
            return None
        at = atype or random.choice(_ANOMALY_TYPES)
        sv = severity or random.choice(["moderate", "severe"])
        slot = _AnomalySlot(at, sv, onset=8, peak=100, recovery=25)
        self.active.append(slot)
        return slot

    def tick(self, allow_new: bool = True) -> None:
        self._ticks += 1
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


def speed_range_for_edge(edge_type: str, distance_km: float) -> tuple[float, float]:
    if edge_type == "express":
        return (80.0, 115.0) if distance_km >= 120 else (75.0, 105.0)
    if edge_type == "corridor":
        if distance_km >= 250:
            return 75.0, 100.0
        return 65.0, 90.0
    if distance_km >= 60:
        return 45.0, 70.0
    return 30.0, 55.0


def _generate_loco_configs() -> list[dict]:
    configs: list[dict] = []
    for i in range(FLEET_SIZE):
        model = _MODEL_ROTATION[i % len(_MODEL_ROTATION)]
        suffix = 5001 + i
        configs.append(
            {
                "serial": f"{model}-{1001 + i:04d}",
                "train_id": f"{model}-{suffix}",
            }
        )
    return configs


class LocomotiveRuntime:
    def __init__(
        self, config: dict, network: GraphNetwork, seq_slot: int = 0
    ) -> None:
        self.network = network
        self.locomotive_id: str = str(uuid.uuid5(_LOCO_NS, config["serial"]))
        self.serial_number: str = config["serial"]
        self.train_id: str = config["train_id"]
        self.created_at: str = utcnow_iso()
        self.train_run_id: str = str(
            uuid.uuid5(_LOCO_NS, f"{config['train_id']}:run")
        )
        origin, destination, path, dist_m = network.pick_random_trip()
        initial_progress = 0.0 if SINGLE_TRAIN_MODE else random.uniform(0.03, 0.85)
        self.route = GraphRouteEngine(
            network, origin, destination, path, dist_m, initial_progress
        )

        self.alert_engine = AlertEngine(self.locomotive_id)
        self.anomaly_mgr = AnomalyManager()

        self.history_buffer: collections.deque = collections.deque(maxlen=HISTORY_MAXLEN)
        self.event_log: collections.deque = collections.deque(maxlen=EVENT_MAXLEN)

        self.seq: int = int(time.time()) * 1000 + seq_slot * 10_000_000
        self.mode: str = "cruising"
        self._station_wait_ticks: int = 0
        self._station_timer: int = 0
        self._just_arrived_final: bool = False

        cur_edge = self.route.current_edge()
        if SINGLE_TRAIN_MODE:
            self.target_speed = SINGLE_TRAIN_SPEED_KPH
            self.speed_kph = SINGLE_TRAIN_SPEED_KPH
        else:
            lo, hi = speed_range_for_edge(cur_edge.edge_type, cur_edge.length_m / 1000.0)
            self.target_speed = random.uniform(lo, hi)
            self.speed_kph = self.target_speed * random.uniform(0.90, 0.98)
        self.throttle_pct: float = 0.34
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

        self.latest_telemetry: dict | None = None
        self.current_state_snapshot: dict | None = None

        self.locomotive_model = LocomotiveModel(
            locomotive_id=self.locomotive_id,
            serial_number=self.serial_number,
            network_id=network.network_id,
            network_name=network.name,
            created_at=self.created_at,
        )
        self.train_run_model = TrainRunModel(
            train_run_id=self.train_run_id,
            train_id=self.train_id,
            locomotive_id=self.locomotive_id,
            route_id=self.route.trip_id,
            started_at=self.created_at,
        )

        if not SINGLE_TRAIN_MODE and random.random() < 0.25:
            self.anomaly_mgr.inject()

        self._emit_event(
            "info",
            "system",
            "SIM_STARTED",
            f"Locomotive {self.serial_number} started trip {self.route.origin_station} → {self.route.destination_station}",
            {
                "origin_station": self.route.origin_station,
                "destination_station": self.route.destination_station,
                "path_stations": self.route.path_stations,
            },
        )

    def _route_path_coordinates(self) -> list[list[float]]:
        path = self.route.path_stations
        if len(path) < 2:
            if len(path) == 1:
                st = self.network.stations_by_name[path[0]]
                return [[round(st.lon, 6), round(st.lat, 6)]]
            return []
        out: list[list[float]] = []
        for i in range(len(path) - 1):
            sa = self.network.stations_by_name[path[i]]
            sb = self.network.stations_by_name[path[i + 1]]
            dist_m = haversine(sa.lat, sa.lon, sb.lat, sb.lon)
            n = max(2, int(math.ceil(dist_m / ROUTE_DISPLAY_SAMPLE_STEP_M)))
            start_k = 1 if i > 0 else 0
            for k in range(start_k, n + 1):
                t = k / n
                lat, lon = great_circle_interpolate(
                    sa.lat, sa.lon, sb.lat, sb.lon, t
                )
                out.append([round(lon, 6), round(lat, 6)])
        return out

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
                severity=severity,
                event_type=etype,
                code=code,
                message=message,
                payload=payload or {},
            ).model_dump()
        )

    def _assign_new_trip(self) -> None:
        current_station = self.route.destination_station
        origin, destination, path, dist_m = self.network.pick_random_trip(
            exclude_origin=current_station
        )
        origin = current_station
        path, dist_m = self.network.shortest_path(origin, destination)
        self.route.reset_trip(origin, destination, path, dist_m)
        self.train_run_id = str(uuid.uuid4())
        self.train_run_model = TrainRunModel(
            train_run_id=self.train_run_id,
            train_id=self.train_id,
            locomotive_id=self.locomotive_id,
            route_id=self.route.trip_id,
            started_at=utcnow_iso(),
        )
        self._emit_event(
            "info",
            "trip",
            "NEW_TRIP_ASSIGNED",
            f"New trip assigned: {origin} → {destination}",
            {
                "origin_station": origin,
                "destination_station": destination,
                "path_stations": path,
                "distance_km": round(dist_m / 1000.0, 1),
            },
        )
        self._set_target()

    def _set_target(self) -> None:
        if SINGLE_TRAIN_MODE:
            self.target_speed = SINGLE_TRAIN_SPEED_KPH
            return
        edge = self.route.current_edge()
        lo, hi = speed_range_for_edge(edge.edge_type, edge.length_m / 1000.0)
        if self.route.remaining_route_distance_m() < 35_000:
            hi = min(hi, 80.0)
        self.target_speed = random.uniform(lo, hi)

    def _smooth_target(self) -> None:
        if SINGLE_TRAIN_MODE:
            return
        edge = self.route.current_edge()
        lo, hi = speed_range_for_edge(edge.edge_type, edge.length_m / 1000.0)
        if self.route.remaining_route_distance_m() < 20_000:
            hi = min(hi, 75.0)
        new_t = random.uniform(lo, hi)
        self.target_speed = self.target_speed * 0.985 + new_t * 0.015

    def _emit_mode_change(self, old: str) -> None:
        if self.mode != old:
            self._emit_event(
                "info",
                "status",
                "MODE_CHANGED",
                f"Mode: {old} → {self.mode}",
                {"old_mode": old, "new_mode": self.mode},
            )

    def _update_mode(self) -> None:
        old = self.mode

        if self.mode in ("station_stop", "depot_stop", "idle_hold"):
            self._station_timer += 1
            if self._station_timer >= self._station_wait_ticks:
                if self._just_arrived_final:
                    self._assign_new_trip()
                    self._just_arrived_final = False
                self.mode = "accelerating"
                self._set_target()
                self._emit_event(
                    "info",
                    "status",
                    "DEPARTED_STATION",
                    f"Departed from {self.route.current_station_name()} toward {self.route.destination_station}",
                    {
                        "current_station": self.route.current_station_name(),
                        "destination_station": self.route.destination_station,
                    },
                )
            self._emit_mode_change(old)
            return

        in_slow, slow_lim = self.route.in_slow_zone()
        approaching = self.route.approaching_station(APPROACH_THRESHOLD_M)
        in_station = self.route.in_station_geofence()
        at_end = self.route.at_endpoint(ARRIVAL_THRESHOLD_M)

        if self.mode == "accelerating":
            if in_slow and self.speed_kph > slow_lim:
                self.mode = "braking"
                self.target_speed = slow_lim
            elif approaching:
                self.mode = "braking"
                self.target_speed = 0.0
            elif self.speed_kph >= self.target_speed * 0.95:
                self.mode = "slow_zone" if in_slow else "cruising"

        elif self.mode == "cruising":
            self._smooth_target()
            if in_slow and self.speed_kph > slow_lim:
                self.mode = "braking"
                self.target_speed = slow_lim
            elif approaching:
                self.mode = "braking"
                self.target_speed = 0.0

        elif self.mode == "slow_zone":
            if not in_slow:
                self.mode = "accelerating"
                self._set_target()
            elif approaching:
                self.mode = "braking"
                self.target_speed = 0.0

        elif self.mode == "braking":
            if at_end and in_station and self.speed_kph < 2.0:
                self.speed_kph = 0.0
                self.mode = "station_stop"
                self._station_wait_ticks = random.randint(18, 45)
                self._station_timer = 0
                final_stop = self.route.at_final_destination()
                self._just_arrived_final = final_stop
                wp = self.route.next_waypoint_name()
                self._emit_event(
                    "info",
                    "status",
                    "ARRIVED_STATION",
                    f"Arrived at {wp}",
                    {
                        "station": wp,
                        "final_destination": final_stop,
                        "route_remaining_km": round(self.route.remaining_route_distance_m() / 1000.0, 2),
                    },
                )
            elif (
                in_slow
                and self.target_speed > 0
                and self.speed_kph <= self.target_speed * 1.05
            ):
                self.mode = "slow_zone"
            elif not approaching and not in_slow and self.speed_kph < 5.0 and not at_end:
                self.mode = "accelerating"
                self._set_target()

        self._emit_mode_change(old)

    def _update_speed(self) -> None:
        if SINGLE_TRAIN_MODE:
            if self.mode == "braking":
                distance_left = self.route.distance_to_next_wp_km * 1000.0
                hard_stop = distance_left < 3_000
                decel_lo, decel_hi = (0.6, 1.1) if hard_stop else (0.35, 0.8)
                self.speed_kph = max(
                    0.0, self.speed_kph - random.uniform(decel_lo, decel_hi)
                )
                self.throttle_pct = 0.0
                self.brake_demand = (
                    clamp(
                        1.0 - self.speed_kph / max(1.0, SINGLE_TRAIN_SPEED_KPH + 20),
                        0.0,
                        1.0,
                    )
                )
            elif self.mode in ("station_stop", "depot_stop", "idle_hold"):
                self.speed_kph = 0.0
                self.throttle_pct = 0.0
                self.brake_demand = 0.0
            else:
                self.speed_kph = SINGLE_TRAIN_SPEED_KPH
                self.target_speed = SINGLE_TRAIN_SPEED_KPH
                self.throttle_pct = clamp(
                    self.speed_kph / max(1.0, SINGLE_TRAIN_SPEED_KPH), 0, 1
                )
                self.brake_demand = 0.0
            return
        if self.mode == "accelerating":
            self.speed_kph = min(
                self.target_speed,
                self.speed_kph + random.uniform(0.18, 0.45),
            )
            self.throttle_pct = clamp(
                self.speed_kph / max(1.0, self.target_speed), 0, 1
            )
            self.brake_demand = 0.0
        elif self.mode in ("cruising", "slow_zone"):
            self.speed_kph = clamp(
                self.speed_kph + random.uniform(-0.08, 0.08),
                self.target_speed * 0.94,
                self.target_speed * 1.02,
            )
            self.throttle_pct = clamp(
                0.30 + random.uniform(-0.04, 0.04), 0, 1
            )
            self.brake_demand = 0.0
        elif self.mode == "braking":
            distance_left = self.route.distance_to_next_wp_km * 1000.0
            hard_stop = distance_left < 3_000
            decel_lo, decel_hi = (0.6, 1.1) if hard_stop else (0.35, 0.8)
            self.speed_kph = max(
                0.0, self.speed_kph - random.uniform(decel_lo, decel_hi)
            )
            self.throttle_pct = 0.0
            self.brake_demand = (
                clamp(
                    1.0 - self.speed_kph / max(1.0, self.target_speed + 20),
                    0.0,
                    1.0,
                )
                if self.target_speed > 0
                else clamp(1.0 - self.speed_kph / 95.0, 0.35, 1.0)
            )
        else:
            self.speed_kph = 0.0
            self.throttle_pct = 0.0
            self.brake_demand = 0.0

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
            self.engine_rpm = jitter(lerp(580, 790, self.throttle_pct), 5)
            self.tractive_effort_kn = jitter(
                lerp(150, 300, self.throttle_pct) * gf, 5
            )
            self.traction_voltage_v = lerp(400, 800, self.throttle_pct)
            self.current_a = lerp(100, 500, self.throttle_pct)
            self.dynamic_brake_force_kn = 0.0
            self.fuel_consumption_rate_lph = jitter(
                lerp(145, 245, self.throttle_pct), 5
            )
            self.brake_cylinder_pressure_kpa = 0.0
            self.brake_status = "release"
        elif self.mode == "braking":
            self.engine_rpm += (idle - self.engine_rpm) * 0.05
            self.engine_rpm = jitter(self.engine_rpm, 3)
            self.tractive_effort_kn = max(0.0, self.tractive_effort_kn - 15)
            self.dynamic_brake_force_kn = lerp(0, 420, self.brake_demand)
            self.brake_cylinder_pressure_kpa = lerp(0, 350, self.brake_demand)
            self.traction_voltage_v = max(0.0, self.traction_voltage_v - 30)
            self.current_a = max(0.0, self.current_a - 20)
            self.fuel_consumption_rate_lph = max(20.0, self.fuel_consumption_rate_lph - 10)
            self.brake_status = "service"
        else:
            self.engine_rpm = jitter(300.0, 5)
            self.tractive_effort_kn = 0.0
            self.dynamic_brake_force_kn = 0.0
            self.brake_cylinder_pressure_kpa = jitter(250.0, 10)
            idle_rpm = max(1.0, self.engine_rpm)
            idle_frac = clamp(idle_rpm / 950.0, 0.0, 1.0)
            self.traction_voltage_v = jitter(
                lerp(140.0, 420.0, idle_frac * 0.35), 12.0
            )
            self.current_a = jitter(lerp(28.0, 110.0, idle_frac * 0.4), 10.0)
            self.fuel_consumption_rate_lph = jitter(20.0, 3)
            self.brake_status = "release"

        self.engine_rpm = clamp(self.engine_rpm, 0, 1100)
        self.traction_voltage_v = clamp(self.traction_voltage_v, 0, 1400)
        self.current_a = clamp(self.current_a, 0, 1200)
        self.tractive_effort_kn = clamp(self.tractive_effort_kn, 0, 800)
        self.dynamic_brake_force_kn = clamp(self.dynamic_brake_force_kn, 0, 534)
        self.fuel_consumption_rate_lph = clamp(self.fuel_consumption_rate_lph, 0, 500)
        self.brake_cylinder_pressure_kpa = clamp(self.brake_cylinder_pressure_kpa, 0, 450)

    def _update_thermal(self) -> None:
        if self.anomaly_mgr.has_type("engine_overtemp"):
            self.engine_temp_c = jitter(self.engine_temp_c, 0.1)
            self.oil_temp_c = jitter(self.oil_temp_c, 0.1)
            return
        tgt = {
            "station_stop": 75.0,
            "depot_stop": 75.0,
            "idle_hold": 75.0,
            "cruising": 86.0,
            "slow_zone": 84.0,
            "braking": 79.0,
        }.get(self.mode, 88.0 + self.throttle_pct * 10.0)
        self.engine_temp_c += (tgt - self.engine_temp_c) * (TICK_INTERVAL / 200.0)
        self.engine_temp_c = jitter(self.engine_temp_c, 0.2)
        tgt_oil = self.engine_temp_c - random.uniform(5, 10)
        self.oil_temp_c += (tgt_oil - self.oil_temp_c) * (TICK_INTERVAL / 300.0)
        self.oil_temp_c = jitter(self.oil_temp_c, 0.2)

    def _update_fuel(self) -> None:
        consumed = self.fuel_consumption_rate_lph / 3600.0 * TICK_INTERVAL
        self.fuel_level_pct -= consumed / TOTAL_FUEL_L * 100.0
        if self.fuel_level_pct < 15.0:
            self.fuel_level_pct = random.uniform(82, 97)

    def _update_brakes_baseline(self) -> None:
        if not self.anomaly_mgr.has_type("brake_pressure_drift"):
            self.brake_pipe_pressure_kpa = jitter(480.0, 2.5)
        if not self.anomaly_mgr.has_type("main_reservoir_drop"):
            self.main_reservoir_pressure_kpa = jitter(800.0, 5)
        if not self.anomaly_mgr.has_type("leak_rate_increase"):
            self.brake_pipe_leak_kpa_per_min = jitter(3.5, 1.0)
        self.battery_voltage_v = jitter(74.0, 0.15)

    def _update_safety(self) -> None:
        if not self.anomaly_mgr.has_type("alerter_timeout"):
            self.alerter_timer_sec += TICK_INTERVAL
            if self.alerter_timer_sec >= self._alerter_reset_at:
                self.alerter_timer_sec = 0.0
                self._alerter_reset_at = random.uniform(10, 18)

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

    def tick(self, allow_new_anomaly: bool = True) -> dict:
        self.seq += 1
        self._update_mode()
        self._update_speed()

        seg_changed, destination_reached = self.route.update(self.speed_kph)
        if seg_changed:
            self._emit_event(
                "info",
                "status",
                "SEGMENT_CHANGED",
                f"Entered segment: {self.route.segment_name()}",
                {"segment": self.route.segment_name()},
            )
        if destination_reached:
            self._just_arrived_final = True

        for gf in self.route.geofence_entered():
            self._emit_event(
                "info",
                "geofence",
                "ENTER_GEOFENCE",
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
        self._update_brakes_baseline()
        self._update_safety()

        self.anomaly_mgr.tick(allow_new=allow_new_anomaly)

        pgf = self.route.primary_geofence()
        state: dict[str, Any] = {
            "ts": utcnow_iso(),
            "locomotive_id": self.locomotive_id,
            "serial_number": self.serial_number,
            "train_id": self.train_id,
            "seq": self.seq,
            "train_run_id": self.train_run_id,
            "route_id": self.route.trip_id,
            "train_run_started_at": self.train_run_model.started_at,
            "network_id": self.network.network_id,
            "network_name": self.network.name,
            "origin_station": self.route.origin_station,
            "destination_station": self.route.destination_station,
            "path_stations": list(self.route.path_stations),
            "route_path_coordinates": self._route_path_coordinates(),
            "current_station": self.route.current_station_name(),
            "next_station_name": self.route.next_waypoint_name(),
            "geofence_id": pgf.geofence_id if pgf else None,
            "active_geofences": self.route.active_geofence_names(),
            "lat": round(self.route.lat, 6),
            "lon": round(self.route.lon, 6),
            "alt_m": round(self.route.alt_m, 1),
            "speed_kph": round(max(0.0, self.speed_kph), 2),
            "heading_deg": round(self.route.heading_deg, 1),
            "brake_pipe_pressure_kpa": round(self.brake_pipe_pressure_kpa, 1),
            "main_reservoir_pressure_kpa": round(self.main_reservoir_pressure_kpa, 1),
            "brake_cylinder_pressure_kpa": round(self.brake_cylinder_pressure_kpa, 1),
            "brake_pipe_leak_kpa_per_min": round(self.brake_pipe_leak_kpa_per_min, 1),
            "brake_status": self.brake_status,
            "battery_voltage_v": round(self.battery_voltage_v, 2),
            "traction_voltage_v": round(self.traction_voltage_v, 1),
            "current_a": round(self.current_a, 1),
            "engine_rpm": round(self.engine_rpm, 1),
            "engine_temp_c": round(self.engine_temp_c, 1),
            "oil_temp_c": round(self.oil_temp_c, 1),
            "fuel_level_pct": round(self.fuel_level_pct, 2),
            "fuel_consumption_rate_lph": round(self.fuel_consumption_rate_lph, 1),
            "tractive_effort_kn": round(self.tractive_effort_kn, 1),
            "dynamic_brake_force_kn": round(self.dynamic_brake_force_kn, 1),
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
            "segment_name": self.route.segment_name(),
            "route_remaining_km": round(self.route.remaining_route_distance_m() / 1000.0, 2),
            "distance_to_next_waypoint_km": round(self.route.distance_to_next_wp_km, 2),
        }

        state = self.anomaly_mgr.apply(state)

        self.brake_pipe_pressure_kpa = state["brake_pipe_pressure_kpa"]
        self.main_reservoir_pressure_kpa = state["main_reservoir_pressure_kpa"]
        self.brake_pipe_leak_kpa_per_min = state["brake_pipe_leak_kpa_per_min"]
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
            segment_name=state["segment_name"],
            origin_station=state["origin_station"],
            destination_station=state["destination_station"],
            route_remaining_km=state["route_remaining_km"],
            path_stations=state["path_stations"],
        ).model_dump()

        return state


# ============================================================
# FLEET SIMULATOR
# ============================================================


class FleetSimulator:
    def __init__(self, network: GraphNetwork) -> None:
        self.network = network
        self.runtimes: dict[str, LocomotiveRuntime] = {}
        self._ordered_ids: list[str] = []
        self.global_seq: int = 0

        for slot, cfg in enumerate(_generate_loco_configs()):
            rt = LocomotiveRuntime(cfg, network, seq_slot=slot)
            self.runtimes[rt.locomotive_id] = rt
            self._ordered_ids.append(rt.locomotive_id)

    @property
    def fleet_size(self) -> int:
        return len(self.runtimes)

    @property
    def active_anomaly_count(self) -> int:
        return sum(rt.anomaly_mgr.count for rt in self.runtimes.values())

    def tick_all(self) -> list[dict]:
        self.global_seq += 1
        anom_count = sum(rt.anomaly_mgr.count for rt in self.runtimes.values())
        results: list[dict] = []
        for lid in self._ordered_ids:
            rt = self.runtimes[lid]
            allow = anom_count < MAX_FLEET_ANOMALIES or rt.anomaly_mgr.count > 0
            state = rt.tick(allow_new_anomaly=allow)
            results.append(state)
            if rt.anomaly_mgr.count > 0:
                anom_count = sum(r.anomaly_mgr.count for r in self.runtimes.values())
        return results

    def get_runtime(self, loco_id: str) -> LocomotiveRuntime | None:
        return self.runtimes.get(loco_id)

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
            if snap["current_mode"] in ("station_stop", "depot_stop", "idle_hold"):
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
# WEBSOCKET REGISTRY
# ============================================================


@dataclasses.dataclass
class _WSClient:
    websocket: WebSocket
    queue: asyncio.Queue
    locomotive_id: str | None


_ws_clients: dict[int, _WSClient] = {}


def _broadcast(state: dict) -> None:
    lid = state["locomotive_id"]
    for cid, client in list(_ws_clients.items()):
        if client.locomotive_id is None or client.locomotive_id == lid:
            try:
                client.queue.put_nowait(state)
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
    for task in pending:
        task.cancel()


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(title="TE33A Dijkstra Fleet Telemetry Service", version="4.0.0")
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
    fleet = FleetSimulator(NETWORK)
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


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        uptime_sec=round(time.monotonic() - _start_mono, 1),
        tick_count=fleet.global_seq if fleet else 0,
        fleet_size=fleet.fleet_size if fleet else 0,
        active_anomalies=fleet.active_anomaly_count if fleet else 0,
        network_id=NETWORK.network_id,
    )


@app.get("/network")
async def get_network() -> dict:
    return {
        "network_id": NETWORK.network_id,
        "name": NETWORK.name,
        "stations": [s.model_dump() for s in NETWORK.station_models],
        "edges": [e.model_dump() for e in NETWORK.edge_models],
        "total_distance_km": NETWORK.total_distance_km,
    }


@app.get("/network/stations")
async def network_stations() -> list[dict]:
    return [s.model_dump() for s in NETWORK.station_models]


@app.get("/network/edges")
async def network_edges() -> list[dict]:
    return [e.model_dump() for e in NETWORK.edge_models]


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


@app.get("/fleet/anomalies")
async def fleet_anomalies() -> list[dict]:
    assert fleet is not None
    result: list[dict] = []
    for rt in fleet.all_runtimes():
        for a in rt.anomaly_mgr.active:
            result.append(
                {
                    "locomotive_id": rt.locomotive_id,
                    "serial_number": rt.serial_number,
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


@app.post("/locomotives/{locomotive_id}/inject")
async def inject_anomaly(
    locomotive_id: str,
    anomaly_type: str = Query(default="random"),
    severity: str = Query(default="severe"),
) -> dict:
    rt = _rt_or_404(locomotive_id)
    if anomaly_type == "random":
        anomaly_type = random.choice(_ANOMALY_TYPES)
    if anomaly_type not in _ANOMALY_TYPES:
        raise HTTPException(400, f"Unknown anomaly_type. Valid: {_ANOMALY_TYPES}")
    if severity not in ("mild", "moderate", "severe"):
        raise HTTPException(400, "severity must be: mild, moderate, severe")
    slot = rt.anomaly_mgr.inject(atype=anomaly_type, severity=severity)
    if slot is None:
        raise HTTPException(409, f"Locomotive already has {rt.anomaly_mgr.MAX_PER_LOCO} active anomalies")
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


@app.get("/route/progress/{locomotive_id}")
async def route_progress(locomotive_id: str) -> dict:
    rt = _rt_or_404(locomotive_id)
    r = rt.route
    return RouteProgressModel(
        locomotive_id=rt.locomotive_id,
        route_id=r.trip_id,
        origin_station=r.origin_station,
        destination_station=r.destination_station,
        current_station=r.current_station_name(),
        next_station_name=r.next_waypoint_name(),
        active_segment_index=r.edge_index,
        active_segment_name=r.segment_name(),
        segment_progress=round(r.edge_progress, 4),
        distance_to_next_waypoint_km=round(r.distance_to_next_wp_km, 2),
        route_remaining_km=round(r.remaining_route_distance_m() / 1000.0, 2),
        lat=round(r.lat, 6),
        lon=round(r.lon, 6),
        alt_m=round(r.alt_m, 1),
        heading_deg=round(r.heading_deg, 1),
        active_geofences=r.active_geofence_names(),
        path_stations=list(r.path_stations),
    ).model_dump()


@app.post("/locomotives/{locomotive_id}/reroute")
async def reroute_locomotive(
    locomotive_id: str,
    destination_station: str | None = Query(default=None),
) -> dict:
    rt = _rt_or_404(locomotive_id)
    origin = rt.route.current_station_name() if rt.mode in ("station_stop", "depot_stop", "idle_hold") else rt.route.next_waypoint_name()
    if destination_station is None:
        destination_station = random.choice(NETWORK.station_names)
        while destination_station == origin:
            destination_station = random.choice(NETWORK.station_names)
    if destination_station not in NETWORK.stations_by_name:
        raise HTTPException(404, "Destination station not found")
    path, dist_m = NETWORK.shortest_path(origin, destination_station)
    if len(path) < 2:
        raise HTTPException(400, "No route found")
    rt.route.reset_trip(origin, destination_station, path, dist_m)
    rt.mode = "accelerating"
    rt.speed_kph = min(rt.speed_kph, 20.0)
    rt._set_target()
    rt._emit_event(
        "info",
        "trip",
        "MANUAL_REROUTE",
        f"Manual reroute: {origin} → {destination_station}",
        {"path_stations": path, "distance_km": round(dist_m / 1000.0, 1)},
    )
    return {
        "status": "rerouted",
        "locomotive_id": locomotive_id,
        "origin_station": origin,
        "destination_station": destination_station,
        "path_stations": path,
        "distance_km": round(dist_m / 1000.0, 1),
    }


@app.websocket("/ws/telemetry")
async def ws_all(websocket: WebSocket) -> None:
    await websocket.accept()
    queue: asyncio.Queue = asyncio.Queue(maxsize=WS_QUEUE_MAX)
    cid = id(websocket)
    _ws_clients[cid] = _WSClient(websocket, queue, locomotive_id=None)
    try:
        await _ws_handler(websocket, queue)
    finally:
        _ws_clients.pop(cid, None)


@app.websocket("/ws/telemetry/{locomotive_id}")
async def ws_single(websocket: WebSocket, locomotive_id: str) -> None:
    await websocket.accept()
    if fleet and fleet.get_runtime(locomotive_id) is None:
        await websocket.close(code=4004, reason="Locomotive not found")
        return
    queue: asyncio.Queue = asyncio.Queue(maxsize=WS_QUEUE_MAX)
    cid = id(websocket)
    _ws_clients[cid] = _WSClient(websocket, queue, locomotive_id=locomotive_id)
    try:
        await _ws_handler(websocket, queue)
    finally:
        _ws_clients.pop(cid, None)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=DEFAULT_HOST, port=DEFAULT_PORT, log_level="info")
