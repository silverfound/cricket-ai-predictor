import unittest

from scripts.provider_fallbacks import normalize_cricketdata, normalize_highlightly, should_fetch_match_info_enrichment, merge_fixture_coverage, is_indian_domestic_fixture


class ProviderFallbackAdapterTests(unittest.TestCase):
    def test_cricketdata_normalizes_fixture_without_fabricating_score(self):
        payload = {
            "status": "success",
            "data": [{
                "id": "cd-1",
                "name": "Uganda Women vs Rwanda Women",
                "matchType": "t20",
                "status": "Uganda Women need 90 runs",
                "venue": "Entebbe Cricket Oval",
                "dateTimeGMT": "2026-11-11T10:30:00",
                "teams": ["Uganda Women", "Rwanda Women"],
                "score": None,
                "matchStarted": True,
                "matchEnded": False,
            }],
        }
        [fixture] = normalize_cricketdata(payload)
        self.assertEqual(fixture["teama"]["name"], "Uganda Women")
        self.assertEqual(fixture["teamb"]["name"], "Rwanda Women")
        self.assertEqual(fixture["format_str"], "T20")
        self.assertEqual(fixture["provider_source"], "CricketData")
        self.assertTrue(fixture["match_started"])
        self.assertFalse(fixture["match_ended"])
        self.assertNotIn("score", fixture)
        self.assertNotIn("live", fixture)
        self.assertGreater(fixture["timestamp_start"], 0)

    def test_cricketdata_match_ended_flag_is_normalized(self):
        payload = {
            "status": "success",
            "data": [{
                "id": "cd-ended", "matchType": "t10",
                "teams": ["Royal Desert Champions", "Yas Lions"],
                "status": "Live", "matchStarted": True, "matchEnded": True,
                "dateTimeGMT": "2026-11-13T13:45:00Z",
            }],
        }
        [fixture] = normalize_cricketdata(payload)
        self.assertTrue(fixture["match_started"])
        self.assertTrue(fixture["match_ended"])
        self.assertEqual(fixture["format_str"], "T10")

    def test_highlightly_start_time_is_parsed_in_requested_riyadh_timezone(self):
        from datetime import datetime, timezone
        payload = {"data": [{
            "id": "hl-riyadh-time", "homeTeam": {"name": "Royal Desert Champions"},
            "awayTeam": {"name": "Yas Lions"}, "format": "T10",
            "startDate": "2026-11-13", "startTime": "16:45",
            "state": {"description": "Scheduled"},
        }]}
        [fixture] = normalize_highlightly(payload)
        expected = int(datetime(2026, 11, 13, 13, 45, tzinfo=timezone.utc).timestamp())
        self.assertEqual(fixture["timestamp_start"], expected)

    def test_cricketdata_t10_is_not_misclassified_as_t20(self):
        payload = {
            "status": "success",
            "data": [{
                "id": "cd-t10", "matchType": "t10",
                "teams": ["Desert XI", "Bulls XI"], "date": "2026-11-11",
            }],
        }
        [fixture] = normalize_cricketdata(payload)
        self.assertEqual(fixture["format_str"], "T10")

    def test_unknown_format_is_not_defaulted(self):
        payload = {
            "status": "success",
            "data": [{"id": "cd-u", "matchType": None,
                      "teams": ["Team A", "Team B"]}],
        }
        [fixture] = normalize_cricketdata(payload)
        self.assertEqual(fixture["format_str"], "Unknown")

    def test_highlightly_normalizes_team_objects_and_metadata(self):
        payload = {
            "data": [{
                "id": "hl-1",
                "homeTeam": {"name": "Melbourne Stars Women"},
                "awayTeam": {"name": "Sydney Sixers Women"},
                "format": "T20",
                "state": {"description": "Scheduled", "report": "Match yet to begin"},
                "venue": {"name": "MCG"},
                "startDate": "2026-11-12",
                "league": {"name": "WBBL"},
            }],
            "pagination": {},
        }
        [fixture] = normalize_highlightly(payload)
        self.assertEqual(fixture["teama"]["name"], "Melbourne Stars Women")
        self.assertEqual(fixture["teamb"]["name"], "Sydney Sixers Women")
        self.assertEqual(fixture["venue"]["name"], "MCG")
        self.assertEqual(fixture["provider_source"], "Highlightly")
        self.assertEqual(fixture["status_str"], "Scheduled")
        self.assertEqual(fixture["status_note"], "Match yet to begin")
        self.assertNotIn("score", fixture)

    def test_highlightly_preserves_venue_location_timezone_and_coordinates(self):
        payload = {
            "data": [{
                "id": "hl-venue",
                "homeTeam": {"name": "New Zealand"},
                "awayTeam": {"name": "India"},
                "format": "ODI",
                "venue": {
                    "name": "Bay Oval",
                    "location": "Mount Maunganui",
                    "country": "New Zealand",
                    "latitude": -37.6528,
                    "longitude": 176.1907,
                    "timezone": "Pacific/Auckland",
                },
                "startDate": "2026-11-13",
            }],
        }
        [fixture] = normalize_highlightly(payload)
        self.assertEqual(fixture["venue"]["name"], "Bay Oval")
        self.assertEqual(fixture["venue"]["location"], "Mount Maunganui")
        self.assertEqual(fixture["venue"]["country"], "New Zealand")
        self.assertEqual(fixture["venue"]["latitude"], -37.6528)
        self.assertEqual(fixture["venue"]["longitude"], 176.1907)
        self.assertEqual(fixture["venue"]["timezone"], "Pacific/Auckland")

    def test_cricketdata_preserves_score_team_info_and_actual_toss(self):
        payload = {
            "status": "success",
            "data": [{
                "id": "cd-details", "matchType": "t20",
                "teams": ["Team A", "Team B"],
                "score": [{"r": 145, "w": 4, "o": 17.2, "inning": "Team A Inning 1"}],
                "teamInfo": [{"name": "Team A"}, {"name": "Team B"}],
                "tossWinner": "Team B", "tossChoice": "bowl",
            }],
        }
        [fixture] = normalize_cricketdata(payload)
        self.assertEqual(fixture["score"][0]["r"], 145)
        self.assertEqual(fixture["team_info"][0]["name"], "Team A")
        self.assertEqual(fixture["toss_winner"], "Team B")
        self.assertEqual(fixture["toss_decision"], "field")


    def test_cricketdata_enrichment_runs_only_on_hourly_scheduled_slot(self):
        from datetime import datetime, timezone
        from scripts.provider_fallbacks import should_refresh_cricketdata_enrichment

        hourly_slot = datetime(2026, 11, 11, 12, 5, tzinfo=timezone.utc)
        last_minute_of_slot = datetime(2026, 11, 11, 12, 14, tzinfo=timezone.utc)
        quarter_hour_run = datetime(2026, 11, 11, 12, 15, tzinfo=timezone.utc)
        half_hour_run = datetime(2026, 11, 11, 12, 35, tzinfo=timezone.utc)
        self.assertTrue(should_refresh_cricketdata_enrichment(hourly_slot, "schedule"))
        self.assertTrue(should_refresh_cricketdata_enrichment(last_minute_of_slot, "schedule"))
        self.assertFalse(should_refresh_cricketdata_enrichment(quarter_hour_run, "schedule"))
        self.assertFalse(should_refresh_cricketdata_enrichment(half_hour_run, "schedule"))
        self.assertFalse(should_refresh_cricketdata_enrichment(hourly_slot, "workflow_dispatch"))
        self.assertFalse(should_refresh_cricketdata_enrichment(hourly_slot, "push"))

    def test_match_info_enrichment_is_skipped_for_emergency_cricketdata_feed(self):
        self.assertFalse(should_fetch_match_info_enrichment("CricketData", True))
        self.assertFalse(should_fetch_match_info_enrichment("CricketData", False))
        self.assertTrue(should_fetch_match_info_enrichment("Cricket Live Line Advance", True))
        self.assertFalse(should_fetch_match_info_enrichment("Cricket Live Line Advance", False))
        self.assertTrue(should_fetch_match_info_enrichment("Highlightly", True))

    def test_indian_domestic_competitions_are_filtered(self):
        fixtures = [
            {"league": {"name": "Ranji Trophy"}, "teama": {"name": "Mumbai"},
             "teamb": {"name": "Karnataka"}, "format_str": "Test"},
            {"league": {"name": "Syed Mushtaq Ali Trophy"}, "teama": {"name": "Delhi"},
             "teamb": {"name": "Punjab"}, "format_str": "T20"},
            {"venue": {"country": "India"}, "teama": {"name": "Maharashtra"},
             "teamb": {"name": "Baroda"}, "format_str": "T20"},
        ]
        self.assertTrue(all(is_indian_domestic_fixture(item) for item in fixtures))

    def test_indian_franchise_and_international_matches_are_retained(self):
        fixtures = [
            {"league": {"name": "Indian Premier League"}, "country": "India",
             "teama": {"name": "Mumbai Indians"}, "teamb": {"name": "Chennai Super Kings"}},
            {"league": {"name": "Women's Premier League"}, "country": "India",
             "teama": {"name": "Mumbai Indians Women"}, "teamb": {"name": "Delhi Capitals Women"}},
            {"country": "India", "teama": {"name": "India"}, "teamb": {"name": "Australia"}},
        ]
        self.assertTrue(all(not is_indian_domestic_fixture(item) for item in fixtures))

    def test_error_or_empty_provider_payload_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize_cricketdata({"status": "failure", "data": []})
        with self.assertRaises(ValueError):
            normalize_highlightly({"data": []})



    def test_coverage_merge_adds_missing_fixtures_and_skips_same_fixture_duplicate(self):
        primary = [{"match_id": "hl-1", "teama": {"name": "Brisbane Heat Women"},
                    "teamb": {"name": "Hobart Hurricanes Women"}, "format_str": "T20",
                    "timestamp_start": 1794654000}]
        supplemental = [
            {"match_id": "lla-duplicate", "teama": {"name": "Brisbane Heat Women"},
             "teamb": {"name": "Hobart Hurricanes Women"}, "format_str": "T20",
             "timestamp_start": 1794654300},
            {"match_id": "lla-missing", "teama": {"name": "Melbourne Stars Women"},
             "teamb": {"name": "Sydney Sixers Women"}, "format_str": "T20",
             "timestamp_start": 1794658000},
        ]
        added = merge_fixture_coverage(primary, supplemental)
        self.assertEqual(added, 1)
        self.assertEqual(len(primary), 2)
        self.assertEqual(primary[-1]["match_id"], "lla-missing")

    def test_coverage_merge_does_not_collapse_same_teams_on_distinct_dates(self):
        primary = [{"match_id": "hl-1", "teama": {"name": "Team A Women"},
                    "teamb": {"name": "Team B Women"}, "format_str": "T20",
                    "timestamp_start": 1794654000}]
        supplemental = [{"match_id": "lla-2", "teama": {"name": "Team A Women"},
                        "teamb": {"name": "Team B Women"}, "format_str": "T20",
                        "timestamp_start": 1794754000}]
        self.assertEqual(merge_fixture_coverage(primary, supplemental), 1)
        self.assertEqual(len(primary), 2)


if __name__ == "__main__":
    unittest.main()
