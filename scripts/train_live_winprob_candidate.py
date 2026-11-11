#!/usr/bin/env python3
"""Train and chronologically evaluate a research-only live win-probability model.

Source: free TigZig DuckDB download derived from Cricsheet (ODC-BY 1.0).
This script never touches the production pre-match model or its artifacts.
"""
from __future__ import annotations

import json
import tempfile
import zipfile
from pathlib import Path

import duckdb
import joblib
import numpy as np
import pandas as pd
import requests
from lightgbm import LGBMClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, roc_auc_score

DOWNLOAD_URL = "https://api.tigzig.com/cricket/v1/download/cricket_all_tables.duckdb.zip"
START_DATE = "2024-01-01"
END_DATE_EXCLUSIVE = "2027-01-01"
OUTPUT_DIR = Path("live_model_research")
FEATURES = [
    "gender", "team_type", "batting_team", "bowling_team",
    "innings", "runs_scored", "wickets_lost", "legal_balls",
    "scheduled_balls", "balls_remaining", "wickets_left",
    "current_run_rate", "required_run_rate", "runs_needed", "target_runs",
]
CATEGORICAL = ["gender", "team_type", "batting_team", "bowling_team"]


SQL = f"""
WITH source AS (
    SELECT
        b.match_id,
        CAST(b.start_date AS DATE) AS match_date,
        m.match_type,
        m.gender,
        m.team_type,
        m.winner,
        m.team1,
        m.team2,
        m.overs,
        m.target_overs,
        m.target_runs,
        COALESCE(m.balls_per_over, 6) AS balls_per_over,
        b.innings,
        b.batting_team,
        b.bowling_team,
        COALESCE(b.runs_off_bat, 0) + COALESCE(b.extras, 0) AS runs_this_ball,
        CASE WHEN b.wicket_type IS NOT NULL OR b.other_wicket_type IS NOT NULL
             THEN 1 ELSE 0 END AS wicket_this_ball,
        CASE WHEN COALESCE(b.wides, 0) = 0 AND COALESCE(b.noballs, 0) = 0
             THEN 1 ELSE 0 END AS legal_ball,
        b.over_no,
        b.delivery_in_over
    FROM ball_by_ball AS b
    INNER JOIN match_info AS m ON b.match_id = m.match_id
    WHERE CAST(b.start_date AS DATE) >= DATE '{START_DATE}'
      AND CAST(b.start_date AS DATE) < DATE '{END_DATE_EXCLUSIVE}'
      AND m.match_type IN ('T20', 'ODI', 'IPL')
      AND b.innings IN (1, 2)
      AND m.winner IS NOT NULL
      AND m.winner IN (m.team1, m.team2)
      AND b.batting_team IN (m.team1, m.team2)
      AND b.bowling_team IN (m.team1, m.team2)
      AND LOWER(COALESCE(m.outcome, '')) NOT IN ('draw', 'tie', 'no result')
),
states AS (
    SELECT *,
        SUM(runs_this_ball) OVER (
            PARTITION BY match_id, innings
            ORDER BY over_no, delivery_in_over
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS runs_scored,
        SUM(wicket_this_ball) OVER (
            PARTITION BY match_id, innings
            ORDER BY over_no, delivery_in_over
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS wickets_lost,
        SUM(legal_ball) OVER (
            PARTITION BY match_id, innings
            ORDER BY over_no, delivery_in_over
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS legal_balls
    FROM source
),
first_innings AS (
    SELECT match_id, MAX(runs_scored) AS first_innings_runs
    FROM states
    WHERE innings = 1
    GROUP BY match_id
),
targeted AS (
    SELECT
        s.*,
        CASE WHEN s.innings = 2
             THEN COALESCE(NULLIF(s.target_runs, 0), fi.first_innings_runs + 1)
             ELSE NULL END AS chase_target,
        CASE
            WHEN s.innings = 2 AND s.target_overs IS NOT NULL
            THEN CAST(FLOOR(s.target_overs) AS BIGINT) * s.balls_per_over
                 + CAST(ROUND((s.target_overs - FLOOR(s.target_overs)) * 10) AS BIGINT)
            ELSE COALESCE(s.overs, CASE WHEN s.match_type = 'ODI' THEN 50 ELSE 20 END)
                 * s.balls_per_over
        END AS scheduled_balls
    FROM states AS s
    LEFT JOIN first_innings AS fi ON s.match_id = fi.match_id
)
SELECT
    match_id,
    match_date,
    match_type,
    gender,
    team_type,
    batting_team,
    bowling_team,
    innings,
    runs_scored,
    wickets_lost,
    legal_balls,
    scheduled_balls,
    GREATEST(scheduled_balls - legal_balls, 0) AS balls_remaining,
    GREATEST(10 - wickets_lost, 0) AS wickets_left,
    CASE WHEN legal_balls > 0
         THEN runs_scored * balls_per_over / legal_balls
         ELSE 0 END AS current_run_rate,
    CASE WHEN innings = 2 AND chase_target IS NOT NULL
                   AND scheduled_balls > legal_balls
         THEN GREATEST(chase_target - runs_scored, 0) * balls_per_over
              / GREATEST(scheduled_balls - legal_balls, 1)
         ELSE 0 END AS required_run_rate,
    CASE WHEN innings = 2 AND chase_target IS NOT NULL
         THEN GREATEST(chase_target - runs_scored, 0)
         ELSE 0 END AS runs_needed,
    COALESCE(chase_target, 0) AS target_runs,
    CASE WHEN winner = batting_team THEN 1 ELSE 0 END AS label
FROM targeted
WHERE scheduled_balls > 0
  AND (innings = 1 OR chase_target IS NOT NULL)
"""


def download_database(destination: Path) -> Path:
    response = requests.get(DOWNLOAD_URL, timeout=(15, 180), stream=True)
    response.raise_for_status()
    with destination.open("wb") as handle:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                handle.write(chunk)

    extract_dir = destination.parent / "extracted"
    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination) as archive:
        root = extract_dir.resolve()
        for member in archive.infolist():
            target = (extract_dir / member.filename).resolve()
            if not target.is_relative_to(root):
                raise RuntimeError("Unsafe path in source archive")
        archive.extractall(extract_dir)

    candidates = list(extract_dir.rglob("*.duckdb")) + list(extract_dir.rglob("*.db"))
    if not candidates:
        raise RuntimeError("TigZig archive did not contain a DuckDB database file")
    return candidates[0]


def metric_block(y_true: np.ndarray, probabilities: np.ndarray) -> dict:
    labels = (probabilities >= 0.5).astype(int)
    result = {
        "rows": int(len(y_true)),
        "accuracy": float(accuracy_score(y_true, labels)),
        "log_loss": float(log_loss(y_true, np.clip(probabilities, 1e-6, 1 - 1e-6), labels=[0, 1])),
        "brier_score": float(brier_score_loss(y_true, probabilities)),
    }
    result["roc_auc"] = (
        float(roc_auc_score(y_true, probabilities))
        if len(np.unique(y_true)) == 2 else None
    )
    return result


def encode_categories(train: pd.DataFrame, *others: pd.DataFrame):
    category_map = {}
    for column in CATEGORICAL:
        values = sorted(train[column].fillna("__UNKNOWN__").astype(str).unique().tolist())
        if "__UNKNOWN__" not in values:
            values.append("__UNKNOWN__")
        category_map[column] = values
        dtype = pd.CategoricalDtype(categories=values)
        for frame in (train, *others):
            series = frame[column].fillna("__UNKNOWN__").astype(str)
            series = series.where(series.isin(values), "__UNKNOWN__")
            frame[column] = series.astype(dtype)
    return category_map


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="cricket-live-research-") as temp:
        temp_dir = Path(temp)
        zip_path = temp_dir / "cricket_all_tables.duckdb.zip"
        print("SOURCE_DOWNLOAD=START")
        database_path = download_database(zip_path)
        print(f"SOURCE_DATABASE={database_path.name}")

        connection = duckdb.connect(str(database_path), read_only=True)
        try:
            table_names = {
                row[0] for row in connection.execute("SHOW TABLES").fetchall()
            }
            if not {"ball_by_ball", "match_info"}.issubset(table_names):
                raise RuntimeError(f"Required source tables missing: {sorted(table_names)}")
            print("SOURCE_TABLES=ball_by_ball,match_info")
            print("DELIVERY_FEATURE_QUERY=START")
            data = connection.execute(SQL).df()
        finally:
            connection.close()

    if data.empty:
        raise RuntimeError("No eligible T20/ODI/IPL delivery states found")
    data["match_date"] = pd.to_datetime(data["match_date"])
    data["label"] = data["label"].astype("int8")
    data = data.replace([np.inf, -np.inf], np.nan)
    data = data.dropna(subset=FEATURES + ["label", "match_date"])

    train = data[data["match_date"].dt.year == 2024].copy()
    calibration = data[data["match_date"].dt.year == 2025].copy()
    test = data[data["match_date"].dt.year == 2026].copy()
    counts = {
        "all_rows": int(len(data)),
        "all_matches": int(data["match_id"].nunique()),
        "train_2024_rows": int(len(train)),
        "train_2024_matches": int(train["match_id"].nunique()),
        "calibration_2025_rows": int(len(calibration)),
        "calibration_2025_matches": int(calibration["match_id"].nunique()),
        "test_2026_rows": int(len(test)),
        "test_2026_matches": int(test["match_id"].nunique()),
    }
    print("DATA_COUNTS=" + json.dumps(counts, sort_keys=True))
    if min(len(train), len(calibration), len(test)) < 10000:
        raise RuntimeError("Insufficient rows in one or more chronological partitions")
    if any(frame["label"].nunique() != 2 for frame in (train, calibration, test)):
        raise RuntimeError("A chronological partition does not contain both outcome classes")

    models = {}
    calibrators = {}
    categories_by_format = {}
    format_metrics = {}
    phase_metrics_by_format = {}
    all_test_labels = []
    all_test_base_probabilities = []
    all_test_calibrated_probabilities = []

    for match_type in ("T20", "ODI"):
        train_fmt = train[train["match_type"] == match_type].copy()
        calibration_fmt = calibration[calibration["match_type"] == match_type].copy()
        test_fmt = test[test["match_type"] == match_type].copy()
        format_counts = {
            "train_2024_rows": int(len(train_fmt)),
            "train_2024_matches": int(train_fmt["match_id"].nunique()),
            "calibration_2025_rows": int(len(calibration_fmt)),
            "calibration_2025_matches": int(calibration_fmt["match_id"].nunique()),
            "test_2026_rows": int(len(test_fmt)),
            "test_2026_matches": int(test_fmt["match_id"].nunique()),
        }
        print(f"FORMAT_COUNTS_{match_type}=" + json.dumps(format_counts, sort_keys=True))
        if min(len(train_fmt), len(calibration_fmt), len(test_fmt)) < 10000:
            raise RuntimeError(f"Insufficient chronological data for {match_type}")
        if any(frame["label"].nunique() != 2 for frame in
               (train_fmt, calibration_fmt, test_fmt)):
            raise RuntimeError(f"{match_type} partition does not contain both outcome classes")

        category_map = encode_categories(train_fmt, calibration_fmt, test_fmt)
        x_train, y_train = train_fmt[FEATURES], train_fmt["label"]
        x_cal, y_cal = calibration_fmt[FEATURES], calibration_fmt["label"]
        x_test, y_test = test_fmt[FEATURES], test_fmt["label"]

        model = LGBMClassifier(
            objective="binary",
            n_estimators=350,
            learning_rate=0.04,
            num_leaves=31,
            min_child_samples=150,
            subsample=0.85,
            subsample_freq=1,
            colsample_bytree=0.85,
            reg_lambda=2.0,
            random_state=42,
            n_jobs=2,
            verbosity=-1,
        )
        print(f"MODEL_TRAINING_{match_type}=START")
        model.fit(x_train, y_train, categorical_feature=CATEGORICAL)

        calibration_probabilities = model.predict_proba(x_cal)[:, 1]
        calibrator = IsotonicRegression(out_of_bounds="clip", y_min=0.001, y_max=0.999)
        calibrator.fit(calibration_probabilities, y_cal)

        test_probabilities = model.predict_proba(x_test)[:, 1]
        calibrated_probabilities = calibrator.predict(test_probabilities)
        all_test_labels.append(y_test.to_numpy())
        all_test_base_probabilities.append(test_probabilities)
        all_test_calibrated_probabilities.append(calibrated_probabilities)

        # One end-of-phase snapshot per match/innings avoids letting long
        # innings dominate evaluation simply because they contain more balls.
        phase_eval = test_fmt.copy()
        phase_eval["uncalibrated_probability"] = test_probabilities
        phase_eval["calibrated_probability"] = calibrated_probabilities
        phase_eval["progress_ratio"] = (
            phase_eval["legal_balls"] / phase_eval["scheduled_balls"]
        ).clip(lower=0.0, upper=1.0)
        phase_eval["phase"] = pd.cut(
            phase_eval["progress_ratio"],
            bins=[0.0, 0.25, 0.75, 1.000001],
            labels=["early", "middle", "late"],
            include_lowest=True,
        )
        phase_snapshots = (
            phase_eval.dropna(subset=["phase"])
            .sort_values(["match_id", "innings", "legal_balls"])
            .groupby(["match_id", "innings", "phase"], observed=True)
            .tail(1)
        )
        phase_metrics = {}
        for phase in ("early", "middle", "late"):
            group = phase_snapshots[phase_snapshots["phase"] == phase]
            if group.empty:
                continue
            y_phase = group["label"].to_numpy()
            phase_metrics[phase] = {
                "snapshot_rows": int(len(group)),
                "matches": int(group["match_id"].nunique()),
                "uncalibrated": metric_block(
                    y_phase, group["uncalibrated_probability"].to_numpy()
                ),
                "isotonic_calibrated": metric_block(
                    y_phase, group["calibrated_probability"].to_numpy()
                ),
            }

        format_metrics[match_type] = {
            "counts": format_counts,
            "test_2026": {
                "uncalibrated": metric_block(y_test.to_numpy(), test_probabilities),
                "isotonic_calibrated": metric_block(y_test.to_numpy(), calibrated_probabilities),
            },
        }
        phase_metrics_by_format[match_type] = phase_metrics
        models[match_type] = model
        calibrators[match_type] = calibrator
        categories_by_format[match_type] = category_map

    combined_labels = np.concatenate(all_test_labels)
    combined_base_probabilities = np.concatenate(all_test_base_probabilities)
    combined_calibrated_probabilities = np.concatenate(all_test_calibrated_probabilities)
    metrics = {
        "source": "TigZig open cricket database, derived from Cricsheet",
        "source_license": "ODC-BY-1.0",
        "date_window": {"start": START_DATE, "end_exclusive": END_DATE_EXCLUSIVE},
        "format_scope": ["T20", "ODI"],
        "excluded_formats": {
            "IPL": "only 219 total matches in the source window; separate model not approved",
            "T10": "no genuine T10 delivery rows in this source",
            "TEST": "deferred to a later phase",
        },
        "chronological_split": {
            "train": "2024",
            "calibration": "2025",
            "untouched_test": "2026",
        },
        "counts": counts,
        "test_2026": {
            "uncalibrated": metric_block(combined_labels, combined_base_probabilities),
            "isotonic_calibrated": metric_block(combined_labels, combined_calibrated_probabilities),
        },
        "test_2026_by_format": format_metrics,
        "test_2026_phase_snapshots_by_format": phase_metrics_by_format,
        "phase_snapshot_method": "last available delivery in each early (0-25%), middle (25-75%), and late (75-100%) phase, once per match and innings",
        "production_status": "RESEARCH_ONLY_NOT_APPROVED",
    }

    bundle = {
        "models": models,
        "calibrators": calibrators,
        "features": FEATURES,
        "categorical_features": CATEGORICAL,
        "categories": categories_by_format,
        "train_year": 2024,
        "calibration_year": 2025,
        "test_year": 2026,
        "source": "TigZig/Cricsheet",
        "source_license": "ODC-BY-1.0",
        "supported_formats": ["T20", "ODI"],
        "production_approved": False,
    }
    joblib.dump(bundle, OUTPUT_DIR / "live_winprob_candidate.joblib")
    (OUTPUT_DIR / "metrics.json").write_text(
        json.dumps(metrics, indent=2, sort_keys=True), encoding="utf-8"
    )
    print("TEST_2026_METRICS=" + json.dumps(metrics["test_2026"], sort_keys=True))
    print("TEST_2026_BY_FORMAT=" + json.dumps(metrics["test_2026_by_format"], sort_keys=True))
    print("TEST_2026_PHASE_BY_FORMAT=" + json.dumps(metrics["test_2026_phase_snapshots_by_format"], sort_keys=True))
    print("RESEARCH_ARTIFACTS=live_model_research")
    print("PRODUCTION_STATUS=UNCHANGED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
