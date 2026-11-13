import unittest
from datetime import datetime, timezone
from scripts.result_archive import is_completed_fixture, merge_recent_results


class RecentResultsArchiveTests(unittest.TestCase):
    def test_provider_end_flags_are_archived(self):
        self.assertTrue(is_completed_fixture({"matchEnded": True, "status": "Finished"}))

    def test_result_text_is_archived_without_end_flag(self):
        self.assertTrue(is_completed_fixture({"status_note": "Falcons won by 6 runs"}))

    def test_innings_completed_is_not_a_finished_match(self):
        self.assertFalse(is_completed_fixture({"status": "Innings completed"}))

    def test_archive_retains_old_finished_fixtures_and_merges_current(self):
        now = datetime(2026, 11, 13, tzinfo=timezone.utc)
        old = {"match_id": "old", "timestamp_start": 1794000000,
               "status_note": "Team A won by 4 runs"}
        current = {"match_id": "new", "timestamp_start": 1794500000,
                   "match_ended": True, "status": "Finished",
                   "teama": {"name": "Team B"}, "teamb": {"name": "Team C"}}
        archive = merge_recent_results([current], [], {"matches": [old]}, now=now)
        self.assertEqual({m["match_id"] for m in archive["matches"]}, {"old", "new"})

    def test_archive_deduplicates_by_match_id_and_prefers_latest_result(self):
        now = datetime(2026, 11, 13, tzinfo=timezone.utc)
        older = {"match_id": "same", "timestamp_start": 1794500000,
                 "status_note": "Old status", "match_ended": True}
        newer = {"match_id": "same", "timestamp_start": 1794500000,
                 "status_note": "Team A won by 3 wickets", "match_ended": True}
        archive = merge_recent_results([newer], [], {"matches": [older]}, now=now)
        self.assertEqual(len(archive["matches"]), 1)
        self.assertEqual(archive["matches"][0]["status_note"], "Team A won by 3 wickets")


if __name__ == "__main__":
    unittest.main()
