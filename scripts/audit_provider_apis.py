#!/usr/bin/env python3
"""One-shot, read-only diagnostics for configured cricket fixture API credentials.

This script never prints credentials or full API payloads and never writes the
production match snapshot. It is intended for manual GitHub Actions runs only.
"""
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import requests

TIMEOUT = 20


def inspect_payload(label, response, expected_key=None, list_keys=()):
    print(f"{label}: HTTP {response.status_code}")
    if response.status_code != 200:
        # Avoid printing response bodies: providers sometimes echo request data.
        return False
    try:
        payload = response.json()
    except ValueError:
        print(f"{label}: response is not JSON")
        return False

    if isinstance(payload, dict):
        print(f"{label}: top-level keys={sorted(payload.keys())[:30]}")
        records = None
        for key in list_keys:
            value = payload.get(key)
            if isinstance(value, list):
                records = value
                print(f"{label}: {key}_count={len(value)}")
                if value and isinstance(value[0], dict):
                    print(f"{label}: first_record_keys={sorted(value[0].keys())[:40]}")
                break
        if expected_key and expected_key not in payload:
            print(f"{label}: expected_key_missing={expected_key}")
            return False
        if list_keys and records is None:
            print(f"{label}: no expected list field found ({', '.join(list_keys)})")
            return False
        return True

    if isinstance(payload, list):
        print(f"{label}: record_count={len(payload)}")
        if payload and isinstance(payload[0], dict):
            print(f"{label}: first_record_keys={sorted(payload[0].keys())[:40]}")
        return True

    print(f"{label}: unexpected JSON type={type(payload).__name__}")
    return False


def main():
    results = []

    # Highlightly (RapidAPI product): one Saudi-local date request.
    key = os.getenv("SECONDARY_API_KEY")
    if key:
        today = datetime.now(ZoneInfo("Asia/Riyadh")).date().isoformat()
        try:
            response = requests.get(
                "https://cricket-highlights-api.p.rapidapi.com/matches",
                headers={
                    "x-rapidapi-key": key,
                    "x-rapidapi-host": "cricket-highlights-api.p.rapidapi.com",
                },
                params={"date": today, "timezone": "Asia/Riyadh", "limit": 100, "offset": 0},
                timeout=TIMEOUT,
            )
            results.append(inspect_payload("Highlightly", response, "data", ("data",)))
        except requests.RequestException as exc:
            print(f"Highlightly: request_error={type(exc).__name__}")
            results.append(False)
    else:
        print("Highlightly: SECRET_MISSING (SECONDARY_API_KEY)")
        results.append(False)

    # CricketData: one current-matches request. Never log its URL/query string.
    key = os.getenv("CRICKETDATA_API_KEY")
    if key:
        try:
            response = requests.get(
                "https://api.cricapi.com/v1/currentMatches",
                params={"apikey": key, "offset": 0},
                timeout=TIMEOUT,
            )
            ok = inspect_payload("CricketData", response, "data", ("data",))
            if ok:
                try:
                    payload = response.json()
                    if payload.get("status") not in ("success", None):
                        print("CricketData: provider_status_not_success")
                        ok = False
                except (ValueError, AttributeError):
                    ok = False
            results.append(ok)
        except requests.RequestException as exc:
            print(f"CricketData: request_error={type(exc).__name__}")
            results.append(False)
    else:
        print("CricketData: SECRET_MISSING (CRICKETDATA_API_KEY)")
        results.append(False)

    # Matchstat is a separate RapidAPI host/product; probe only its known
    # live endpoint and report its response shape without publishing anything.
    key = os.getenv("RAPIDAPI_KEY")
    if key:
        host = "cricket-api-data-live-scores-stats-odds-predictions.p.rapidapi.com"
        try:
            response = requests.get(
                f"https://{host}/v1/live",
                headers={"x-rapidapi-key": key, "x-rapidapi-host": host},
                timeout=TIMEOUT,
            )
            results.append(inspect_payload("Matchstat", response, list_keys=("results", "data", "events")))
        except requests.RequestException as exc:
            print(f"Matchstat: request_error={type(exc).__name__}")
            results.append(False)
    else:
        print("Matchstat: SECRET_MISSING (RAPIDAPI_KEY)")
        results.append(False)

    passed = sum(bool(value) for value in results)
    print(f"PROVIDER_AUDIT_SUMMARY: {passed}/{len(results)} providers returned usable responses")
    # Diagnostics remain informational: one provider being unavailable must
    # not block the existing production feed or deployment pipeline.


if __passed__ if False else False:
    pass

if __name__ == "__main__":
    main()
