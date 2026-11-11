#!/usr/bin/env python3
"""Export the calibrated state-only baseline to a browser-safe JSON bundle."""
from __future__ import annotations

import json
from pathlib import Path

import joblib

ARTIFACT_DIR = Path("live_model_research")


def main() -> int:
    bundle = joblib.load(ARTIFACT_DIR / "live_winprob_candidate.joblib")
    exported = {}
    for match_type in bundle.get("supported_formats", []):
        exported[match_type] = {}
        for phase, pipeline in bundle["models"][match_type].items():
            scaler = pipeline.named_steps["standardscaler"]
            classifier = pipeline.named_steps["logisticregression"]
            calibrator = bundle["calibrators"][match_type][phase]
            exported[match_type][phase] = {
                "features": bundle["features"],
                "mean": [float(value) for value in scaler.mean_],
                "scale": [float(value) for value in scaler.scale_],
                "coefficients": [float(value) for value in classifier.coef_[0]],
                "intercept": float(classifier.intercept_[0]),
                "calibration": {
                    "x": [float(value) for value in calibrator.X_thresholds_],
                    "y": [float(value) for value in calibrator.y_thresholds_],
                },
            }

    if not exported:
        raise RuntimeError("No baseline format passed the research sanity gate")

    payload = {
        "version": 1,
        "model_family": bundle["primary_model_family"],
        "source": bundle["source"],
        "source_license": bundle["source_license"],
        "train_year": bundle["train_year"],
        "calibration_year": bundle["calibration_year"],
        "untouched_test_year": bundle["test_year"],
        "supported_formats": sorted(exported),
        "production_approved": False,
        "probability_semantics": "probability that the current batting team wins",
        "models": exported,
    }
    destination = ARTIFACT_DIR / "live_winprob_browser.json"
    destination.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print("BROWSER_MODEL_FORMATS=" + ",".join(sorted(exported)))
    print("BROWSER_MODEL_JSON=" + str(destination))
    print("BROWSER_MODEL_PRODUCTION_APPROVED=false")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
