const assert = require("node:assert/strict");
const fs = require("node:fs");
const { predictLiveWinProbability } = require("../live_model_runtime.js");

const root = "live_model_research";
const bundle = JSON.parse(fs.readFileSync(root + "/live_winprob_browser.json", "utf8"));
const vectors = JSON.parse(fs.readFileSync(root + "/parity_vectors.json", "utf8"));

assert.ok(bundle.production_approved === false, "research artifact must not be production-approved");
assert.ok(bundle.supported_formats.includes("T20"));
assert.ok(bundle.supported_formats.includes("ODI"));
assert.ok(vectors.length >= 2, "expected holdout parity vectors");

let checked = 0;
for (const vector of vectors) {
    const result = predictLiveWinProbability(bundle, vector.format, vector.features);
    assert.ok(result, "supported format should return a prediction");
    assert.ok(Math.abs(
        result.battingTeamWinProbability - vector.expected_batting_team_win_probability
    ) < 1e-6, "browser probability must match Python inference");
    const progress = vector.features.legal_balls / vector.features.scheduled_balls;
    const expectedPhase = progress <= 0.25 ? "early" : progress <= 0.75 ? "middle" : "late";
    assert.equal(result.phase, expectedPhase, "runtime must choose the matching calibration phase");
    assert.ok(Math.abs(
        result.battingTeamWinProbability + result.bowlingTeamWinProbability - 1
    ) < 1e-12, "team probabilities must sum to one");
    checked += 1;
}

assert.equal(predictLiveWinProbability(bundle, "T10", {}), null);
assert.throws(
    () => predictLiveWinProbability(bundle, "T20", {}),
    /Missing or invalid live-model feature/
);
process.stdout.write("LIVE_MODEL_BROWSER_PARITY=PASS vectors=" + checked + "\n");
