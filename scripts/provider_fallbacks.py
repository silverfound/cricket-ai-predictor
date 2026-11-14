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

try:
    from scripts.team_identity import fixture_teams_equivalent
except ModuleNotFoundError as exc:
    if exc.name != "scripts":
        raise
    from team_identity import fixture_teams_equivalent

TIMEOUT = 25
HIGHLIGHTLY_HOST = "cricket-highlights-api.p.rapidapi.com"


def should_refresh_cricketdata_enrichment(now=None, event_name=None):
    """Allow optional CricketData enrichment only in the first 15 minutes of each hour.

    The fixture feed itself refreshes every 15 minutes. Restricting enrichment
    to minute 00-14 prevents the :15, :30, and :45 feed runs from repeating
    the hourly CricketData calls. Delayed :00 runs outside this window are
    skipped, and manual/push runs never spend optional enrichment quota.
    """
    event_name = event_name or os.getenv("GITHUB_EVENT_NAME", "")
    if event_name != "schedule":
        return False
    now = now or datetime.now(timezone.utc)
    return int(now.minute) < 15


def should_fetch_match_info_enrichment(provider_name, enrichment_due):
    """Avoid spending detail-call quota when CricketData is the emergency feed."""
    return bool(enrichment_due and provider_name != "CricketData")




def _name(value):
    if isinstance(value, dict):
        return str(value.get("name") or value.get("teamName") or value.get("title") or "").strip()
    return str(value or "").strip()


def _timestamp(*values, naive_timezone=timezone.utc):
    for value in values:
        if not value:
            continue
        raw = str(value).strip()
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=naive_timezone)
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


def _venue_metadata(value):
    """Preserve provider-supplied ground location data for the Ilmi resolver."""
    if isinstance(value, dict):
        metadata = dict(value)
        name = _name(value)
        if name:
            metadata["name"] = name
        return metadata
    return {"name": _name(value)}


def _provider_bool(value):
    if isinstance(value, bool): return value
    if isinstance(value, (int, float)) and value in (0, 1): return bool(value)
    if isinstance(value, str):
        key = value.strip().casefold()
        if key in {"true", "yes", "1", "started", "ended"}: return True
        if key in {"false", "no", "0", "not started", "not ended"}: return False
    return None


def _normalized_fixture(match_id, team1, team2, fmt, venue, status, start, source, extra=None):
    team1, team2 = _name(team1), _name(team2)
    if not team1 or not team2 or team1.casefold() == team2.casefold():
        return None
    fixture = {
        "match_id": str(match_id or f"{source}:{team1}:{team2}:{start}"),
        "teama": {"name": team1},
        "teamb": {"name": team2},
        "format_str": _format(fmt),
        "venue": _venue_metadata(venue),
        "status": str(status or ""),
        "timestamp_start": int(start or 0),
        "provider_source": source,
    }
    if extra:
        fixture["provider_metadata"] = extra
        started = _provider_bool(extra.get("matchStarted", extra.get("match_started")))
        ended = _provider_bool(extra.get("matchEnded", extra.get("match_ended")))
        if started is not None:
            fixture["match_started"] = started
        if ended is not None:
            fixture["match_ended"] = ended
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
        start = _timestamp(combined_start, time_value, naive_timezone=ZoneInfo('Asia/Riyadh'))
        venue = item.get("venue")
        state = item.get("state")
        # Highlightly returns state as an object (description/report), not a
        # plain status string. Publish both normalized fields consumed by UI.
        if isinstance(state, dict):
            status = state.get("description") or state.get("status") or state.get("name") or ""
            status_note = state.get("report") or ""
        else:
            status = state or ""
            status_note = ""
        fixture = _normalized_fixture(
            item.get("id"), home, away, item.get("format"), venue,
            status, start, "Highlightly",
            {"league": item.get("league"), "country": item.get("country"),
             "dayType": item.get("dayType"), "endDate": item.get("endDate"),
             "matchStarted": item.get("matchStarted", item.get("match_started")),
             "matchEnded": item.get("matchEnded", item.get("match_ended"))}
        )
        fixture["status_str"] = str(status)
        if status_note:
            fixture["status_note"] = str(status_note)
        fixtures.append(fixture)
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




def fetch_live_line_advance(date=None):
    """Fetch the Live Line Advance fixtures as a supplemental primary feed.

    Pagination is validated as a whole before fixtures are returned; callers
    can safely retain the Highlightly snapshot if this adapter fails.
    """
    key = os.getenv("RAPIDAPI_KEY", "").strip()
    if not key:
        raise RuntimeError("RAPIDAPI_KEY is not configured")
    date = date or datetime.now(timezone.utc).date().isoformat()
    url = "https://cricket-live-line-advance.p.rapidapi.com/matches"
    headers = {"X-RapidAPI-Key": key,
               "X-RapidAPI-Host": "cricket-live-line-advance.p.rapidapi.com"}
    params = {"date": date, "per_paged": 100, "paged": 1}
    response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    body = payload.get("response") if isinstance(payload, dict) else None
    first = body.get("items") if isinstance(body, dict) else None
    if not isinstance(first, list) or not first or not all(isinstance(x, dict) for x in first):
        raise ValueError("Live Line Advance returned no valid response.items")
    pages = int(body.get("total_pages") or 1)
    total = int(body.get("total_items") or len(first))
    if pages < 1 or pages > 2:
        raise ValueError(f"Live Line Advance unsupported page count: {pages}")
    items = list(first)
    if pages == 2:
        page2 = requests.get(url, params={"date": date, "per_paged": 100, "paged": 2},
                             headers=headers, timeout=TIMEOUT)
        page2.raise_for_status()
        payload2 = page2.json()
        body2 = payload2.get("response") if isinstance(payload2, dict) else None
        second = body2.get("items") if isinstance(body2, dict) else None
        if not isinstance(second, list) or not all(isinstance(x, dict) for x in second):
            raise ValueError("Live Line Advance page 2 is malformed")
        if int(body2.get("total_pages") or 1) != pages or int(body2.get("total_items") or total) != total:
            raise ValueError("Live Line Advance pagination metadata changed")
        items.extend(second)
    if len(items) != total:
        raise ValueError(f"Live Line Advance incomplete fixtures: {len(items)} of {total}")
    ids = [str(x.get("match_id") or x.get("id") or x.get("matchId")) for x in items
           if x.get("match_id") is not None or x.get("id") is not None or x.get("matchId") is not None]
    if ids and (len(ids) != len(items) or len(ids) != len(set(ids))):
        raise ValueError("Live Line Advance fixtures contain missing or duplicate IDs")
    for item in items:
        item.setdefault("provider_source", "Cricket Live Line Advance")
    return items



def is_indian_domestic_fixture(item):
    """Hide Indian domestic/state competitions while retaining IPL, WPL and internationals."""
    if not isinstance(item, dict):
        return False

    def flatten(value):
        if isinstance(value, dict):
            return " ".join(flatten(v) for v in value.values())
        if isinstance(value, (list, tuple, set)):
            return " ".join(flatten(v) for v in value)
        return str(value or "")

    metadata = item.get("provider_metadata") or {}
    competition_text = " ".join(flatten(item.get(key)) for key in (
        "league", "series", "tournament", "competition", "event", "match_name",
        "name", "title", "series_name", "competition_name"
    ))
    competition_text += " " + " ".join(flatten(metadata.get(key)) for key in (
        "league", "series", "tournament", "competition", "event", "name",
        "series_name", "competition_name"
    ))
    comp = competition_text.casefold()
    # Franchise leagues and international fixtures are intentionally retained.
    if any(token in comp for token in ("indian premier league", "ipl", "women's premier league", "wpl")):
        return False
    domestic_markers = (
        "ranji trophy", "vijay hazare", "syed mushtaq ali", "duleep trophy",
        "irani cup", "ck nayudu", "c k nayudu", "buchi babu",
        "maharaja trophy", "karnataka premier league", "tamil nadu premier league",
        "tamil nadu premier", "kerala cricket league", "maharashtra premier league",
        "bengal pro t20", "delhi premier league", "uttar pradesh t20",
        "madhya pradesh t20", "rajasthan premier league", "haryana premier league",
        "andhra premier league", "punjab t20", "odisha t20", "assam t20",
        "india domestic", "indian domestic"
    )
    if any(token in comp for token in domestic_markers):
        return True

    country_text = " ".join(flatten(item.get(key)) for key in ("country", "venue"))
    country_text += " " + " ".join(flatten(metadata.get(key)) for key in ("country", "venue"))
    country = country_text.casefold()
    is_india = any(token in country for token in ("india", "indian"))
    if not is_india:
        return False

    teams = []
    for key in ("teama", "teamb"):
        team = item.get(key) or {}
        teams.append(str(team.get("name") or "").casefold() if isinstance(team, dict) else str(team).casefold())
    state_teams = (
        "mumbai", "maharashtra", "karnataka", "delhi", "bengal", "tamil nadu",
        "punjab", "haryana", "rajasthan", "uttar pradesh", "madhya pradesh",
        "andhra", "kerala", "goa", "odisha", "assam", "tripura", "saurashtra",
        "vidarbha", "baroda", "hyderabad", "services", "railways", "jharkhand",
        "chhattisgarh", "himachal", "jammu and kashmir", "uttarakhand"
    )
    return len(teams) == 2 and all(any(state in team for state in state_teams) for team in teams)

def merge_fixture_coverage(primary_items, supplemental_items):
    """Append only supplemental fixtures not already represented by primary.

    Teams and format must agree, and timestamps must be within 12 hours to
    avoid collapsing distinct league meetings between the same teams.
    """
    def names(item):
        return [str((item.get(k) or {}).get("name") or "").strip()
                for k in ("teama", "teamb")]
    def fmt(item):
        return _format(item.get("format_str") or item.get("format"))
    def start(item):
        try: return int(item.get("timestamp_start") or 0)
        except (TypeError, ValueError): return 0
    added = 0
    for candidate in supplemental_items or []:
        candidate_names = names(candidate)
        if not all(candidate_names):
            continue
        duplicate = False
        for current in primary_items:
            current_names = names(current)
            if not all(current_names) or fmt(current) != fmt(candidate):
                continue
            if not fixture_teams_equivalent(*current_names, *candidate_names):
                continue
            current_start, candidate_start = start(current), start(candidate)
            if current_start and candidate_start and abs(current_start-candidate_start) <= 12*3600:
                duplicate = True
                break
            if not current_start and not candidate_start:
                current_venue = str((current.get("venue") or {}).get("name") or "").casefold()
                candidate_venue = str((candidate.get("venue") or {}).get("name") or "").casefold()
                if current_venue and current_venue == candidate_venue:
                    duplicate = True
                    break
        if not duplicate:
            copy = dict(candidate)
            copy.setdefault("provider_source", "Cricket Live Line Advance")
            primary_items.append(copy)
            added += 1
    return added


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
