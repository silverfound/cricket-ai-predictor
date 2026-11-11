"""Pure format and rating helpers shared by the feed generator and tests."""

def match_type(fmt):
    """Map explicit provider labels to a supported model format.

    Unknown or missing labels must never silently inherit the T20 model.
    """
    value = str(fmt or "").strip().casefold().replace("_", " ").replace("-", " ")
    if not value:
        return "Unknown"
    if "test" in value or "first class" in value or "multi day" in value:
        return "Test"
    if "t10" in value or "10 over" in value or "ten over" in value:
        return "T10"
    if "odi" in value or "list a" in value or "one day" in value or "50 over" in value or "fifty over" in value:
        return "ODI"
    if "t20" in value or "twenty20" in value or "20 over" in value:
        return "T20"
    return "Unknown"


def is_t10_format(fmt):
    return match_type(fmt) == "T10"


def elo_win_probability(team1_rating, team2_rating):
    """Standard Elo expected score for team 1, returned as a probability."""
    difference = max(-1600.0, min(1600.0, float(team2_rating) - float(team1_rating)))
    return float(1.0 / (1.0 + 10.0 ** (difference / 400.0)))


def binary_class_probabilities(model, features):
    """Return (P(class 1), P(class 0)) independent of estimator class order."""
    import numpy as np

    classes = list(getattr(model, "classes_", []))
    if len(classes) != 2 or set(classes) != {0, 1}:
        raise ValueError(f"Expected binary model classes [0, 1], got {classes!r}")
    probabilities = np.asarray(model.predict_proba(features), dtype=float)
    if probabilities.ndim != 2 or probabilities.shape[0] != 1 or probabilities.shape[1] != 2:
        raise ValueError(f"Expected one row with two class probabilities, got shape {probabilities.shape}")
    p1 = float(probabilities[0, classes.index(1)])
    p0 = float(probabilities[0, classes.index(0)])
    if not np.isfinite(p1) or not np.isfinite(p0) or p1 < 0 or p0 < 0 or p1 > 1 or p0 > 1:
        raise ValueError("Model returned invalid binary probabilities")
    if abs((p1 + p0) - 1.0) > 1e-5:
        raise ValueError(f"Binary probabilities do not sum to 1: {p1} + {p0}")
    return p1, p0
