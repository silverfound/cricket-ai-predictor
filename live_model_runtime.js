(function (root) {
    "use strict";

    function interpolate(value, xValues, yValues) {
        if (!Array.isArray(xValues) || !Array.isArray(yValues) ||
            xValues.length === 0 || xValues.length !== yValues.length) {
            throw new Error("Invalid live-model calibration curve");
        }
        if (value <= xValues[0]) return yValues[0];
        const last = xValues.length - 1;
        if (value >= xValues[last]) return yValues[last];

        let low = 0;
        let high = last;
        while (high - low > 1) {
            const middle = Math.floor((low + high) / 2);
            if (xValues[middle] <= value) low = middle;
            else high = middle;
        }
        const width = xValues[high] - xValues[low];
        if (width <= 0) return yValues[low];
        const ratio = (value - xValues[low]) / width;
        return yValues[low] + ratio * (yValues[high] - yValues[low]);
    }

    function predictLiveWinProbability(modelBundle, format, features) {
        const formatKey = String(format || "").toUpperCase();
        const spec = modelBundle && modelBundle.models && modelBundle.models[formatKey];
        if (!spec) return null;

        let rawScore = Number(spec.intercept);
        if (!Number.isFinite(rawScore)) throw new Error("Invalid live-model intercept");

        for (let index = 0; index < spec.features.length; index += 1) {
            const name = spec.features[index];
            const value = Number(features && features[name]);
            if (!Number.isFinite(value)) {
                throw new Error("Missing or invalid live-model feature: " + name);
            }
            const mean = Number(spec.mean[index]);
            const scale = Number(spec.scale[index]);
            const coefficient = Number(spec.coefficients[index]);
            if (!Number.isFinite(mean) || !Number.isFinite(scale) ||
                !Number.isFinite(coefficient) || scale === 0) {
                throw new Error("Invalid live-model parameter for feature: " + name);
            }
            rawScore += ((value - mean) / scale) * coefficient;
        }

        const baseProbability = rawScore >= 0
            ? 1 / (1 + Math.exp(-rawScore))
            : Math.exp(rawScore) / (1 + Math.exp(rawScore));
        const legalBalls = Number(features.legal_balls);
        const scheduledBalls = Number(features.scheduled_balls);
        if (!Number.isFinite(legalBalls) || !Number.isFinite(scheduledBalls) ||
            scheduledBalls <= 0) {
            throw new Error("Invalid live-model innings progress");
        }
        const progress = Math.max(0, Math.min(1, legalBalls / scheduledBalls));
        const phase = progress <= 0.25 ? "early" : progress <= 0.75 ? "middle" : "late";
        const curve = spec.calibration && spec.calibration[phase];
        if (!curve) throw new Error("Missing live-model calibration phase: " + phase);
        const calibrated = interpolate(baseProbability, curve.x, curve.y);
        const probability = Math.max(0, Math.min(1, calibrated));
        return {
            format: formatKey,
            phase,
            battingTeamWinProbability: probability,
            bowlingTeamWinProbability: 1 - probability,
        };
    }

    const api = { predictLiveWinProbability };
    root.CricketLiveModel = api;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this);
