"""Pure format and rating helpers shared by the feed generator and tests."""

def match_type(fmt):
    value = str(fmt or "T20").strip().lower()
    if "test" in value or "first class" in value or "multi-day" in value:
        return "Test"
    if "odi" in value or "list a" in value or "one day" in value:
        return "ODI"
    if "t10" in value or "10 over" in value or "10-over" in value or "ten over" in value or "ten-over" in value:
        return "T10"
    return "T20"


def is_t10_format(fmt):
    return match_type(fmt) == "T10"


def elo_win_probability(team1_rating, team2_rating):
    """Standard Elo expected score for team 1, returned as a probability."""
    difference = max(-1600.0, min(1600.0, float(team2_rating) - float(team1_rating)))
    return float(1.0 / (1.0 + 10.0 ** (difference / 400.0)))
