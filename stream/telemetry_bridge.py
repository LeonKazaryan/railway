from __future__ import annotations

import asyncio
import os
import sys
from typing import Any

import httpx

SIM_BASE_URL = os.environ.get("SIM_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8080").rstrip("/")
INTERVAL_SEC = float(os.environ.get("BRIDGE_INTERVAL_SEC", "0.5"))
INGEST_PATH = os.environ.get("BRIDGE_INGEST_PATH", "/api/v1/telemetry/raw")
TIMEOUT = httpx.Timeout(30.0)


def _sim_row_to_backend_body(s: dict[str, Any]) -> dict[str, Any]:
    body: dict[str, Any] = {
        "ts": s["ts"],
        "locomotiveId": s["locomotive_id"],
        "seq": int(s["seq"]),
        "lat": float(s["lat"]),
        "lon": float(s["lon"]),
        "speedKph": float(s["speed_kph"]),
    }
    if s.get("serial_number") is not None:
        body["serialNumber"] = s["serial_number"]
    if s.get("train_id") is not None:
        body["trainId"] = s["train_id"]
    if s.get("line_id") is not None:
        body["lineId"] = s["line_id"]
    if s.get("line_name") is not None:
        body["lineName"] = s["line_name"]
    if s.get("train_run_id") is not None:
        body["trainRunId"] = s["train_run_id"]
    if s.get("route_id") is not None:
        body["routeId"] = s["route_id"]
    if s.get("geofence_id") is not None:
        body["geofenceId"] = s["geofence_id"]
    if s.get("active_geofences") is not None:
        body["activeGeofences"] = list(s["active_geofences"])
    if s.get("alt_m") is not None:
        body["altM"] = float(s["alt_m"])
    if s.get("heading_deg") is not None:
        body["headingDeg"] = float(s["heading_deg"])
    if s.get("brake_pipe_pressure_kpa") is not None:
        body["brakePipePressureKpa"] = float(s["brake_pipe_pressure_kpa"])
    if s.get("main_reservoir_pressure_kpa") is not None:
        body["mainReservoirPressureKpa"] = float(s["main_reservoir_pressure_kpa"])
    if s.get("brake_cylinder_pressure_kpa") is not None:
        body["brakeCylinderPressureKpa"] = float(s["brake_cylinder_pressure_kpa"])
    if s.get("brake_pipe_leak_kpa_per_min") is not None:
        body["brakePipeLeakKpaPerMin"] = float(s["brake_pipe_leak_kpa_per_min"])
    if s.get("brake_status") is not None:
        body["brakeStatus"] = s["brake_status"]
    if s.get("battery_voltage_v") is not None:
        body["batteryVoltageV"] = float(s["battery_voltage_v"])
    if s.get("traction_voltage_v") is not None:
        body["tractionVoltageV"] = float(s["traction_voltage_v"])
    if s.get("current_a") is not None:
        body["currentA"] = float(s["current_a"])
    if s.get("engine_rpm") is not None:
        body["engineRpm"] = float(s["engine_rpm"])
    if s.get("engine_temp_c") is not None:
        body["engineTempC"] = float(s["engine_temp_c"])
    if s.get("oil_temp_c") is not None:
        body["oilTempC"] = float(s["oil_temp_c"])
    if s.get("fuel_level_pct") is not None:
        body["fuelLevelPct"] = float(s["fuel_level_pct"])
    if s.get("fuel_consumption_rate_lph") is not None:
        body["fuelConsumptionRateLph"] = float(s["fuel_consumption_rate_lph"])
    if s.get("tractive_effort_kn") is not None:
        body["tractiveEffortKn"] = float(s["tractive_effort_kn"])
    if s.get("dynamic_brake_force_kn") is not None:
        body["dynamicBrakeForceKn"] = float(s["dynamic_brake_force_kn"])
    if s.get("alerter_timer_sec") is not None:
        body["alerterTimerSec"] = float(s["alerter_timer_sec"])
    if s.get("pcs_open") is not None:
        body["pcsOpen"] = bool(s["pcs_open"])
    if s.get("eab_status") is not None:
        body["eabStatus"] = s["eab_status"]
    if s.get("comm_state") is not None:
        body["commState"] = s["comm_state"]
    if s.get("alarm_status") is not None:
        body["alarmStatus"] = s["alarm_status"]
    if s.get("fault_codes") is not None:
        body["faultCodes"] = list(s["fault_codes"])
    if s.get("health_index") is not None:
        body["healthIndex"] = int(s["health_index"])
    if s.get("driver_state") is not None:
        body["driverState"] = dict(s["driver_state"])
    if s.get("weather_factor") is not None:
        body["weatherFactor"] = float(s["weather_factor"])
    if s.get("track_grade_pct") is not None:
        body["trackGradePct"] = float(s["track_grade_pct"])
    if s.get("current_mode") is not None:
        body["currentMode"] = s["current_mode"]
    return body


async def _post_one(client: httpx.AsyncClient, body: dict[str, Any]) -> None:
    url = f"{BACKEND_URL}{INGEST_PATH}"
    r = await client.post(url, json=body)
    r.raise_for_status()


async def _tick(client: httpx.AsyncClient, last_seq: dict[str, int]) -> None:
    r = await client.get(f"{SIM_BASE_URL}/fleet/latest")
    r.raise_for_status()
    rows = r.json()
    if not isinstance(rows, list):
        return
    tasks = []
    for s in rows:
        if not isinstance(s, dict) or "locomotive_id" not in s:
            continue
        lid = str(s["locomotive_id"])
        seq = int(s.get("seq", 0))
        if last_seq.get(lid) == seq:
            continue
        last_seq[lid] = seq
        body = _sim_row_to_backend_body(s)
        tasks.append(asyncio.create_task(_post_one(client, body)))
    if tasks:
        await asyncio.gather(*tasks)


async def _run() -> None:
    last_seq: dict[str, int] = {}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        while True:
            try:
                await _tick(client, last_seq)
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
                print(e, file=sys.stderr)
            await asyncio.sleep(INTERVAL_SEC)


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
