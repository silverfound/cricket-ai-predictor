import unittest

from scripts.team_identity import (
    canonical_team_name,
    history_team_key,
    normalize_team_name,
    team_gender,
    team_names_equivalent,
    resolve_fixture_team,
    fixture_teams_equivalent,
)


class TeamIdentityTests(unittest.TestCase):
    def test_known_provider_aliases_resolve_to_model_labels(self):
        cases = [
            ("Saint Lucia Kings", "St Lucia Kings"),
            ("Northern Brave", "Northern Districts"),
            ("Northern Brave Women", "Northern Districts Women"),
            ("Central Hinds", "Central Districts Women"),
            ("Sudurpaschim Royals", "Sudur Paschim Royals"),
            ("S Paschim", "Sudur Paschim Royals"),
            ("Antigua & Barbuda Falcons", "Antigua and Barbuda Falcons"),
            ("St Kitts & Nevis Patriots", "St Kitts and Nevis Patriots"),
            ("Canterbury Magicians", "Canterbury Women"),
            ("Auckland Hearts", "Auckland Women"),
            ("Otago Sparks", "Otago Women"),
            ("Wellington Blaze", "Wellington Women"),
        ]
        for provider_name, model_name in cases:
            with self.subTest(provider_name=provider_name):
                self.assertEqual(canonical_team_name(provider_name), model_name)

    def test_competition_suffix_and_punctuation_are_normalized(self):
        self.assertTrue(team_names_equivalent("Sudur Paschim Royals (NPL)", "Sudurpaschim Royals"))
        self.assertTrue(team_names_equivalent("St Kitts & Nevis Patriots", "St Kitts and Nevis Patriots"))
        self.assertEqual(normalize_team_name("Melbourne Stars (W)"), "melbourne stars women")

    def test_mens_and_womens_sides_remain_distinct(self):
        self.assertEqual(team_gender("Melbourne Stars (W)"), "female")
        self.assertEqual(team_gender("Melbourne Stars Women"), "female")
        self.assertEqual(team_gender("Melbourne Stars"), "male")
        self.assertFalse(team_names_equivalent("Melbourne Stars", "Melbourne Stars Women"))
        self.assertTrue(team_names_equivalent("Melbourne Stars (W)", "Melbourne Stars Women"))

    def test_no_unsafe_prefix_matching(self):
        self.assertFalse(team_names_equivalent("Team A", "Team Alpha"))
        self.assertFalse(team_names_equivalent("United Tigers", "United Tiger XI"))

    def test_fixture_context_resolves_provider_abbreviations_safely(self):
        self.assertEqual(
            resolve_fixture_team("S Paschim", "Kathmandu Gurkhas (NPL)", "Sudur Paschim Royals (NPL)"),
            "Sudur Paschim Royals",
        )
        self.assertEqual(
            resolve_fixture_team("Tigers", "United Tigers", "Emirates Eagles"),
            "United Tigers",
        )
        self.assertEqual(
            resolve_fixture_team("Tigers", "United Tigers", "Desert Tigers"),
            "",
        )
        self.assertEqual(
            resolve_fixture_team("Mystery XI", "United Tigers", "Emirates Eagles"),
            "",
        )
        self.assertEqual(
            resolve_fixture_team("Melbourne Stars", "Melbourne Stars", "Melbourne Stars Women"),
            "Melbourne Stars",
        )

    def test_cross_provider_fixture_matching_is_order_independent_and_fail_closed(self):
        self.assertTrue(fixture_teams_equivalent(
            "Kathmandu Gurkhas (NPL)", "Sudur Paschim Royals (NPL)",
            "S Paschim", "Kathmandu Gurkhas",
        ))
        self.assertTrue(fixture_teams_equivalent(
            "United Tigers", "Emirates Eagles", "Eagles", "Tigers",
        ))
        self.assertFalse(fixture_teams_equivalent(
            "United Tigers", "Desert Tigers", "Tigers", "United Tigers",
        ))
        self.assertFalse(fixture_teams_equivalent(
            "Melbourne Stars", "Melbourne Stars Women",
            "Melbourne Stars Women", "Melbourne Stars",
        ))

    def test_history_key_only_drops_gender_after_gender_is_separately_known(self):
        self.assertEqual(history_team_key("Melbourne Stars Women"), history_team_key("Melbourne Stars"))
        self.assertNotEqual(team_gender("Melbourne Stars Women"), team_gender("Melbourne Stars"))


if __name__ == "__main__":
    unittest.main()
