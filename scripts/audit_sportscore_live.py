#!/usr/bin/env python3
"""Read-only SportScore cricket API probe; never writes production data."""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlsplit
from typing import Any

import requests

BASE = "https://sportscore.com/api/v1"
TIMEOUT = 20
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
    direct = item.get("slug") or item.get("match_slug") or item.get("matchSlug")
    if direct:
        return str(direct).strip("/")
    # Current fixture response can expose the match-page URL instead of slug.
    page_url = str(item.get("url") or "").strip()
    if page_url:
        parsed = urlsplit(page_url)
        if parsed.netloc and parsed.hostname != "sportscore.com":
            return ""
        path = parsed.path.strip("/")
        if path:
            return path.split("/")[-1]
    return ""


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



def audit_highlightly() -> None:
    """Probe Highlightly's documented list and match-detail live-state fields."""
    import os
    key = os.environ.get("HIGHLIGHTLY_API_KEY", "").strip()
    print("HIGHLIGHTLY_API_KEY_CONFIGURED=" + str(bool(key)))
    if not key:
        print("HIGHLIGHTLY_STATUS=SKIPPED_NO_SECRET")
        return
    today = datetime.now(timezone.utc).date().isoformat()
    headers = {"x-rapidapi-key": key}
    api_base = "https://cricket.highlightly.net"
    try:
        response = requests.get(
            api_base + "/matches",
            params={"date": today, "limit": 100, "offset": 0},
            headers=headers, timeout=TIMEOUT,
        )
        print(f"HIGHLIGHTLY_DIRECT_HTTP={response.status_code}")
        if response.status_code in (401, 403):
            api_base = "https://cricket-highlights-api.p.rapidapi.com"
            headers["x-rapidapi-host"] = "cricket-highlights-api.p.rapidapi.com"
            response = requests.get(
                api_base + "/matches",
                params={"date": today, "limit": 100, "offset": 0},
                headers=headers, timeout=TIMEOUT,
            )
            print(f"HIGHLIGHTLY_RAPIDAPI_HTTP={response.status_code}")
    except requests.RequestException as exc:
        print("HIGHLIGHTLY_MATCHES_ERROR=" + type(exc).__name__)
        return
    print(f"HIGHLIGHTLY_MATCHES_HTTP={response.status_code}")
    if response.status_code != 200:
        print("HIGHLIGHTLY_STATUS=LIST_UNAVAILABLE")
        return
    try:
        payload = response.json()
    except ValueError:
        print("HIGHLIGHTLY_STATUS=NON_JSON")
        return
    rows = payload.get("data", []) if isinstance(payload, dict) else []
    pagination = payload.get("pagination", {}) if isinstance(payload, dict) else {}
    plan = payload.get("plan", {}) if isinstance(payload, dict) else {}
    print("HIGHLIGHTLY_TIER=" + str(plan.get("tier", "unknown")))
    print("HIGHLIGHTLY_PLAN_MESSAGE=" + str(plan.get("message", ""))[:300])
    print("HIGHLIGHTLY_FIXTURE_COUNT=" + str(len(rows) if isinstance(rows, list) else 0))
    print("HIGHLIGHTLY_TOTAL_COUNT=" + str(pagination.get("totalCount", "unknown")))
    if not isinstance(rows, list):
        print("HIGHLIGHTLY_STATUS=UNKNOWN_LIST_SCHEMA")
        return
    active_states = {"in play", "innings break", "drinks", "lunch", "tea", "timeout", "stumps"}
    active = [row for row in rows if isinstance(row, dict) and
              str((row.get("state") or {}).get("description", "")).casefold() in active_states]
    state_priority = {"in play": 0, "innings break": 1, "drinks": 2,
                      "timeout": 3, "lunch": 4, "tea": 5, "stumps": 6}
    active.sort(key=lambda row: state_priority.get(
        str((row.get("state") or {}).get("description", "")).casefold(), 99
    ))
    print("HIGHLIGHTLY_ACTIVE_STATE_FIXTURES=" + str(len(active)))
    for fixture in active[:8]:
        match_id = fixture.get("id")
        if not match_id:
            continue
        home = (fixture.get("homeTeam") or {}).get("name", "?")
        away = (fixture.get("awayTeam") or {}).get("name", "?")
        state = fixture.get("state") or {}
        print(f"HIGHLIGHTLY_ACTIVE_MATCH={home} vs {away}; format={fixture.get('format')}; state={state.get('description')}; id={match_id}")
        try:
            detail_response = requests.get(
                f"{api_base}/matches/{match_id}",
                headers=headers, timeout=TIMEOUT,
            )
        except requests.RequestException as exc:
            print("HIGHLIGHTLY_DETAIL_ERROR=" + type(exc).__name__)
            continue
        print(f"HIGHLIGHTLY_DETAIL_HTTP={detail_response.status_code}")
        if detail_response.status_code != 200:
            continue
        try:
            detail = detail_response.json()
        except ValueError:
            print("HIGHLIGHTLY_DETAIL_SCHEMA=NON_JSON")
            continue
        if isinstance(detail, list):
            detail = detail[0] if detail and isinstance(detail[0], dict) else {}
        if not isinstance(detail, dict):
            print("HIGHLIGHTLY_DETAIL_SCHEMA=" + type(detail).__name__)
            continue
        state_detail = detail.get("state") or {}
        teams = state_detail.get("teams") or {}
        home_state, away_state = teams.get("home") or {}, teams.get("away") or {}
        print("HIGHLIGHTLY_DETAIL_STATE=" + str(state_detail.get("description", "missing")))
        print("HIGHLIGHTLY_HOME_SCORE=" + str(home_state.get("score", "missing")))
        print("HIGHLIGHTLY_HOME_INFO=" + str(home_state.get("info", "missing")))
        print("HIGHLIGHTLY_AWAY_SCORE=" + str(away_state.get("score", "missing")))
        print("HIGHLIGHTLY_AWAY_INFO=" + str(away_state.get("info", "missing")))
        inplay = detail.get("inplayData") or {}
        batsmen = inplay.get("batsmen", []) if isinstance(inplay, dict) else []
        bowlers = inplay.get("bowlers", []) if isinstance(inplay, dict) else []
        print("HIGHLIGHTLY_INPLAYDATA_PRESENT=" + str(bool(inplay)))
        print("HIGHLIGHTLY_BATSMEN_COUNT=" + str(len(batsmen) if isinstance(batsmen, list) else 0))
        print("HIGHLIGHTLY_BOWLERS_COUNT=" + str(len(bowlers) if isinstance(bowlers, list) else 0))
        for label, collection in (("BATSMAN", batsmen), ("BOWLER", bowlers)):
            if isinstance(collection, list) and collection:
                sample = collection[0] if isinstance(collection[0], dict) else {}
                print(f"HIGHLIGHTLY_SAMPLE_{label}_KEYS=" + ",".join(sorted(sample.keys())[:35]))
                print(f"HIGHLIGHTLY_SAMPLE_{label}=" + str(sample)[:700])
        score_values = [str(home_state.get("score") or ""), str(away_state.get("score") or "")]
        numeric_score = any(__import__("re").search(r"\b\d+\s*/\s*\d+\b", x) for x in score_values)
        info_values = [str(home_state.get("info") or ""), str(away_state.get("info") or "")]
        has_overs = any("ov" in x.casefold() for x in info_values)
        has_target = any("t:" in x.casefold() for x in info_values)
        print("HIGHLIGHTLY_NUMERIC_SCORE_PRESENT=" + str(numeric_score))
        print("HIGHLIGHTLY_OVERS_PRESENT=" + str(has_overs))
        print("HIGHLIGHTLY_TARGET_PRESENT=" + str(has_target))
        print("HIGHLIGHTLY_LIVE_STATE_USABLE=" + str(
            state_detail.get("description", "").casefold() in {"in play", "innings break"} and
            numeric_score and has_overs
        ))

def main() -> int:
    audit_highlightly()
    date_utc = datetime.now(timezone.utc).date().isoformat()
    try:
        response = requests.get(
            f"{BASE}/fixtures/",
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

    fixtures = unwrap_matches(payload)
    print(f"SPORTSCORE_FIXTURE_COUNT={len(fixtures)}")
    t10 = [m for m in fixtures if is_t10(m)]
    t10_with_slug = [m for m in t10 if fixture_slug(m)]
    print(f"SPORTSCORE_T10_FIXTURE_COUNT={len(t10)}")
    print(f"SPORTSCORE_T10_WITH_DETAIL_SLUG={len(t10_with_slug)}")

    selected = (t10_with_slug[0] if t10_with_slug else
                t10[0] if t10 else
                next((m for m in fixtures if fixture_slug(m)), None))
    if selected is None:
        print("SPORTSCORE_DETAIL_STATUS=NO_FIXTURE_WITH_DOCUMENTED_SLUG")
        if fixtures:
            sample = fixtures[0]
            print("SPORTSCORE_SAMPLE_FIXTURE_KEYS=" + ",".join(sorted(sample.keys())[:50]))
        return 0

    print("SPORTSCORE_SELECTED_MATCH=" + " vs ".join(
        str(selected.get(k) or "?") for k in ("home", "away")))
    print("SPORTSCORE_SELECTED_FORMAT=" + (fixture_format(selected) or "unknown"))
    print("SPORTSCORE_SELECTED_STATUS=" +
          str(selected.get("status_text") or selected.get("status") or "unknown"))
    print("SPORTSCORE_SELECTED_MATCH_URL=" + str(selected.get("url") or "missing"))
    slug = fixture_slug(selected)
    print("SPORTSCORE_DETAIL_SLUG=" + (slug or "missing"))
    if not slug:
        print("SPORTSCORE_DETAIL_STATUS=NO_SLUG_OR_MATCH_URL")
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

    print("SPORTSCORE_DETAIL_ROOT_KEYS=" + ",".join(sorted(detail_payload.keys())[:50])
          if isinstance(detail_payload, dict) else
          "SPORTSCORE_DETAIL_ROOT_TYPE=" + type(detail_payload).__name__)
    match_detail = detail_payload.get("match") if isinstance(detail_payload, dict) else None
    if isinstance(match_detail, dict):
        print("SPORTSCORE_MATCH_DETAIL_KEYS=" + ",".join(sorted(match_detail.keys())[:60]))
        for key in (
            "status", "status_text", "score", "scorecard", "innings", "current_innings",
            "home_score", "away_score", "runs", "wickets", "overs", "current_score",
            "team1_score", "team2_score", "live_score", "target",
        ):
            if match_detail.get(key) is not None:
                value = match_detail[key]
                if isinstance(value, (str, int, float, bool, list, dict)):
                    print(f"SPORTSCORE_MATCH_DETAIL_{key.upper()}={str(value)[:500]}")
    # Probe the documented tracker endpoint only when the detail supplies a numeric ID.
    tracker_id = None
    if isinstance(match_detail, dict):
        for key in ("id", "match_id", "matchId", "tracker_id"):
            value = match_detail.get(key)
            if value is not None and str(value).strip():
                tracker_id = str(value).strip()
                break
        tracker_value = match_detail.get("tracker")
        if tracker_id is None and isinstance(tracker_value, dict):
            for key in ("id", "match_id", "matchId"):
                value = tracker_value.get(key)
                if value is not None and str(value).strip():
                    tracker_id = str(value).strip()
                    break
        print("SPORTSCORE_TRACKER_FIELD=" + str(tracker_value)[:500])
    print("SPORTSCORE_TRACKER_ID=" + (tracker_id or "NOT_PROVIDED"))
    if tracker_id:
        try:
            tracker_response = requests.get(
                f"{BASE}/tracker/",
                params={"sport": "cricket", "id": tracker_id,
                        "src": "cricket-ai-predictor"},
                timeout=TIMEOUT,
            )
            print(f"SPORTSCORE_TRACKER_HTTP={tracker_response.status_code}")
            if tracker_response.status_code == 200:
                tracker_payload = tracker_response.json()
                print("SPORTSCORE_TRACKER_ROOT_KEYS=" +
                      ",".join(sorted(tracker_payload.keys())[:50])
                      if isinstance(tracker_payload, dict) else
                      "SPORTSCORE_TRACKER_ROOT_TYPE=" + type(tracker_payload).__name__)
                tracker_arrays = find_event_arrays(tracker_payload)
                for item in tracker_arrays[:20]:
                    print("SPORTSCORE_TRACKER_EVENT_ARRAY=" + str(item))
                print("SPORTSCORE_TRACKER_DELIVERY_ARRAYS=" +
                      str(sum(1 for item in tracker_arrays if item["delivery_like"])))
        except (requests.RequestException, ValueError) as exc:
            print("SPORTSCORE_TRACKER_ERROR=" + type(exc).__name__)
    else:
        print("SPORTSCORE_TRACKER_STATUS=SKIPPED_NO_NUMERIC_MATCH_ID")

    candidates = find_event_arrays(detail_payload)
    for item in candidates[:25]:
        print("SPORTSCORE_EVENT_ARRAY=" + str(item))
    actual = [item for item in candidates if item["delivery_like"]]
    print(f"SPORTSCORE_DELIVERY_ARRAYS={len(actual)}")
    print("SPORTSCORE_BALL_BY_BALL_STATUS=" +
          ("PRESENT_CANDIDATE_REQUIRES_SEMANTIC_VALIDATION" if actual else
           "NOT_FOUND_IN_SELECTED_DETAIL"))
    # Probe one current non-T10 live fixture separately; the first
    # selected fixture above intentionally prefers T10 for the user's question.
    live_non_t10 = [
        row for row in fixtures
        if not is_t10(row) and
        "live" in str(row.get("status") or row.get("status_text") or "").casefold()
        and fixture_slug(row)
    ]
    print("SPORTSCORE_LIVE_NON_T10_FIXTURES=" + str(len(live_non_t10)))
    if live_non_t10:
        live_fixture = live_non_t10[0]
        live_slug = fixture_slug(live_fixture)
        print("SPORTSCORE_LIVE_NON_T10_MATCH=" +
              " vs ".join(str(live_fixture.get(k) or "?") for k in ("home", "away")))
        try:
            live_detail_response = requests.get(
                f"{BASE}/match/",
                params={"sport": "cricket", "slug": live_slug,
                        "src": "cricket-ai-predictor"},
                timeout=TIMEOUT,
            )
            print(f"SPORTSCORE_LIVE_NON_T10_DETAIL_HTTP={live_detail_response.status_code}")
            if live_detail_response.status_code == 200:
                live_detail_payload = live_detail_response.json()
                live_detail = live_detail_payload.get("match", {}) if isinstance(live_detail_payload, dict) else {}
                if isinstance(live_detail, dict):
                    print("SPORTSCORE_LIVE_NON_T10_DETAIL_KEYS=" +
                          ",".join(sorted(live_detail.keys())[:80]))
                    for key in ("status", "status_text", "home_score", "away_score",
                                "score", "stats", "incidents", "tracker"):
                        if live_detail.get(key) is not None:
                            print(f"SPORTSCORE_LIVE_NON_T10_{key.upper()}=" +
                                  str(live_detail[key])[:1200])
                    arrays = find_event_arrays(live_detail_payload)
                    print("SPORTSCORE_LIVE_NON_T10_DELIVERY_ARRAYS=" +
                          str(sum(1 for item in arrays if item["delivery_like"])))
                    tracker = live_detail.get("tracker")
                    tracker_id = tracker.get("id") if isinstance(tracker, dict) else None
                    if tracker_id:
                        try:
                            tracker_response = requests.get(
                                f"{BASE}/tracker/",
                                params={"sport": "cricket", "id": str(tracker_id),
                                        "src": "cricket-ai-predictor"},
                                timeout=TIMEOUT,
                            )
                            print(f"SPORTSCORE_LIVE_NON_T10_TRACKER_HTTP={tracker_response.status_code}")
                            if tracker_response.status_code == 200:
                                tracker_payload = tracker_response.json()
                                print("SPORTSCORE_LIVE_NON_T10_TRACKER_KEYS=" +
                                      ",".join(sorted(tracker_payload.keys())[:50])
                                      if isinstance(tracker_payload, dict) else
                                      "SPORTSCORE_LIVE_NON_T10_TRACKER_TYPE=" +
                                      type(tracker_payload).__name__)
                                tracker_arrays = find_event_arrays(tracker_payload)
                                for item in tracker_arrays[:15]:
                                    print("SPORTSCORE_LIVE_NON_T10_TRACKER_ARRAY=" + str(item))
                                print("SPORTSCORE_LIVE_NON_T10_TRACKER_DELIVERY_ARRAYS=" +
                                      str(sum(1 for item in tracker_arrays if item["delivery_like"])))
                        except (requests.RequestException, ValueError) as exc:
                            print("SPORTSCORE_LIVE_NON_T10_TRACKER_ERROR=" + type(exc).__name__)
        except (requests.RequestException, ValueError) as exc:
            print("SPORTSCORE_LIVE_NON_T10_DETAIL_ERROR=" + type(exc).__name__)

    # Probe the configured primary RapidAPI feed once, using the same
    # endpoint and parameters as the production daily fixture snapshot.
    primary_key = __import__("os").environ.get("RAPIDAPI_KEY", "").strip()
    print("PRIMARY_RAPIDAPI_KEY_CONFIGURED=" + str(bool(primary_key)))
    if primary_key:
        try:
            primary_response = requests.get(
                "https://cricket-live-line-advance.p.rapidapi.com/matches",
                headers={
                    "X-RapidAPI-Key": primary_key,
                    "X-RapidAPI-Host": "cricket-live-line-advance.p.rapidapi.com",
                },
                params={"date": date_utc, "per_paged": 100, "paged": 1},
                timeout=TIMEOUT,
            )
            print(f"PRIMARY_LIVE_FEED_HTTP={primary_response.status_code}")
            if primary_response.status_code == 200:
                primary_payload = primary_response.json()
                primary_root = primary_payload.get("response", {}) if isinstance(primary_payload, dict) else {}
                primary_items = primary_root.get("items", []) if isinstance(primary_root, dict) else []
                live_items = [
                    row for row in primary_items if isinstance(row, dict) and
                    ("live" in str(row.get("status") or row.get("status_str") or "").casefold()
                     or row.get("live") is True or row.get("match_live") is True)
                ] if isinstance(primary_items, list) else []
                print(f"PRIMARY_FIXTURE_COUNT={len(primary_items) if isinstance(primary_items, list) else 0}")
                print(f"PRIMARY_LIVE_FIXTURE_COUNT={len(live_items)}")
                if live_items:
                    sample = live_items[0]
                    print("PRIMARY_LIVE_ITEM_KEYS=" + ",".join(sorted(sample.keys())[:80]))
                    for key in ("score", "scores", "scorecard", "status", "status_str",
                                "live", "match_live", "overs", "innings", "target",
                                "current_score", "runs", "wickets"):
                        if sample.get(key) is not None:
                            print(f"PRIMARY_LIVE_{key.upper()}={str(sample[key])[:900]}")
                    arrays = find_event_arrays(sample)
                    print("PRIMARY_LIVE_DELIVERY_ARRAYS=" +
                          str(sum(1 for item in arrays if item["delivery_like"])))
            else:
                print("PRIMARY_LIVE_FEED_ACCESS=UNAVAILABLE")
        except (requests.RequestException, ValueError) as exc:
            print("PRIMARY_LIVE_FEED_ERROR=" + type(exc).__name__)
    else:
        print("PRIMARY_LIVE_FEED_STATUS=NO_SECRET_CONFIGURED")

    # Probe the already-configured CricketData backup; report only field
    # names and safe score values, never the credential or raw response.
    cricketdata_key = __import__("os").environ.get("CRICKETDATA_API_KEY", "").strip()
    print("CRICKETDATA_API_KEY_CONFIGURED=" + str(bool(cricketdata_key)))
    if cricketdata_key:
        try:
            cricketdata_response = requests.get(
                "https://api.cricapi.com/v1/currentMatches",
                params={"apikey": cricketdata_key, "offset": 0},
                timeout=TIMEOUT,
            )
            print(f"CRICKETDATA_CURRENT_HTTP={cricketdata_response.status_code}")
            if cricketdata_response.status_code == 200:
                cricketdata_payload = cricketdata_response.json()
                records = cricketdata_payload.get("data", []) if isinstance(cricketdata_payload, dict) else []
                live_records = [
                    row for row in records if isinstance(row, dict) and (
                        row.get("matchStarted") is True or
                        "live" in str(row.get("status") or "").casefold()
                    )
                ] if isinstance(records, list) else []
                bbb_records = [
                    row for row in live_records if row.get("bbbEnabled") is True
                ]
                print(f"CRICKETDATA_FIXTURE_COUNT={len(records) if isinstance(records, list) else 0}")
                print(f"CRICKETDATA_LIVE_FIXTURE_COUNT={len(live_records)}")
                print(f"CRICKETDATA_LIVE_BBB_ENABLED_COUNT={len(bbb_records)}")
                if live_records:
                    sample = bbb_records[0] if bbb_records else live_records[0]
                    print("CRICKETDATA_LIVE_ITEM_KEYS=" + ",".join(sorted(sample.keys())[:80]))
                    for key in ("matchType", "status", "score", "scorecard",
                                "matchStarted", "matchEnded", "teams", "tossWinner",
                                "tossChoice"):
                        if sample.get(key) is not None:
                            print(f"CRICKETDATA_LIVE_{key.upper()}={str(sample[key])[:1000]}")
                    arrays = find_event_arrays(sample)
                    print("CRICKETDATA_LIVE_DELIVERY_ARRAYS=" +
                          str(sum(1 for item in arrays if item["delivery_like"])))
                    print("CRICKETDATA_LIVE_BBB_ENABLED=" + str(sample.get("bbbEnabled")))
                    sample_id = sample.get("id")
                    if sample_id:
                        for endpoint in ("match_info", "match_bbb"):
                            try:
                                detail_response = requests.get(
                                    f"https://api.cricapi.com/v1/{endpoint}",
                                    params={"apikey": cricketdata_key, "offset": 0,
                                            "id": str(sample_id)},
                                    timeout=TIMEOUT,
                                )
                                print(f"CRICKETDATA_{endpoint.upper()}_HTTP={detail_response.status_code}")
                                if detail_response.status_code == 200:
                                    detail_payload = detail_response.json()
                                    detail_data = detail_payload.get("data") if isinstance(detail_payload, dict) else None
                                    if isinstance(detail_data, dict):
                                        print(f"CRICKETDATA_{endpoint.upper()}_KEYS=" +
                                              ",".join(sorted(detail_data.keys())[:80]))
                                        for key in ("score", "scorecard", "innings", "status",
                                                    "matchStarted", "matchEnded", "bbbEnabled"):
                                            if detail_data.get(key) is not None:
                                                print(f"CRICKETDATA_{endpoint.upper()}_{key.upper()}=" +
                                                      str(detail_data[key])[:1400])
                                    elif isinstance(detail_data, list):
                                        print(f"CRICKETDATA_{endpoint.upper()}_ROWS={len(detail_data)}")
                                        if detail_data and isinstance(detail_data[0], dict):
                                            print(f"CRICKETDATA_{endpoint.upper()}_ROW_KEYS=" +
                                                  ",".join(sorted(detail_data[0].keys())[:60]))
                                    print(f"CRICKETDATA_{endpoint.upper()}_DELIVERY_ARRAYS=" +
                                          str(sum(1 for item in find_event_arrays(detail_payload)
                                                  if item["delivery_like"])))
                            except (requests.RequestException, ValueError) as exc:
                                print(f"CRICKETDATA_{endpoint.upper()}_ERROR=" + type(exc).__name__)
            else:
                print("CRICKETDATA_CURRENT_ACCESS=UNAVAILABLE")
        except (requests.RequestException, ValueError) as exc:
            print("CRICKETDATA_CURRENT_ERROR=" + type(exc).__name__)
    else:
        print("CRICKETDATA_CURRENT_STATUS=NO_SECRET_CONFIGURED")

    # Probe anonymous access; docs do not guarantee that this account has a free key.
    try:
        live_response = requests.get(
            "https://api.cricketdatabase.com/v1/live",
            timeout=TIMEOUT,
            headers={"Accept": "application/json"},
        )
        print(f"CRICKETDATABASE_LIVE_HTTP={live_response.status_code}")
        if live_response.status_code == 200:
            live_payload = live_response.json()
            live_data = live_payload.get("data", {}) if isinstance(live_payload, dict) else {}
            live_rows = live_data.get("results", []) if isinstance(live_data, dict) else []
            print(f"CRICKETDATABASE_LIVE_COUNT={len(live_rows) if isinstance(live_rows, list) else 0}")
            if isinstance(live_rows, list) and live_rows:
                sample_live = next((row for row in live_rows if isinstance(row, dict)), {})
                print("CRICKETDATABASE_LIVE_MATCH_KEYS=" +
                      ",".join(sorted(sample_live.keys())[:60]))
                print("CRICKETDATABASE_LIVE_BALL_BY_BALL_TRUE=" +
                      str(sum(1 for row in live_rows if isinstance(row, dict)
                              and row.get("ball_by_ball") is True)))
                print("CRICKETDATABASE_LIVE_SAMPLE_MATCH=" +
                      str(sample_live.get("match") or "NOT_PROVIDED"))
        else:
            print("CRICKETDATABASE_LIVE_ACCESS=NOT_PUBLIC_WITHOUT_KEY")
    except (requests.RequestException, ValueError) as exc:
        print("CRICKETDATABASE_LIVE_ERROR=" + type(exc).__name__)

    print("SPORTSCORE_AUDIT=READ_ONLY_COMPLETE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
