(function () {
    "use strict";

    function ensurePanel() {
        let panel = document.getElementById("live-winprob-panel");
        if (panel) return panel;
        const anchor = document.getElementById("sportscore-details");
        if (!document.getElementById("prediction-modal") || !anchor) return null;
        panel = document.createElement("section");
        panel.id = "live-winprob-panel";
        panel.style.cssText = "display:none;margin-top:12px;padding:12px;border:1px solid #00b894;border-radius:8px;background:#071b1a;color:#e2e8f0;font-size:13px;";
        panel.setAttribute("aria-live", "polite");
        anchor.insertAdjacentElement("afterend", panel);
        return panel;
    }

    function renderLivePanel(isLive, predictionData) {
        const panel = ensurePanel();
        if (!panel) return;
        if (!isLive) {
            panel.style.display = "none";
            return;
        }
        panel.style.display = "block";
        const prediction = predictionData && predictionData.live_winprob;
        panel.replaceChildren();

        const heading = document.createElement("div");
        heading.textContent = "LIVE WIN PROBABILITY";
        heading.style.cssText = "color:#00ffcc;font-weight:700;margin-bottom:7px;";
        panel.appendChild(heading);

        if (!prediction || prediction.available !== true) {
            const message = document.createElement("div");
            const format = String(predictionData && predictionData.format || "").toUpperCase();
            message.textContent = format.includes("T10")
                ? "T10 live probability band hai: genuine T10 training data/model available nahi. Scorecard ko probability mein convert nahi kiya jayega."
                : "Is fixture ke liye verified Highlightly live scorecard snapshot ya required innings/target fields available nahi. Pre-match estimate ko live probability ke taur par show nahi kiya jayega.";
            panel.appendChild(message);
            return;
        }

        const score = document.createElement("div");
        score.textContent = "Score: " + prediction.batting_team + " " + prediction.score +
            " (" + prediction.overs + " ov)";
        score.style.marginBottom = "5px";
        panel.appendChild(score);

        const innings = document.createElement("div");
        innings.textContent = "Innings " + prediction.innings + " · " + prediction.phase +
            " phase" + (prediction.target_runs ? " · Target " + prediction.target_runs : "");
        innings.style.cssText = "color:#94a3b8;font-size:11px;margin-bottom:8px;";
        panel.appendChild(innings);

        const timestamp = new Date(prediction.snapshot_at);
        const ageMinutes = Number.isFinite(timestamp.getTime())
            ? Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 60000))
            : null;
        if (ageMinutes !== null && ageMinutes > 30) {
            const stale = document.createElement("div");
            stale.textContent = "STALE SNAPSHOT — live probability hide kar di gayi hai. Agli scheduled refresh ka intizar karein.";
            stale.style.cssText = "color:#fbbf24;font-size:12px;font-weight:700;margin-top:8px;";
            panel.appendChild(stale);
            return;
        }

        const probability = prediction.probabilities || {};
        const grid = document.createElement("div");
        grid.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;";
        for (const team of [prediction.batting_team, prediction.bowling_team]) {
            const cell = document.createElement("div");
            cell.style.cssText = "padding:8px;background:#0f2927;border-radius:6px;min-width:0;";
            const name = document.createElement("div");
            name.textContent = team;
            name.style.cssText = "font-size:11px;color:#cbd5e1;overflow-wrap:anywhere;";
            const value = document.createElement("div");
            value.textContent = Number(probability[team]).toFixed(2) + "%";
            value.style.cssText = "font-size:20px;font-weight:700;color:#00ffcc;margin-top:3px;";
            cell.append(name, value);
            grid.appendChild(cell);
        }
        panel.appendChild(grid);

        const note = document.createElement("div");
        note.style.cssText = "font-size:10px;color:#94a3b8;margin-top:8px;";
        note.textContent = "Model: 2024–2026 calibrated state-only T20/ODI · Highlightly snapshot" +
            (ageMinutes === null ? "" : " · " + ageMinutes + " min old") +
            " · Feed refresh: 30 min · Not ball-by-ball";
        panel.appendChild(note);

        const warning = document.getElementById("live-warning");
        if (warning) {
            warning.style.display = "block";
            const text = warning.querySelector("p");
            if (text) text.textContent = "Live state model available from the latest verified scorecard snapshot. This is a 30-minute scheduled snapshot, not a ball-by-ball feed; stale data must not be treated as current.";
        }
    }

    function install() {
        const original = window.openPredictModal;
        if (typeof original !== "function" || original.__liveWinprobWrapped) return false;
        const wrapped = function () {
            const args = Array.from(arguments);
            const pending = original.apply(this, args);
            renderLivePanel(Boolean(args[6]), args[13] || {});
            return pending;
        };
        wrapped.__liveWinprobWrapped = true;
        window.openPredictModal = wrapped;
        return true;
    }

    if (!install()) {
        document.addEventListener("DOMContentLoaded", install, { once: true });
    }
})();
