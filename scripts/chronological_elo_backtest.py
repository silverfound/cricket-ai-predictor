#!/usr/bin/env python3
"""Leakage-safe chronological Elo backtest on the repository match summaries.

This is an Elo baseline evaluation, not a replay of the CatBoost/LightGBM
ensemble: historical summaries do not contain the toss winner/decision inputs
required by that ensemble. Ratings are updated only after all matches on a
calendar date have been predicted.
"""
import json
import math
from collections import defaultdict
from datetime import date
from pathlib import Path

from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
HISTORY_PATH = ROOT / "data" / "cricsheet_match_history_2024_2026.json"
SUPPORTED = {"T20", "ODI", "Test"}
DEFAULT_RATING = 1500.0
K_FACTOR = 24.0
EPSILON = 1e-6


def _valid_match(row):
    if not isinstance(row, dict):
        return None
    teams = row.get("teams")
    winner = row.get("winner")
    match_date = str(row.get("date") or "")
    if not isinstance(teams, list) or len(teams) != 2:
        return None
    t1, t2 = (str(x or "").strip() for x in teams)
    winner = str(winner or "").strip()
    if not t1 or not t2 or t1.casefold() == t2.casefold():
        return None
    if winner.casefold() not in {t1.casefold(), t2.casefold()}:
        return None
    try:
        date.fromisoformat(match_date)
    except ValueError:
        return None
    fmt = str(row.get("match_type") or "").strip()
    fmt_upper = fmt.upper()
    if fmt_upper in {"IT20"}:
        fmt = "T20"
    elif fmt_upper in {"ODM"}:
        fmt = "ODI"
    elif fmt_upper in {"MDM"}:
        fmt = "Test"
    elif fmt_upper in {"T20", "ODI", "TEST"}:
        fmt = "Test" if fmt_upper == "TEST" else fmt_upper
    else:
        return None
    gender = str(row.get("gender") or "male").casefold()
    return {
        "date": match_date, "teams": (t1, t2), "winner": winner,
        "format": fmt, "gender": gender,
    }


def _probability(r1, r2):
    delta = max(-1600.0, min(1600.0, r2 - r1))
    return 1.0 / (1.0 + 10.0 ** (delta / 400.0))


def _metrics(rows):
    if not rows:
        return {"matches": 0, "accuracy": None, "log_loss": None,
                "brier_score": None, "roc_auc": None}
    y = [r["actual"] for r in rows]
    p = [min(1.0 - EPSILON, max(EPSILON, r["p1"])) for r in rows]
    result = {
        "matches": len(rows),
        "accuracy": round(float(accuracy_score(y, [int(x >= 0.5) for x in p])), 4),
        "log_loss": round(float(log_loss(y, p, labels=[0, 1])), 4),
        "brier_score": round(float(brier_score_loss(y, p)), 4),
        "roc_auc": round(float(roc_auc_score(y, p)), 4) if len(set(y)) == 2 else None,
    }
    return result


def chronological_backtest(history, k_factor=K_FACTOR):
    """Evaluate all eligible completed matches with date-batched Elo updates."""
    by_date = defaultdict(list)
    skipped = 0
    for raw in history:
        row = _valid_match(raw)
        if row is None:
            skipped += 1
            continue
        by_date[row["date"]].append(row)

    ratings = defaultdict(lambda: DEFAULT_RATING)
    predictions = []
    format_predictions = defaultdict(list)

    for match_date in sorted(by_date):
        daily = by_date[match_date]
        daily_deltas = defaultdict(float)
        for match in daily:
            t1, t2 = match["teams"]
            scope = (match["gender"], match["format"])
            key1, key2 = (*scope, t1.casefold()), (*scope, t2.casefold())
            p1 = _probability(ratings[key1], ratings[key2])
            actual = int(match["winner"].casefold() == t1.casefold())
            record = {"actual": actual, "p1": p1}
            predictions.append(record)
            format_predictions[match["format"]].append(record)
            expected2 = 1.0 - p1
            actual2 = 1.0 - actual
            daily_deltas[key1] += k_factor * (actual - p1)
            daily_deltas[key2] += k_factor * (actual2 - expected2)
        # No match on the same date can leak its result into another prediction.
        # Aggregate all same-day updates before changing any team rating.
        for key, delta in daily_deltas.items():
            ratings[key] += delta

    return {
        "method": "date-batched expanding Elo; 1500 initial rating; K=24; separate gender/format pools",
        "overall": _metrics(predictions),
        "by_format": {fmt: _metrics(items) for fmt, items in sorted(format_predictions.items())},
        "eligible_matches": len(predictions),
        "skipped_rows": skipped,
        "last_match_date": max(by_date) if by_date else None,
    }


def main():
    if not HISTORY_PATH.exists():
        raise SystemExit(f"Missing historical data: {HISTORY_PATH}")
    history = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    if not isinstance(history, list) or not history:
        raise SystemExit("Historical data must be a non-empty JSON list")
    report = chronological_backtest(history)
    print("CHRONOLOGICAL_ELO_BACKTEST=" + json.dumps(report, sort_keys=True))
    if report["eligible_matches"] < 100:
        raise SystemExit("Insufficient eligible historical matches for a meaningful baseline")


if __name__ == "__main__":
    main()
