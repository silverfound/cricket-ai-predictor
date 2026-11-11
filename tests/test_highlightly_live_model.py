import unittest

from scripts.highlightly_live_model import build_live_prediction


def model_bundle():
    phases = {}
    for phase in ("early", "middle", "late"):
        phases[phase] = {
            "features": [
                "is_women", "innings", "runs_scored", "wickets_lost",
                "legal_balls", "scheduled_balls", "balls_remaining",
                "wickets_left", "current_run_rate", "required_run_rate",
                "runs_needed", "target_runs",
            ],
            "mean": [0.0] * 12,
            "scale": [1.0] * 12,
            "coefficients": [0.0] * 12,
            "intercept": 0.0,
            "calibration": {"x": [0.0, 1.0], "y": [0.0, 1.0]},
        }
    return {"models": {"T20": phases, "ODI": phases}}


def detail(fmt="T20", status="In play", home_score="35/1",
           home_info="5.2/20 ov", away_score="-", away_info=None,
           batting_team="Home XI", innings=1):
    return {
        "format": fmt,
        "homeTeam": {"name": "Home XI"},
        "awayTeam": {"name": "Away XI"},
        "state": {
            "description": status,
            "teams": {
                "home": {"score": home_score, "info": home_info},
                "away": {"score": away_score, "info": away_info},
            },
        },
        "inplayData": {
            "batsmen": [{
                "team": {"name": batting_team},
                "player": {"inning": innings},
                "statistics": {"runs": 10, "balls": 8},
            }]
        },
    }


class HighlightlyLiveModelTests(unittest.TestCase):
    def test_first_innings_t20_uses_legal_balls(self):
        result = build_live_prediction(detail(), model_bundle())
        self.assertTrue(result["available"])
        self.assertEqual(result["format"], "T20")
        self.assertEqual(result["innings"], 1)
        self.assertEqual(result["score"], "35/1")
        self.assertEqual(result["overs"], "5.2/20")
        self.assertEqual(result["balls_remaining"], 88)
        self.assertEqual(result["probabilities"], {"Home XI": 50.0, "Away XI": 50.0})

    def test_second_innings_requires_and_uses_explicit_target(self):
        sample = detail(
            home_score="137/8", home_info="20/20 ov",
            away_score="110/4", away_info="17.2/20 ov, T:138",
            batting_team="Away XI", innings=2,
        )
        result = build_live_prediction(sample, model_bundle())
        self.assertEqual(result["innings"], 2)
        self.assertEqual(result["target_runs"], 138)
        self.assertEqual(result["runs_needed"], 28)
        self.assertEqual(result["balls_remaining"], 16)
        self.assertAlmostEqual(result["probabilities"]["Away XI"], 50.0)

    def test_second_innings_without_target_fails_closed(self):
        sample = detail(
            home_score="137/8", home_info="20/20 ov",
            away_score="110/4", away_info="17.2/20 ov",
            batting_team="Away XI", innings=2,
        )
        with self.assertRaisesRegex(ValueError, "target is absent"):
            build_live_prediction(sample, model_bundle())

    def test_t10_never_uses_t20_model(self):
        with self.assertRaisesRegex(ValueError, "Unsupported live format"):
            build_live_prediction(detail(fmt="T10"), model_bundle())

    def test_women_indicator_is_preserved(self):
        sample = detail()
        sample["homeTeam"]["name"] = "Home XI Women"
        sample["awayTeam"]["name"] = "Away XI Women"
        sample["inplayData"]["batsmen"][0]["team"]["name"] = "Home XI Women"
        result = build_live_prediction(sample, model_bundle())
        self.assertEqual(result["probabilities"]["Home XI Women"], 50.0)

    def test_conflicting_or_invalid_wickets_fails_closed(self):
        sample = detail(home_score="35/11")
        with self.assertRaisesRegex(ValueError, "score is missing or invalid"):
            build_live_prediction(sample, model_bundle())


if __name__ == "__main__":
    unittest.main()
