"""Build a separate, optional match-context sidecar without changing AI predictions.

Only explicit provider-supplied playing-XI, pitch, and availability fields are
reported. Weather is fetched from Open-Meteo for verified grounds. Missing
information stays unavailable; no player, pitch, or weather values are guessed.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parents[1]
GROUNDS_PATH = ROOT / "data" / "grounds.json"
MATCHES_PATH = ROOT / "data" / "matches.json"
OUTPUT_PATH = ROOT / "data" / "match_context.json"
CACHE_PATH = ROOT / "data" / "match_context_cache.json"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_TTL_SECONDS = 45 * 60
MAX_WEATHER_LOCATIONS = 40
FORECAST_DAYS = 16
HOURLY_FIELDS = (
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation_probability",
    "precipitation",
    "wind_speed_10m",
    "cloud_cover",
)


def _normal(value):
    return " ".join(str(value or "").casefold().replace("&", "and").split())


def load_verified_grounds(payload):
    """Index only verified ground records with valid coordinates/timezones."""
    records = payload.get("grounds", []) if isinstance(payload, dict) else []
    index = {}
    for ground in records:
        if not isinstance(ground, dict) or ground.get("verification_status") != "verified":
            continue
        try:
            lat, lon = float(ground["latitude"]), float(ground["longitude"])
            timezone_name = str(ground["timezone"])
            ZoneInfo(timezone_name)
        except (KeyError, TypeError, ValueError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        for name in [ground.get("name"), *(ground.get("aliases") or [])]:
            key = _normal(name)
            if key:
                # Do not allow an ambiguous alias to resolve to the wrong venue.
                if key in index and index[key].get("id") != ground.get("id"):
                    index[key] = None
                elif key not in index:
                    index[key] = ground
    return {key: value for key, value in index.items() if value is not None}


def resolve_ground(venue, grounds_index):
    if isinstance(venue, dict):
        candidates = [venue.get("name"), venue.get("ground"), venue.get("venue")]
    else:
        candidates = [venue]
    for candidate in candidates:
        ground = grounds_index.get(_normal(candidate))
        if ground:
            return ground
    return None


def _parse_hour(value, timezone_name):
    try:
        parsed = datetime.fromisoformat(str(value))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=ZoneInfo(timezone_name))
        return parsed
    except (TypeError, ValueError):
        return None


def fetch_weather(latitude, longitude, timezone_name):
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ",".join(HOURLY_FIELDS),
        "forecast_days": FORECAST_DAYS,
        "timezone": timezone_name,
    }
    response = requests.get(WEATHER_URL, params=params, timeout=20)
    response.raise_for_status()
    payload = response.json()
    hourly = payload.get("hourly") if isinstance(payload, dict) else None
    if not isinstance(hourly, dict) or not isinstance(hourly.get("time"), list):
        raise ValueError("Open-Meteo response has no hourly forecast")
    return hourly


def _cache_is_fresh(entry, now):
    try:
        fetched = datetime.fromisoformat(entry["fetched_at"].replace("Z", "+00:00"))
        return (now - fetched).total_seconds() < WEATHER_TTL_SECONDS and isinstance(entry.get("hourly"), dict)
    except (KeyError, TypeError, ValueError):
        return False


def _weather_at_match(hourly, match_dt, timezone_name):
    times = hourly.get("time") or []
    parsed = [_parse_hour(value, timezone_name) for value in times]
    candidates = [(abs((dt - match_dt).total_seconds()), i) for i, dt in enumerate(parsed) if dt]
    if not candidates:
        return None
    distance, index = min(candidates)
    if distance > 90 * 60:
        return None
    values = {}
    for field in HOURLY_FIELDS:
        series = hourly.get(field)
        values[field] = series[index] if isinstance(series, list) and index < len(series) else None
    values["forecast_time_local"] = times[index]
    values["source"] = "Open-Meteo"
    values["source_url"] = "https://open-meteo.com/"
    return values


def _explicit_context(fixture):
    # These values are only set by the provider adapter when the provider
    # explicitly supplies the corresponding field.
    playing_xi = fixture.get("playing_xi")
    pitch = fixture.get("pitch_report")
    availability = fixture.get("player_availability")
    return {
        "playing_xi": {
            "status": "provider_supplied" if playing_xi else "unavailable",
            "data": playing_xi,
            "source": fixture.get("context_provider_source") if playing_xi else None,
        },
        "pitch": {
            "status": "provider_supplied" if pitch else "unavailable",
            "data": pitch,
            "source": fixture.get("context_provider_source") if pitch else None,
        },
        "player_availability": {
            "status": "provider_supplied" if availability else "unavailable",
            "data": availability,
            "source": fixture.get("context_provider_source") if availability else None,
        },
    }


def build_match_context(matches, grounds_index, cache, now=None, weather_fetcher=None):
    now = now or datetime.now(timezone.utc)
    weather_fetcher = weather_fetcher or fetch_weather
    cache_entries = cache.setdefault("venues", {})
    result = {
        "schema_version": 1,
        "generated_at": now.isoformat(),
        "weather_source": "Open-Meteo (CC BY 4.0; attribution required)",
        "model_inputs_changed": False,
        "items": [],
    }
    weather_locations_used = set()

    for fixture in matches:
        if not isinstance(fixture, dict):
            continue
        match_id = str(fixture.get("match_id") or "")
        timestamp = fixture.get("timestamp_start")
        try:
            match_dt_utc = datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
        except (TypeError, ValueError, OverflowError, OSError):
            match_dt_utc = None

        item = {"match_id": match_id, **_explicit_context(fixture)}
        ground = resolve_ground(fixture.get("venue"), grounds_index)
        if not ground:
            item["weather"] = {"status": "unavailable", "reason": "venue_not_in_verified_ground_registry"}
            result["items"].append(item)
            continue
        item["venue"] = ground["name"]

        if not match_dt_utc or match_dt_utc < now - timedelta(hours=3) or match_dt_utc > now + timedelta(days=FORECAST_DAYS):
            item["weather"] = {"status": "outside_forecast_window"}
            result["items"].append(item)
            continue

        timezone_name = ground["timezone"]
        match_local = match_dt_utc.astimezone(ZoneInfo(timezone_name))
        cache_key = str(ground["id"])
        cached = cache_entries.get(cache_key)
        if not _cache_is_fresh(cached, now):
            if cache_key in weather_locations_used or len(weather_locations_used) >= MAX_WEATHER_LOCATIONS:
                item["weather"] = {"status": "not_fetched_this_run", "reason": "per_run_location_limit"}
                result["items"].append(item)
                continue
            weather_locations_used.add(cache_key)
            try:
                hourly = weather_fetcher(ground["latitude"], ground["longitude"], timezone_name)
                cached = {"fetched_at": now.isoformat(), "hourly": hourly}
                cache_entries[cache_key] = cached
            except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
                item["weather"] = {"status": "unavailable", "reason": type(exc).__name__}
                result["items"].append(item)
                continue

        weather = _weather_at_match(cached["hourly"], match_local, timezone_name)
        item["weather"] = {"status": "available", "data": weather} if weather else {
            "status": "unavailable", "reason": "no_hourly_forecast_near_match_time"
        }
        result["items"].append(item)

    result["weather_locations_fetched"] = len(weather_locations_used)
    return result


def main():
    matches_payload = json.loads(MATCHES_PATH.read_text(encoding="utf-8"))
    matches = (matches_payload.get("response") or {}).get("items", [])
    grounds_payload = json.loads(GROUNDS_PATH.read_text(encoding="utf-8"))
    grounds_index = load_verified_grounds(grounds_payload)
    try:
        cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cache = {"schema_version": 1, "venues": {}}

    context = build_match_context(matches, grounds_index, cache)
    OUTPUT_PATH.write_text(json.dumps(context, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    available = sum(1 for item in context["items"] if item.get("weather", {}).get("status") == "available")
    print(
        f"MATCH_CONTEXT_SUMMARY: fixtures={len(context['items'])}, "
        f"weather_available={available}, locations_fetched={context['weather_locations_fetched']}, "
        "playing_xi_pitch_availability=provider_fields_only"
    )


if __name__ == "__main__":
    main()
