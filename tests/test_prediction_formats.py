import unittest

from scripts.prediction_formats import match_type, is_t10_format, elo_win_probability


class PredictionFormatTests(unittest.TestCase):
    def test_t10_variants_stay_separate_from_t20(self):
        for label in ("T10", "Abu Dhabi T10", "10 over", "Ten-over league"):
            with self.subTest(label=label):
                self.assertEqual(match_type(label), "T10")
                self.assertTrue(is_t10_format(label))

    def test_existing_formats_keep_their_routes(self):
        self.assertEqual(match_type("T20"), "T20")
        self.assertEqual(match_type("T20 International"), "T20")
        self.assertEqual(match_type("ODI"), "ODI")
        self.assertEqual(match_type("One Day International"), "ODI")
        self.assertEqual(match_type("Test Match"), "Test")
        self.assertFalse(is_t10_format("T20"))

    def test_elo_probability_is_bounded_and_complementary(self):
        p = elo_win_probability(1600, 1500)
        self.assertGreater(p, 0.5)
        self.assertLess(p, 1.0)
        self.assertAlmostEqual(p + elo_win_probability(1500, 1600), 1.0)
        self.assertEqual(elo_win_probability(1500, 1500), 0.5)


if __name__ == "__main__":
    unittest.main()
