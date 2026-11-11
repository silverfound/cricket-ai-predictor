"""Safe adapters for secondary cricket fixture providers.

Secondary providers are called only after the primary feed is unusable.
The adapters intentionally normalize fixture metadata only; they do not
fabricate scores, tosses, innings, or live-ball state.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from email.utils import parsedate_to_datetime
import os
import requests

TIMEOUT = 25
HIGHLIGHTLY_HOST = "cricket-highlights-api.p.rapidapi.com"



def _name(value):
    if isinstance(value, dict):
        return str(value.get("name") or value.get("teamName") or value.get("title") or "").strip()
    return str(value or "").strip()


def _timestamp(*values):
    for value in values:
        if not value:
            continue
        raw = str(value).strip()
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return int(parsed.timestamp())
        except (TypeError, ValueError):
            pass
        try:
            parsed = parsedate_to_datetime(raw)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return int(parsed.timestamp())
        except (TypeError, ValueError, OverflowError):
            pass
    return 0


def _format(value):
    raw = str(value or "").strip()
    key = raw.casefold().replace("-", " ").replace("_", " ")
    if "t10" in key or "ten over" in key or "10 over" in key:
        return "T10"
    if "test" in key or "first class" in key or key == "mdm":
        return "Test"
    if "odi" in key or "one day" in key or "50 over" in key or key == "odm":
        return "ODI"
    if "t20" in key or "twenty20" in key or key == "it20":
        return "T20"
    return raw or "Unknown"


def _normalized_fixture(match_id, team1, team2, fmt, venue, status, start, source, extra=None):
    team1, team2 = _name(team1), _name(team2)
    if not team1 or not team2 or team1.casefold() == team2.casefold():
        return None
    fixture = {
        "match_id": str(match_id or f"{source}:{team1}:{team2}:{start}"),
        "teama": {"name": team1},
        "teamb": {"name": team2},
        "format_str": _format(fmt),
        "venue": {"name": _name(venue)},
        "status": str(status or ""),
        "timestamp_start": int(start or 0),
        "provider_source": source,
    }
    if extra:
        fixture["provider_metadata"] = extra
    # Deliberately no score/toss/live fields unless a provider adapter is
    # explicitly verified to supply them in the production schema.
    return fixture



def _toss_decision(value):
    raw = str(value or "").strip().casefold()
    if raw in {"bat", "batting", "elected to bat", "choose to bat"}:
        return "bat"
    if raw in {"bowl", "bowling", "field", "fielding", "elected to field", "elected to bowl", "choose to bowl"}:
        return "field"
    return ""


def _attach_match_details(fixture, item):
    """Copy only provider-supplied score, squad and toss fields; never infer them."""
    if not isinstance(item, dict):
        return fixture
    for source, target in (("score", "score"), ("teamInfo", "team_info"),
                           ("scorecard", "scorecard")):
        value = item.get(source)
        if isinstance(value, (list, dict)):
            fixture[target] = value
    toss_winner = item.get("tossWinner") or item.get("toss_winner")
    toss_decision = _toss_decision(item.get("tossChoice") or item.get("tossDecision")
                                   or item.get("toss_decision"))
    if toss_winner:
        fixture["toss_winner"] = _name(toss_winner)
    if toss_decision:
        fixture["toss_decision"] = toss_decision
    return fixture


def normalize_cricketdata(payload):
    if not isinstance(payload, dict) or payload.get("status") not in ("success", None):
        raise ValueError("CricketData response status is not success")
    records = payload.get("data")
    if not isinstance(records, list) or not records:
        raise ValueError("CricketData response has no non-empty data list")
    fixtures = []
    for item in records:
        if not isinstance(item, dict):
            continue
        teams = item.get("teams")
        if not isinstance(teams, list) or len(teams) < 2:
            continue
        # dateTimeGMT is the provider's match start timestamp. date is only
        # a fallback; no local-time assumption is made.
        start = _timestamp(item.get("dateTimeGMT"), item.get("date"))
        fixture = _normalized_fixture(
            item.get("id"), teams[0], teams[1], item.get("matchType"),
            item.get("venue"), item.get("status"), start, "CricketData",
            {"name": item.get("name", ""), "series_id": item.get("series_id"),
             "matchStarted": item.get("matchStarted"), "matchEnded": item.get("matchEnded")}
        )
        fixtures.append(_attach_match_details(fixture, item))
    fixtures = [item for item in fixtures if item]
    if not fixtures:
        raise ValueError("CricketData returned no fixtures with two valid team names")
    return fixtures


def normalize_highlightly(payload):
    if not isinstance(payload, dict):
        raise ValueError("Highlightly response is not an object")
    records = payload.get("data")
    if not isinstance(records, list) or not records:
        raise ValueError("Highlightly response has no non-empty data list")
    fixtures = []
    for item in records:
        if not isinstance(item, dict):
            continue
        home = item.get("homeTeam")
        away = item.get("awayTeam")
        date_value = item.get("startDate")
        time_value = item.get("startTime")
        combined_start = f"{date_value}T{time_value}" if date_value and time_value else date_value
        start = _timestamp(combined_start, time_value)
        venue = item.get("venue")
        fixtures.append(_normalized_fixture(
            item.get("id"), home, away, item.get("format"), venue,
            item.get("state"), start, "Highlightly",
            {"league": item.get("league"), "country": item.get("country"),
             "dayType": item.get("dayType"), "endDate": item.get("endDate")}
        ))
    fixtures = [item for item in fixtures if item]
    if not fixtures:
        raise ValueError("Highlightly returned no fixtures with two valid team names")
    return fixtures


def fetch_cricketdata():
    key = os.getenv("CRICKETDATA_API_KEY", "").strip()
    if not key:
        raise RuntimeError("CRICKETDATA_API_KEY is not configured")
    response = requests.get(
        "https://api.cricapi.com/v1/currentMatches",
        params={"apikey": key, "offset": 0},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return normalize_cricketdata(response.json())


def fetch_highlightly():
    key = os.getenv("SECONDARY_API_KEY", "").strip()
    if not key:
        raise RuntimeError("SECONDARY_API_KEY is not configured")
    today = datetime.now(ZoneInfo("Asia/Riyadh")).date().isoformat()
    response = requests.get(
        f"https://{HIGHLIGHTLY_HOST}/matches",
        headers={"x-rapidapi-key": key, "x-rapidapi-host": HIGHLIGHTLY_HOST},
        params={"date": today, "timezone": "Asia/Riyadh", "limit": 100, "offset": 0},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return normalize_highlightly(response.json())



def fetch_cricketdata_match_info(match_id):
    """Fetch one CricketData match-info record for toss and detailed scorecard."""
    key = os.getenv("CRICKETDATA_API_KEY", "").strip()
    if not key:
        raise RuntimeError("CRICKETDATA_API_KEY is not configured")
    if not match_id:
        raise ValueError("CricketData match ID is required")
    response = requests.get(
        "https://api.cricapi.com/v1/match_info",
        params={"apikey": key, "offset": 0, "id": str(match_id)},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or payload.get("status") not in ("success", None):
        raise ValueError("CricketData match-info response is not successful")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("CricketData match-info response has no data object")
    return data
