import unittest

from scripts.prediction_formats import (
    binary_class_probabilities,
    elo_win_probability,
    is_t10_format,
    match_type,
)


class PredictionFormatTests(unittest.TestCase):
    def test_t10_variants_stay_separate_from_t20(self):
        for label in ("T10", "Abu Dhabi T10", "10 over", "Ten-over league"):
            with self.subTest(label=label):
                self.assertEqual(match_type(label), "T10")
                self.assertTrue(is_t10_format(label))

    def test_explicit_formats_keep_their_routes(self):
        cases = {
            "T20": "T20",
            "T20 International": "T20",
            "Twenty20 league": "T20",
            "ODI": "ODI",
            "One Day International": "ODI",
            "50-over match": "ODI",
            "Test Match": "Test",
            "First-Class": "Test",
            "Multi-day match": "Test",
        }
        for label, expected in cases.items():
            with self.subTest(label=label):
                self.assertEqual(match_type(label), expected)
        self.assertFalse(is_t10_format("T20"))

    def test_unknown_or_missing_format_never_defaults_to_t20(self):
        for label in (None, "", "club championship", "unknown"):
            with self.subTest(label=label):
                self.assertEqual(match_type(label), "Unknown")

    def test_elo_probability_is_bounded_and_complementary(self):
        p = elo_win_probability(1600, 1500)
        self.assertGreater(p, 0.5)
        self.assertLess(p, 1.0)
        self.assertAlmostEqual(p + elo_win_probability(1500, 1600), 1.0)
        self.assertEqual(elo_win_probability(1500, 1500), 0.5)

    def test_binary_probabilities_follow_class_labels_not_column_order(self):
        class FakeModel:
            classes_ = [1, 0]

            def predict_proba(self, _features):
                return [[0.73, 0.27]]

        p1, p0 = binary_class_probabilities(FakeModel(), object())
        self.assertAlmostEqual(p1, 0.73)
        self.assertAlmostEqual(p0, 0.27)
        self.assertAlmostEqual(p1 + p0, 1.0)

    def test_binary_probabilities_reject_non_binary_models(self):
        class FakeModel:
            classes_ = [0, 2]

            def predict_proba(self, _features):
                return [[0.5, 0.5]]

        with self.assertRaises(ValueError):
            binary_class_probabilities(FakeModel(), object())


if __name__ == "__main__":
    unittest.main()
