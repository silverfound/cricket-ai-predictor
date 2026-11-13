import unittest

from scripts.chronological_elo_backtest import chronological_backtest


class ChronologicalEloBacktestTests(unittest.TestCase):
    def test_same_day_results_do_not_change_same_day_predictions(self):
        matches = [
            {"date": "2025-01-01", "teams": ["A", "B"], "winner": "A", "gender": "male", "match_type": "T20"},
            {"date": "2025-01-01", "teams": ["A", "C"], "winner": "C", "gender": "male", "match_type": "T20"},
            {"date": "2025-01-02", "teams": ["A", "B"], "winner": "A", "gender": "male", "match_type": "T20"},
        ]
        first = chronological_backtest(matches)
        reordered = chronological_backtest([matches[1], matches[0], matches[2]])
        self.assertEqual(first["eligible_matches"], 3)
        self.assertEqual(first["overall"], reordered["overall"])

    def test_separates_gender_and_format_ratings(self):
        matches = [
            {"date": "2025-01-01", "teams": ["A", "B"], "winner": "A", "gender": "male", "match_type": "T20"},
            {"date": "2025-01-02", "teams": ["A", "B"], "winner": "B", "gender": "female", "match_type": "T20"},
            {"date": "2025-01-03", "teams": ["A", "B"], "winner": "B", "gender": "male", "match_type": "ODI"},
        ]
        report = chronological_backtest(matches)
        self.assertEqual(report["by_format"]["T20"]["matches"], 2)
        self.assertEqual(report["by_format"]["ODI"]["matches"], 1)

    def test_skips_no_result_and_unsupported_t10(self):
        matches = [
            {"date": "2025-01-01", "teams": ["A", "B"], "winner": None, "match_type": "T20"},
            {"date": "2025-01-02", "teams": ["A", "B"], "winner": "A", "match_type": "T10"},
        ]
        report = chronological_backtest(matches)
        self.assertEqual(report["eligible_matches"], 0)
        self.assertEqual(report["skipped_rows"], 2)

    def test_provider_aliases_share_one_team_identity(self):
        matches = [
            {"date": "2025-01-01", "teams": ["Sudur Paschim Royals", "Kathmandu Gurkhas"], "winner": "S Paschim", "gender": "male", "match_type": "T20"},
            {"date": "2025-01-02", "teams": ["S Paschim", "Kathmandu Gurkhas"], "winner": "Kathmandu Gurkhas", "gender": "male", "match_type": "T20"},
        ]
        report = chronological_backtest(matches)
        self.assertEqual(report["eligible_matches"], 2)
        self.assertEqual(report["skipped_rows"], 0)

    def test_canonical_duplicate_team_names_are_rejected(self):
        matches = [
            {"date": "2025-01-01", "teams": ["Sudurpaschim Royals", "Sudur Paschim Royals"], "winner": "Sudur Paschim Royals", "gender": "male", "match_type": "T20"},
        ]
        report = chronological_backtest(matches)
        self.assertEqual(report["eligible_matches"], 0)
        self.assertEqual(report["skipped_rows"], 1)


if __name__ == "__main__":
    unittest.main()
