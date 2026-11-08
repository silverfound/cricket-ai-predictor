#!/usr/bin/env python3
"""Audit the repository's historical match summary for genuine T10 training rows."""
import json
from collections import Counter
from pathlib import Path

path = Path("data/cricsheet_match_history_2024_2026.json")
if not path.exists():
    raise SystemExit(f"Missing required history file: {path}")
rows = json.loads(path.read_text(encoding="utf-8"))
if not isinstance(rows, list):
    raise SystemExit("History must be a JSON list")

def norm(value):
    return str(value or "").strip().casefold().replace("_", " ").replace("-", " ")

types = Counter(str(row.get("match_type", "<missing>")) for row in rows if isinstance(row, dict))
t10 = []
for row in rows:
    if not isinstance(row, dict):
        continue
    fmt = norm(row.get("match_type"))
    if fmt in {"t10", "10 over", "ten over", "t 10"}:
        t10.append(row)

valid = [r for r in t10 if r.get("winner") and len(r.get("teams") or []) == 2 and r.get("date")]
print(f"HISTORY_ROWS={len(rows)}")
print("MATCH_TYPE_COUNTS=" + json.dumps(types, sort_keys=True))
print(f"T10_ROWS={len(t10)}")
print(f"T10_VALID_RESULT_ROWS={len(valid)}")
print("T10_SAMPLE=" + json.dumps(t10[:3], ensure_ascii=False))
# Training must not silently substitute T20 matches for missing T10 matches.
if len(valid) < 100:
    print("T10_TRAINING_STATUS=INSUFFICIENT_GENUINE_T10_ROWS")
else:
    print("T10_TRAINING_STATUS=DATA_AVAILABLE_FOR_MODEL_PIPELINE")
