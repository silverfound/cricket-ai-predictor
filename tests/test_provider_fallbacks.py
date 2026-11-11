import unittest

from scripts.provider_fallbacks import normalize_cricketdata, normalize_highlightly


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
        self.assertNotIn("score", fixture)
        self.assertNotIn("live", fixture)
        self.assertGreater(fixture["timestamp_start"], 0)

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
                "state": "upcoming",
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
        self.assertNotIn("score", fixture)

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


    def test_error_or_empty_provider_payload_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize_cricketdata({"status": "failure", "data": []})
        with self.assertRaises(ValueError):
            normalize_highlightly({"data": []})


if __name__ == "__main__":
    unittest.main()
