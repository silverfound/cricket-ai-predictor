#!/usr/bin/env python3
"""Runtime audit for the immutable prediction artifacts used by the feed generator.

This checks the real serialized estimators, their feature schemas, class labels,
and one deterministic inference row. It does not retrain or rewrite artifacts.
"""
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.prediction_formats import binary_class_probabilities
MODELS = joblib.load(ROOT / "cricket_ensemble_modern.joblib")
ELO = joblib.load(ROOT / "latest_elo_ratings.joblib")
MAPPINGS = joblib.load(ROOT / "category_mappings.joblib")
TOSS_STATS = joblib.load(ROOT / "toss_stats.joblib")
HISTORY = json.loads((ROOT / "data/cricsheet_match_history_2024_2026.json").read_text(encoding="utf-8"))

REQUIRED_TOSS_KEYS = (
    "v_tw_tot", "v_tw_wins", "v_bat_tot", "v_bat_wins", "v_fld_tot", "v_fld_wins"
)
CATEGORICAL_COLUMNS = ("match_type", "team1", "team2", "venue", "toss_decision")


def feature_names(model, label):
    for attribute in ("feature_names_", "feature_name_"):
        names = getattr(model, attribute, None)
        if names is not None and len(names):
            return list(names)
    method = getattr(model, "feature_name", None)
    if callable(method):
        names = method()
        if names:
            return list(names)
    raise RuntimeError(f"{label} does not expose its trained feature names")


def sample_frame():
    row = {
        "match_type": "T20",
        "team1": "Australia",
        "team2": "India",
        "venue": "Melbourne",
        "toss_decision": "bat",
        "team1_elo": 1550.0,
        "team2_elo": 1500.0,
        "toss_win_team1": 1,
        "team1_form": 0.60,
        "team2_form": 0.40,
        "h2h_team1_ratio": 0.55,
        "venue_form_t1": 0.60,
        "venue_form_t2": 0.40,
    }
    for column in CATEGORICAL_COLUMNS:
        categories = list(MAPPINGS[column])
        if not categories:
            raise RuntimeError(f"No categories are available for {column}")
        if row[column] not in categories:
            row[column] = "__UNKNOWN__" if "__UNKNOWN__" in categories else categories[0]
        if "__UNKNOWN__" not in categories:
            categories.append("__UNKNOWN__")
        row[column] = pd.Categorical([row[column]], categories=categories)
    return pd.DataFrame({
        key: (value if isinstance(value, pd.Categorical) else [value])
        for key, value in row.items()
    })


def main():
    if not isinstance(MODELS, dict) or not {"cat", "lgb"}.issubset(MODELS):
        raise RuntimeError("Ensemble artifact must contain both 'cat' and 'lgb' estimators")
    if not isinstance(ELO, dict) or not ELO:
        raise RuntimeError("Elo ratings artifact is missing or empty")
    if not isinstance(MAPPINGS, dict) or not all(k in MAPPINGS for k in CATEGORICAL_COLUMNS):
        raise RuntimeError("Category mapping artifact is missing required categorical mappings")
    missing_toss = [key for key in REQUIRED_TOSS_KEYS if key not in TOSS_STATS]
    if missing_toss:
        raise RuntimeError(f"Toss statistics artifact is missing keys: {missing_toss}")
    if not isinstance(HISTORY, list) or not HISTORY:
        raise RuntimeError("Historical match data is missing or empty")

    frame = sample_frame()
    results = {}
    for label, model_key in (("CatBoost", "cat"), ("LightGBM", "lgb")):
        model = MODELS[model_key]
        names = feature_names(model, label)
        missing = [name for name in names if name not in frame.columns]
        if missing:
            raise RuntimeError(f"{label} requires features not built by inference: {missing}")
        p1, p0 = binary_class_probabilities(model, frame.loc[:, names])
        results[label] = {
            "feature_count": len(names),
            "features": names,
            "classes": list(getattr(model, "classes_", [])),
            "sample_probability_class_1": round(p1, 6),
            "sample_probability_class_0": round(p0, 6),
        }

    match_types = {}
    t10_count = 0
    for item in HISTORY:
        fmt = str(item.get("match_type", "<missing>"))
        match_types[fmt] = match_types.get(fmt, 0) + 1
        if fmt.strip().casefold().replace("_", " ").replace("-", " ") in {
            "t10", "10 over", "ten over", "t 10"
        }:
            t10_count += 1

    print("MODEL_RUNTIME_AUDIT=PASS")
    print("MODEL_RESULTS=" + json.dumps(results, sort_keys=True, default=str))
    print(f"ELO_TEAM_COUNT={len(ELO)}")
    print(f"HISTORY_ROW_COUNT={len(HISTORY)}")
    print(f"HISTORY_T10_ROW_COUNT={t10_count}")
    print("HISTORY_FORMAT_COUNTS=" + json.dumps(match_types, sort_keys=True, default=str))
    print("TOSS_STATS_ARTIFACT=LOADED")
    print("TOSS_STATS_USED_AS_MODEL_FEATURES=NO")
    print("PROBABILITY_CALIBRATOR=NOT_PRESENT_IN_REPOSITORY_RUNTIME")


if __name__ == "__main__":
    main()
