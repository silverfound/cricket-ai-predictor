#!/usr/bin/env python3
"""Read-only SportScore cricket API probe; never writes production data."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import requests

BASE = "https://sportscore.com/api/v1"
TIMEOUT = 20
DAYS_AHEAD = 7
EVENT_KEYS = {"balls", "ball_by_ball", "ballbyball", "deliveries",
              "delivery_list", "timeline", "commentary", "overs", "events"}
DELIVERY_MARKERS = {
    "ball", "ball_number", "ballnumber", "over", "over_number", "overnumber",
    "batter", "batsman", "bowler", "batsman_id", "bowler_id", "is_wicket",
    "runs_batter", "runs_off_bat", "delivery",
}


def unwrap_matches(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("fixtures", "matches", "data", "results", "items"):
        value = payload.get(key)
        if isinstance(value, list):
            return [x for x in value if isinstance(x, dict)]
        if isinstance(value, dict):
            for nested in ("fixtures", "matches", "results", "items"):
                rows = value.get(nested)
                if isinstance(rows, list):
                    return [x for x in rows if isinstance(x, dict)]
    return []


def fixture_format(item: dict) -> str:
    return " ".join(str(item.get(k) or "") for k in
                    ("format", "type", "match_type", "name", "competition")).strip()


def is_t10(item: dict) -> bool:
    value = fixture_format(item).casefold().replace("-", " ").replace("_", " ")
    return "t10" in value or "10 over" in value or "ten over" in value


def fixture_slug(item: dict) -> str:
    return str(item.get("slug") or item.get("match_slug") or item.get("matchSlug") or "")


def _norm_keys(value: dict) -> set[str]:
    return {str(k).casefold().replace("-", "_").replace(" ", "_") for k in value}


def find_event_arrays(value: Any, path: str = "$", depth: int = 0) -> list[dict]:
    found: list[dict] = []
    if depth > 8:
        return found
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            key_norm = str(key).casefold().replace("-", "_").replace(" ", "_")
            if isinstance(child, list) and key_norm in EVENT_KEYS:
                samples = [x for x in child[:5] if isinstance(x, dict)]
                marker_hits = sum(bool(_norm_keys(x) & DELIVERY_MARKERS) for x in samples)
                found.append({
                    "path": child_path, "count": len(child),
                    "record_keys": sorted(_norm_keys(samples[0]))[:30] if samples else [],
                    "delivery_like": bool(samples) and marker_hits >= 1,
                })
            found.extend(find_event_arrays(child, child_path, depth + 1))
    elif isinstance(value, list):
        for index, child in enumerate(value[:10]):
            found.extend(find_event_arrays(child, f"{path}[{index}]", depth + 1))
    return found


def main() -> int:
    today = datetime.now(timezone.utc).date()
    fixtures: list[dict] = []
    for offset in range(DAYS_AHEAD + 1):
        date_utc = (today + timedelta(days=offset)).isoformat()
        try:
            response = requests.get(
                f"{BASE}/fixtures/",
                params={"sport": "cricket", "date": date_utc, "limit": 200,
                        "src": "cricket-ai-predictor"},
                timeout=TIMEOUT,
            )
        except requests.RequestException as exc:
            print(f"SPORTSCORE_FIXTURES_{date_utc}_ERROR={type(exc).__name__}")
            continue
        print(f"SPORTSCORE_FIXTURES_{date_utc}_HTTP={response.status_code}")
        if response.status_code != 200:
            continue
        try:
            payload = response.json()
        except ValueError:
            print(f"SPORTSCORE_FIXTURES_{date_utc}_STATUS=NON_JSON")
            continue
        day_matches = unwrap_matches(payload)
        print(f"SPORTSCORE_FIXTURES_{date_utc}_COUNT={len(day_matches)}")
        fixtures.extend(day_matches)

    # Keep only fixtures with the slug required by the documented detail endpoint.
    unique = {}
    for item in fixtures:
        key = fixture_slug(item) or str(item.get("id") or item.get("match_id") or repr(item))
        unique[key] = item
    fixtures = list(unique.values())
    t10 = [m for m in fixtures if is_t10(m)]
    t10_with_slug = [m for m in t10 if fixture_slug(m)]
    live_with_slug = [
        m for m in fixtures
        if fixture_slug(m) and any(
            token in str(m.get(k) or "").casefold()
            for k in ("status_text", "statusText", "status", "state")
            for token in ("live", "in progress", "innings break")
        )
    ]
    print(f"SPORTSCORE_FIXTURES_TOTAL_8_DAYS={len(fixtures)}")
    print(f"SPORTSCORE_T10_FIXTURE_COUNT={len(t10)}")
    print(f"SPORTSCORE_T10_WITH_DETAIL_SLUG={len(t10_with_slug)}")
    print(f"SPORTSCORE_LIVE_WITH_DETAIL_SLUG={len(live_with_slug)}")

    selected = (t10_with_slug[0] if t10_with_slug else
                live_with_slug[0] if live_with_slug else
                next((m for m in fixtures if fixture_slug(m)), None))
    if selected is None:
        print("SPORTSCORE_DETAIL_STATUS=NO_FIXTURE_WITH_DOCUMENTED_SLUG")
        if fixtures:
            sample = fixtures[0]
            print("SPORTSCORE_SAMPLE_FIXTURE_KEYS=" + ",".join(sorted(sample.keys())[:50]))
            for key in ("home", "away", "status", "status_text", "format", "type",
                        "name", "competition", "slug", "match_slug", "id", "match_id"):
                if sample.get(key) is not None:
                    print(f"SPORTSCORE_SAMPLE_{key.upper()}={sample[key]}")
        return 0

    print("SPORTSCORE_SELECTED_MATCH=" + " vs ".join(
        str(selected.get(k) or "?") for k in ("home", "away")))
    print("SPORTSCORE_SELECTED_FORMAT=" + (fixture_format(selected) or "unknown"))
    print("SPORTSCORE_SELECTED_STATUS=" +
          str(selected.get("status_text") or selected.get("status") or "unknown"))
    print("SPORTSCORE_SELECTED_FIXTURE_KEYS=" + ",".join(sorted(selected.keys())[:60]))
    slug = fixture_slug(selected)
    try:
        detail_response = requests.get(
            f"{BASE}/match/",
            params={"sport": "cricket", "slug": slug, "src": "cricket-ai-predictor"},
            timeout=TIMEOUT,
        )
    except requests.RequestException as exc:
        print(f"SPORTSCORE_DETAIL_REQUEST_ERROR={type(exc).__name__}")
        return 0

    print(f"SPORTSCORE_DETAIL_HTTP={detail_response.status_code}")
    if detail_response.status_code != 200:
        print("SPORTSCORE_DETAIL_STATUS=UNAVAILABLE")
        return 0
    try:
        detail_payload = detail_response.json()
    except ValueError:
        print("SPORTSCORE_DETAIL_STATUS=NON_JSON")
        return 0

    print("SPORTSCORE_DETAIL_ROOT_KEYS=" + ",".join(sorted(detail_payload.keys())[:50])
          if isinstance(detail_payload, dict) else
          "SPORTSCORE_DETAIL_ROOT_TYPE=" + type(detail_payload).__name__)
    candidates = find_event_arrays(detail_payload)
    for item in candidates[:25]:
        print("SPORTSCORE_EVENT_ARRAY=" + str(item))
    actual = [item for item in candidates if item["delivery_like"]]
    print(f"SPORTSCORE_DELIVERY_ARRAYS={len(actual)}")
    print("SPORTSCORE_BALL_BY_BALL_STATUS=" +
          ("PRESENT_CANDIDATE_REQUIRES_SEMANTIC_VALIDATION" if actual else
           "NOT_FOUND_IN_SELECTED_DETAIL"))
    print("SPORTSCORE_AUDIT=READ_ONLY_COMPLETE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
