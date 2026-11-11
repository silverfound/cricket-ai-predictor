#!/usr/bin/env python3
"""Enrich only currently-live fixture snapshots with Highlightly live-model outputs."""
from __future__ import annotations

import json
import os
from pathlib import Path

try:
    from scripts.highlightly_live_model import enrich_live_predictions
except ModuleNotFoundError as exc:
    if exc.name != "scripts":
        raise
    from highlightly_live_model import enrich_live_predictions

SNAPSHOT = Path("data/matches.json")


def main() -> int:
    if not SNAPSHOT.is_file():
        raise SystemExit("Live enrichment requires data/matches.json")
    payload = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    response = payload.get("response") or {}
    fixtures = response.get("items")
    if not isinstance(fixtures, list):
        raise SystemExit("Match snapshot has no response.items array")
    provider = str(payload.get("provider") or response.get("provider") or "")
    summary = enrich_live_predictions(fixtures, provider)
    payload["live_model"] = {
        "provider": "Highlightly RapidAPI",
        "attempted": summary["attempted"],
        "predicted": summary["predicted"],
        "model_file": "data/live_winprob_browser.json",
        "production_mode": "scheduled_snapshot",
        "refresh_minutes": 30,
    }
    temporary = SNAPSHOT.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    os.replace(temporary, SNAPSHOT)
    print(
        "LIVE_WINPROB_SNAPSHOT_ENRICHED="
        f"{summary['predicted']}/{summary['attempted']} detail requests"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
