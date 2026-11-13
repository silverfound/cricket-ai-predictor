"""Persistent, provider-agnostic archive of completed cricket fixtures."""
import re
from datetime import datetime, timezone, timedelta


def _truthy(value):
    if value is True or value == 1:
        return True
    if isinstance(value, str):
        return value.strip().casefold() in {"true", "yes", "1", "ended", "finished"}
    return False


def _result_text(item):
    metadata = item.get("provider_metadata") or {}
    values = [
        item.get("result_text"), item.get("result"), item.get("status_note"),
        item.get("status_str"), metadata.get("result"), metadata.get("status_note"),
        item.get("status"),
    ]
    return " ".join(str(value).strip() for value in values if isinstance(value, str) and value.strip())


def is_completed_fixture(item):
    metadata = item.get("provider_metadata") or {}
    if any(_truthy(value) for value in (
        item.get("match_ended"), item.get("matchEnded"),
        metadata.get("matchEnded"), metadata.get("match_ended"),
    )):
        return True
    text = _result_text(item).casefold()
    text = re.sub(r"\binnings?\s+(?:is\s+)?completed?\b", " ", text)
    return bool(re.search(
        r"\b(?:won|lost|beat|defeated|drawn?|tied|abandoned|cancelled|canceled|no result|match finished|match completed)\b",
        text,
    ))


def merge_recent_results(current_items, previous_items, existing_archive, now=None,
                         retention_days=90, max_matches=1000):
    """Keep completed fixtures across scheduled feed snapshots, deduplicated by match ID."""
    now = now or datetime.now(timezone.utc)
    cutoff = int((now - timedelta(days=retention_days)).timestamp())
    merged = {}

    def add(item):
        if not isinstance(item, dict) or not is_completed_fixture(item):
            return
        match_id = str(item.get("match_id") or item.get("id") or item.get("matchId") or "").strip()
        if not match_id:
            return
        try:
            started = int(item.get("timestamp_start") or 0)
        except (TypeError, ValueError):
            started = 0
        if started and started < cutoff:
            return
        old = merged.get(match_id, {})
        combined = {**old, **item, "match_id": match_id}
        for nested in ("teama", "teamb", "venue", "competition", "provider_metadata"):
            if isinstance(old.get(nested), dict) and isinstance(item.get(nested), dict):
                combined[nested] = {**old[nested], **item[nested]}
        merged[match_id] = combined

    archive_items = existing_archive.get("matches", []) if isinstance(existing_archive, dict) else []
    for item in archive_items if isinstance(archive_items, list) else []:
        add(item)
    for item in previous_items or []:
        add(item)
    for item in current_items or []:
        add(item)

    ordered = sorted(merged.values(),
                     key=lambda item: int(item.get("timestamp_start") or 0),
                     reverse=True)[:max_matches]
    return {
        "updated_at": now.astimezone(timezone.utc).isoformat(),
        "retention_days": retention_days,
        "matches": ordered,
    }
