import unittest
from datetime import datetime, timezone
from unittest.mock import Mock

from scripts.enrich_match_context import (
    build_match_context,
    load_verified_grounds,
    resolve_ground,
)


class MatchContextTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 23, 12, 0, tzinfo=timezone.utc)
        self.grounds = load_verified_grounds({
            "grounds": [{
                "id": "test-ground", "name": "Example Oval", "aliases": ["EXO"],
                "latitude": -25.0, "longitude": 135.0, "timezone": "Australia/Darwin",
                "verification_status": "verified",
            }, {
                "id": "unverified", "name": "Unverified Ground", "latitude": 1,
                "longitude": 2, "timezone": "UTC", "verification_status": "needs_review",
            }]
        })

    def test_only_verified_grounds_are_indexed(self):
        self.assertIsNotNone(resolve_ground("EXO", self.grounds))
        self.assertIsNone(resolve_ground("Unverified Ground", self.grounds))

    def test_weather_is_attached_without_changing_prediction_fields(self):
        match_time = int(datetime(2026, 11, 24, 9, 0, tzinfo=timezone.utc).timestamp())
        hourly = {
            "time": ["2026-11-24T18:00", "2026-11-24T19:00"],
            "temperature_2m": [30, 31],
            "relative_humidity_2m": [40, 42],
            "precipitation_probability": [10, 20],
            "precipitation": [0, 0],
            "wind_speed_10m": [12, 14],
            "cloud_cover": [5, 10],
        }
        fetcher = Mock(return_value=hourly)
        fixture = {
            "match_id": "m1", "timestamp_start": match_time,
            "venue": {"name": "Example Oval"}, "ai_prediction": {"team1": 0.6},
        }
        context = build_match_context([fixture], self.grounds, {"venues": {}}, self.now, fetcher)
        self.assertEqual(context["items"][0]["weather"]["status"], "available")
        self.assertEqual(context["items"][0]["weather"]["data"]["temperature_2m"], 30)
        self.assertEqual(fixture["ai_prediction"], {"team1": 0.6})
        fetcher.assert_called_once()

    def test_unknown_context_is_not_fabricated(self):
        fixture = {"match_id": "m2", "venue": {"name": "Unknown Ground"}}
        context = build_match_context([fixture], self.grounds, {"venues": {}}, self.now, Mock())
        item = context["items"][0]
        self.assertEqual(item["weather"]["status"], "unavailable")
        self.assertEqual(item["playing_xi"]["status"], "unavailable")
        self.assertEqual(item["pitch"]["status"], "unavailable")
        self.assertEqual(item["player_availability"]["status"], "unavailable")

    def test_provider_supplied_context_is_preserved(self):
        fixture = {
            "match_id": "m3", "venue": {"name": "Unknown Ground"},
            "playing_xi": [{"name": "Player A"}],
            "pitch_report": {"type": "dry"},
            "player_availability": {"out": ["Player B"]},
            "context_provider_source": "Example provider",
        }
        context = build_match_context([fixture], self.grounds, {"venues": {}}, self.now, Mock())
        item = context["items"][0]
        self.assertEqual(item["playing_xi"]["status"], "provider_supplied")
        self.assertEqual(item["pitch"]["status"], "provider_supplied")
        self.assertEqual(item["player_availability"]["status"], "provider_supplied")

    def test_weather_cache_prevents_repeat_provider_calls(self):
        match_time = int(datetime(2026, 11, 24, 9, 0, tzinfo=timezone.utc).timestamp())
        hourly = {"time": ["2026-11-24T18:00"], "temperature_2m": [30]}
        cache = {"venues": {"test-ground": {"fetched_at": self.now.isoformat(), "hourly": hourly}}}
        fetcher = Mock()
        context = build_match_context(
            [{"match_id": "m4", "timestamp_start": match_time, "venue": "Example Oval"}],
            self.grounds, cache, self.now, fetcher
        )
        self.assertEqual(context["items"][0]["weather"]["status"], "available")
        fetcher.assert_not_called()


if __name__ == "__main__":
    unittest.main()
