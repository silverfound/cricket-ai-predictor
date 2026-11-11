#!/usr/bin/env python3
"""Read-only audit of the free TigZig/Cricsheet ball-by-ball database."""
from __future__ import annotations

import requests

URL = "https://db-mcp.tigzig.com/v1/query/duckdb"
TIMEOUT = 30
SQL = """
SELECT
  match_type,
  gender,
  team_type,
  COUNT(*) AS deliveries,
  COUNT(DISTINCT match_id) AS matches
FROM ball_by_ball
WHERE start_date >= '2024-01-01'
  AND start_date < '2027-01-01'
GROUP BY match_type, gender, team_type
ORDER BY match_type, gender, team_type
LIMIT 50
"""


def main() -> int:
    try:
        response = requests.post(
            URL, json={"sql": SQL, "format": "json"}, timeout=TIMEOUT
        )
    except requests.RequestException as exc:
        print(f"TIGZIG_REQUEST_ERROR={type(exc).__name__}")
        return 0

    print(f"TIGZIG_HTTP={response.status_code}")
    if response.status_code != 200:
        print("TIGZIG_STATUS=UNAVAILABLE")
        try:
            payload = response.json()
            if isinstance(payload, dict):
                print("TIGZIG_ERROR=" + str(payload.get("detail") or payload.get("error") or "no safe error field"))
        except ValueError:
            pass
        return 0

    try:
        payload = response.json()
    except ValueError:
        print("TIGZIG_STATUS=NON_JSON")
        return 0

    columns = payload.get("columns") if isinstance(payload, dict) else None
    rows = payload.get("rows") if isinstance(payload, dict) else None
    if not isinstance(columns, list) or not isinstance(rows, list):
        print("TIGZIG_STATUS=UNKNOWN_RESPONSE_SCHEMA")
        if isinstance(payload, dict):
            print("TIGZIG_ROOT_KEYS=" + ",".join(sorted(payload.keys())[:30]))
        return 0

    print("TIGZIG_COLUMNS=" + ",".join(str(c) for c in columns))
    print(f"TIGZIG_RESULT_ROWS={len(rows)}")
    print(f"TIGZIG_TRUNCATED={bool(payload.get('truncated'))}")
    indices = {str(name): index for index, name in enumerate(columns)}
    required = {"match_type", "gender", "team_type", "deliveries", "matches"}
    if not required.issubset(indices):
        print("TIGZIG_STATUS=REQUIRED_COLUMNS_MISSING")
        return 0

    formats = set()
    total_deliveries = 0
    total_matches_by_group = 0
    for row in rows:
        record = {name: row[index] for name, index in indices.items()}
        fmt = str(record["match_type"])
        formats.add(fmt)
        total_deliveries += int(record["deliveries"] or 0)
        total_matches_by_group += int(record["matches"] or 0)
        print(
            "TIGZIG_GROUP="
            f"format:{fmt},gender:{record['gender']},team_type:{record['team_type']},"
            f"deliveries:{record['deliveries']},matches:{record['matches']}"
        )

    print("TIGZIG_FORMATS=" + ",".join(sorted(formats)))
    print(f"TIGZIG_DELIVERIES_2024_2026={total_deliveries}")
    print(f"TIGZIG_MATCH_GROUP_COUNTS_SUM={total_matches_by_group}")
    print("TIGZIG_T10_COVERAGE=" + ("PRESENT" if "T10" in formats else "NOT_IN_THIS_DATASET"))
    print("TIGZIG_AUDIT=READ_ONLY_COMPLETE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
