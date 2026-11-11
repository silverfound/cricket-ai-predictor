import unittest

from scripts.audit_sportscore_live import (
    find_event_arrays,
    fixture_slug,
    is_t10,
    unwrap_matches,
)


class SportScoreLiveAuditTests(unittest.TestCase):
    def test_extracts_slug_from_documented_match_page_url(self):
        fixture = {"url": "/cricket/match/delhi-bulls-vs-royal-champs/"}
        self.assertEqual(fixture_slug(fixture), "delhi-bulls-vs-royal-champs")

    def test_prefers_provider_slug_when_present(self):
        fixture = {
            "slug": "provider-slug",
            "url": "/cricket/match/page-slug/",
        }
        self.assertEqual(fixture_slug(fixture), "provider-slug")

    def test_rejects_external_fixture_url(self):
        fixture = {"url": "https://example.com/cricket/match/not-ours/"}
        self.assertEqual(fixture_slug(fixture), "")

    def test_identifies_t10_without_misclassifying_t20(self):
        self.assertTrue(is_t10({"competition": "Abu Dhabi T10 League"}))
        self.assertFalse(is_t10({"format": "T20"}))

    def test_unwraps_documented_matches_envelope(self):
        rows = [{"home": "A", "away": "B"}]
        self.assertEqual(unwrap_matches({"matches": rows}), rows)

    def test_delivery_array_requires_delivery_like_record_fields(self):
        payload = {
            "match": {
                "balls": [{"over": 1, "ball": 2, "batter": "A", "bowler": "B"}],
                "timeline": [{"text": "Match started"}],
            }
        }
        candidates = find_event_arrays(payload)
        delivery_candidates = [item for item in candidates if item["delivery_like"]]
        self.assertEqual(len(delivery_candidates), 1)
        self.assertEqual(delivery_candidates[0]["path"], "$.match.balls")


if __name__ == "__main__":
    unittest.main()
