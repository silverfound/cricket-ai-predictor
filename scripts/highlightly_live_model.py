"""Convert verified Highlightly live scorecards into calibrated T20/ODI win probabilities.

This module fails closed when the scorecard does not identify the current innings,
batting side, legal-ball count, wickets, or a second-innings target. T10 is never
routed through the T20 model.
"""
from __future__ import annotations

import json
import math
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter

import requests

HOST = "cricket-highlights-api.p.rapidapi.com"
BASE_URL = f"https://{HOST}"
TIMEOUT = 20
MAX_DETAILS_PER_RUN = 5
MODEL_PATH = Path("data/live_winprob_browser.json")
LIVE_STATES = {"in play", "drinks", "timeout", "innings break", "lunch", "tea"}


def _name_key(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold().replace("&", "and"))


def _is_women(value: object) -> bool:
    return bool(re.search(r"\b(women|woman|w)\b", str(value or ""), re.I))


def _same_team(left: object, right: object) -> bool:
    return _name_key(left) == _name_key(right) and _is_women(left) == _is_women(right)


def _score(value: object) -> tuple[int, int] | None:
    match = re.fullmatch(r"\s*(\d+)\s*/\s*(\d+)\s*", str(value or ""))
    if not match:
        return None
    runs, wickets = map(int, match.groups())
    if runs < 0 or not 0 <= wickets <= 10:
        return None
    return runs, wickets


def _overs_to_balls(value: str) -> int | None:
    match = re.fullmatch(r"\s*(\d+)(?:\.(\d))?\s*", value)
    if not match:
        return None
    overs = int(match.group(1))
    balls = int(match.group(2) or 0)
    if balls > 5:
        return None
    return overs * 6 + balls


def _overs_info(info: object, default_overs: int) -> tuple[int, int] | None:
    match = re.search(r"(\d+(?:\.\d+)?)(?:\s*/\s*(\d+(?:\.\d+)?))?\s*ov\b", str(info or ""), re.I)
    if not match:
        return None
    legal_balls = _overs_to_balls(match.group(1))
    scheduled_balls = _overs_to_balls(match.group(2)) if match.group(2) else default_overs * 6
    if legal_balls is None or scheduled_balls is None or scheduled_balls <= 0 or legal_balls > scheduled_balls:
        return None
    return legal_balls, scheduled_balls


def _target(info: object) -> int | None:
    match = re.search(r"\bT\s*:\s*(\d+)\b", str(info or ""), re.I)
    return int(match.group(1)) if match else None


def _interpolate(value: float, xs: list[float], ys: list[float]) -> float:
    if not xs or len(xs) != len(ys):
        raise ValueError("Invalid calibration curve")
    if value <= xs[0]:
        return ys[0]
    if value >= xs[-1]:
        return ys[-1]
    for index in range(1, len(xs)):
        if xs[index] >= value:
            width = xs[index] - xs[index - 1]
            if width <= 0:
                return ys[index - 1]
            ratio = (value - xs[index - 1]) / width
            return ys[index - 1] + ratio * (ys[index] - ys[index - 1])
    return ys[-1]


def _predict(bundle: dict, fmt: str, features: dict) -> tuple[float, str]:
    format_models = bundle.get("models", {}).get(fmt)
    if not format_models:
        raise ValueError(f"No trained live model for {fmt}")
    progress = features["legal_balls"] / features["scheduled_balls"]
    phase = "early" if progress <= 0.25 else "middle" if progress <= 0.75 else "late"
    spec = format_models.get(phase)
    if not spec:
        raise ValueError(f"Missing {fmt} {phase} model")
    raw = float(spec["intercept"])
    for name, mean, scale, coefficient in zip(
        spec["features"], spec["mean"], spec["scale"], spec["coefficients"]
    ):
        value = float(features[name])
        if not math.isfinite(value) or float(scale) == 0:
            raise ValueError(f"Invalid live model feature: {name}")
        raw += ((value - float(mean)) / float(scale)) * float(coefficient)
    base = 1 / (1 + math.exp(-raw)) if raw >= 0 else math.exp(raw) / (1 + math.exp(raw))
    curve = spec["calibration"]
    return max(0.0, min(1.0, _interpolate(base, curve["x"], curve["y"]))), phase


def build_live_prediction(detail: dict, bundle: dict, fetched_at: str | None = None) -> dict:
    if isinstance(detail, list):
        detail = detail[0] if detail and isinstance(detail[0], dict) else {}
    if not isinstance(detail, dict):
        raise ValueError("Highlightly detail is not an object")
    state = detail.get("state") or {}
    status = str(state.get("description") or "").casefold()
    if status not in LIVE_STATES:
        raise ValueError(f"Match state is not currently playable: {status or 'unknown'}")

    raw_format = str(detail.get("format") or "").upper()
    fmt = "T20" if raw_format in {"T20", "IT20"} else "ODI" if raw_format in {"ODI", "ODM"} else ""
    if not fmt:
        raise ValueError(f"Unsupported live format: {raw_format or 'unknown'}")

    home = (detail.get("homeTeam") or {}).get("name") or ""
    away = (detail.get("awayTeam") or {}).get("name") or ""
    if not home or not away or _is_women(home) != _is_women(away):
        raise ValueError("Team identities or men's/women's classification are ambiguous")

    inplay = detail.get("inplayData") or {}
    batsmen = inplay.get("batsmen") if isinstance(inplay, dict) else None
    if not isinstance(batsmen, list) or not batsmen:
        raise ValueError("Highlightly has no current batting-player summary")
    batting_candidates = []
    for row in batsmen:
        if not isinstance(row, dict):
            continue
        team_name = ((row.get("team") or {}).get("name") or "")
        inning = (row.get("player") or {}).get("inning")
        if team_name and inning in (1, 2):
            batting_candidates.append((str(team_name), int(inning)))
    if not batting_candidates:
        raise ValueError("Current batting team and innings are unavailable")
    team_counts = Counter((name, inning) for name, inning in batting_candidates)
    (batting_team, innings), _ = team_counts.most_common(1)[0]
    if any(inning_value != innings for _, inning_value in batting_candidates):
        raise ValueError("Conflicting current innings in player summaries")
    if _same_team(batting_team, home):
        batting_side, bowling_team = "home", away
    elif _same_team(batting_team, away):
        batting_side, bowling_team = "away", home
    else:
        raise ValueError("Current batting team does not match either fixture team")

    teams = state.get("teams") or {}
    batting_state = teams.get(batting_side) or {}
    score = _score(batting_state.get("score"))
    if not score:
        raise ValueError("Current batting score is missing or invalid")
    runs, wickets = score
    default_overs = 20 if fmt == "T20" else 50
    progress = _overs_info(batting_state.get("info"), default_overs)
    if not progress:
        raise ValueError("Legal balls and scheduled overs are not available")
    legal_balls, scheduled_balls = progress
    balls_remaining = max(scheduled_balls - legal_balls, 0)

    target_runs = 0
    runs_needed = 0
    required_run_rate = 0.0
    if innings == 2:
        target_runs = _target(batting_state.get("info"))
        if target_runs is None or target_runs <= 0:
            raise ValueError("Second-innings target is absent; chase probability withheld")
        runs_needed = max(target_runs - runs, 0)
        required_run_rate = (runs_needed * 6 / balls_remaining) if balls_remaining else 0.0

    features = {
        "is_women": 1.0 if _is_women(home) else 0.0,
        "innings": float(innings),
        "runs_scored": float(runs),
        "wickets_lost": float(wickets),
        "legal_balls": float(legal_balls),
        "scheduled_balls": float(scheduled_balls),
        "balls_remaining": float(balls_remaining),
        "wickets_left": float(max(10 - wickets, 0)),
        "current_run_rate": float(runs * 6 / legal_balls) if legal_balls else 0.0,
        "required_run_rate": float(required_run_rate),
        "runs_needed": float(runs_needed),
        "target_runs": float(target_runs),
    }
    batting_probability, phase = _predict(bundle, fmt, features)
    return {
        "available": True,
        "provider": "Highlightly RapidAPI",
        "model": "2024-2026 calibrated state-only live model",
        "format": fmt,
        "phase": phase,
        "innings": innings,
        "batting_team": batting_team,
        "bowling_team": bowling_team,
        "score": f"{runs}/{wickets}",
        "overs": f"{legal_balls // 6}.{legal_balls % 6}/{scheduled_balls // 6}",
        "target_runs": target_runs or None,
        "runs_needed": runs_needed if innings == 2 else None,
        "balls_remaining": balls_remaining,
        "probabilities": {
            batting_team: round(batting_probability * 100, 2),
            bowling_team: round((1 - batting_probability) * 100, 2),
        },
        "batting_team_win_probability": round(batting_probability * 100, 2),
        "bowling_team_win_probability": round((1 - batting_probability) * 100, 2),
        "snapshot_at": fetched_at or datetime.now(timezone.utc).isoformat(),
        "snapshot_stale_after_minutes": 30,
        "training_years": [2024, 2025, 2026],
        "t10_enabled": False,
    }


def _is_live_fixture(item: dict) -> bool:
    status = str(item.get("status_str") or item.get("status_note") or item.get("status") or "").casefold()
    return any(token in status for token in ("live", "in play", "in progress", "drinks", "innings break", "timeout"))


def _team_match(a: str, b: str, fixture: dict) -> bool:
    one = ((fixture.get("homeTeam") or {}).get("name") or "")
    two = ((fixture.get("awayTeam") or {}).get("name") or "")
    same = _same_team(a, one) and _same_team(b, two)
    reverse = _same_team(a, two) and _same_team(b, one)
    return same or reverse


def enrich_live_predictions(fixtures: list[dict], provider_name: str) -> dict:
    key = os.getenv("SECONDARY_API_KEY", "").strip()
    if not key:
        print("LIVE_WINPROB_STATUS=SKIPPED_NO_HIGHLIGHTLY_SECRET")
        return {"attempted": 0, "predicted": 0}
    live = [item for item in fixtures if isinstance(item, dict) and _is_live_fixture(item)]
    if not live:
        print("LIVE_WINPROB_STATUS=NO_LIVE_FIXTURES_NO_HIGHLIGHTLY_CALLS")
        return {"attempted": 0, "predicted": 0}
    if not MODEL_PATH.exists():
        print("LIVE_WINPROB_STATUS=SKIPPED_MODEL_BUNDLE_MISSING")
        return {"attempted": 0, "predicted": 0}
    bundle = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
    if not bundle.get("models") or not {"T20", "ODI"}.intersection(bundle.get("supported_formats", [])):
        raise RuntimeError("Live model bundle has no supported limited-overs models")

    headers = {"x-rapidapi-key": key, "x-rapidapi-host": HOST}
    candidates = []
    if provider_name == "Highlightly":
        for item in live:
            match_id = item.get("match_id")
            if match_id:
                candidates.append((item, str(match_id)))
    else:
        from zoneinfo import ZoneInfo
        today = datetime.now(ZoneInfo("Asia/Riyadh")).date().isoformat()
        response = requests.get(
            f"{BASE_URL}/matches",
            params={"date": today, "timezone": "Asia/Riyadh", "limit": 100, "offset": 0},
            headers=headers,
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        payload = response.json()
        records = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(records, list):
            raise ValueError("Highlightly live fixture list has an unknown response shape")
        active_states = {"in play", "drinks", "timeout", "innings break", "lunch", "tea"}
        active_records = [
            row for row in records if isinstance(row, dict) and
            str((row.get("state") or {}).get("description") or "").casefold() in active_states
        ]
        for item in live:
            t1 = ((item.get("teama") or {}).get("name") or "")
            t2 = ((item.get("teamb") or {}).get("name") or "")
            matches = [row for row in active_records if _team_match(t1, t2, row)]
            if len(matches) == 1 and matches[0].get("id"):
                candidates.append((item, str(matches[0]["id"])))

    attempted = 0
    predicted = 0
    fetched_at = datetime.now(timezone.utc).isoformat()
    for item, match_id in candidates[:MAX_DETAILS_PER_RUN]:
        attempted += 1
        try:
            response = requests.get(
                f"{BASE_URL}/matches/{match_id}", headers=headers, timeout=TIMEOUT
            )
            response.raise_for_status()
            payload = response.json()
            detail = payload[0] if isinstance(payload, list) and payload else payload
            prediction = build_live_prediction(detail, bundle, fetched_at=fetched_at)
            item["live_winprob"] = prediction
            predicted += 1
        except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
            item.pop("live_winprob", None)
            print(f"LIVE_WINPROB_MATCH_SKIPPED={match_id}:{type(exc).__name__}:{str(exc)[:180]}")
    print(f"LIVE_WINPROB_DETAILS_ATTEMPTED={attempted}")
    print(f"LIVE_WINPROB_PREDICTIONS_CREATED={predicted}")
    return {"attempted": attempted, "predicted": predicted}
