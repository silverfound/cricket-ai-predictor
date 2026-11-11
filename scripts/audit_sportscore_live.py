#!/usr/bin/env python3
"""Read-only SportScore cricket API probe; never writes production data.

The official API is anonymous/free for attribution-tier projects. This probe
checks one UTC-day fixture list and one selected match detail, then reports
whether the detail contains actual delivery records (not just a score/timeline).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import requests

BASE = "https://sportscore.com/api/v1"
TIMEOUT = 20
DELIVERY_KEYS = {"balls", "ball_by_ball", "ballbyball", "deliveries", "delivery_list"}
POSSIBLE_EVENT_KEYS = DELIVERY_KEYS | {"timeline", "commentary", "overs", "events"}
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


def match_is_live(item: dict) -> bool:
    status = " ".join(str(item.get(k) or "") for k in
                      ("status", "status_text", "statusText", "state")).casefold()
    return any(word in status for word in ("live", "in progress", "innings", "stumps", "break"))


def _norm_keys(value: dict) -> set[str]:
    return {str(k).casefold().replace("-", "_").replace(" ", "_") for k in value}


def find_delivery_arrays(value: Any, path: str = "$", depth: int = 0) -> list[dict]:
    """Return candidate arrays and whether their records look like deliveries."""
    found: list[dict] = []
    if depth > 8:
        return found
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            key_norm = str(key).casefold().replace("-", "_").replace(" ", "_")
            if isinstance(child, list) and key_norm in POSSIBLE_EVENT_KEYS:
                samples = [x for x in child[:5] if isinstance(x, dict)]
                marker_hits = sum(bool(_norm_keys(x) & DELIVERY_MARKERS) for x in samples)
                found.append({
                    "path": child_path,
                    "count": len(child),
                    "record_keys": sorted(_norm_keys(samples[0]))[:30] if samples else [],
                    "delivery_like": bool(samples) and marker_hits >= 1,
                })
            found.extend(find_delivery_arrays(child, child_path, depth + 1))
    elif isinstance(value, list):
        for index, child in enumerate(value[:10]):
            found.extend(find_delivery_arrays(child, f"{path}[{index}]", depth + 1))
    return found


def main() -> int:
    date_utc = datetime.now(timezone.utc).date().isoformat()
    url = f"{BASE}/fixtures/"
    try:
        response = requests.get(
            url,
            params={"sport": "cricket", "date": date_utc, "limit": 200,
                    "src": "cricket-ai-predictor"},
            timeout=TIMEOUT,
        )
    except requests.RequestException as exc:
        print(f"SPORTSCORE_FIXTURES_REQUEST_ERROR={type(exc).__name__}")
        return 0

    print(f"SPORTSCORE_FIXTURES_HTTP={response.status_code}")
    if response.status_code != 200:
        print("SPORTSCORE_FIXTURES_STATUS=UNAVAILABLE")
        return 0
    try:
        payload = response.json()
    except ValueError:
        print("SPORTSCORE_FIXTURES_STATUS=NON_JSON")
        return 0

    matches = unwrap_matches(payload)
    print(f"SPORTSCORE_FIXTURE_COUNT={len(matches)}")
    if not matches:
        print("SPORTSCORE_FIXTURES_STATUS=NO_MATCHES_OR_UNKNOWN_SCHEMA")
        if isinstance(payload, dict):
            print("SPORTSCORE_FIXTURE_ROOT_KEYS=" + ",".join(sorted(payload.keys())[:30]))
        return 0

    live = [m for m in matches if match_is_live(m)]
    selected = live[0] if live else next((m for m in matches if m.get("slug")), matches[0])
    print(f"SPORTSCORE_LIVE_FIXTURE_COUNT={len(live)}")
    print("SPORTSCORE_SELECTED_MATCH=" + " vs ".join(
        str(selected.get(k) or "?") for k in ("home", "away")))
    print("SPORTSCORE_SELECTED_STATUS=" + str(selected.get("status_text") or selected.get("status") or "unknown"))
    slug = selected.get("slug") or selected.get("match_slug") or selected.get("matchSlug")
    if not slug:
        print("SPORTSCORE_DETAIL_STATUS=NO_SLUG")
        return 0

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

    print("SPORTSCORE_DETAIL_ROOT_KEYS=" + ",".join(sorted(detail_payload.keys())[:40])
          if isinstance(detail_payload, dict) else
          "SPORTSCORE_DETAIL_ROOT_TYPE=" + type(detail_payload).__name__)
    candidates = find_delivery_arrays(detail_payload)
    if candidates:
        for item in candidates[:20]:
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
