// --- CONFIGURATION ---
// 1. Aapki CricAPI Key
const CRICAPI_KEY = "198b0b48-1026-4588-b420-fe70695ed472"; 
// Hum currentMatches use kar rahe hain (jo live aur aane wale matches dono deta hai)
const CRICAPI_URL = `https://api.cricapi.com/v1/currentMatches?apikey=${CRICAPI_KEY}&offset=0`;

// 2. Aapka AI Backend (Render wala link)
const BACKEND_URL = "https://cricket-ai-predictor-ciat.onrender.com"; 

// --- POPUP HTML (Toss select karne ke liye) ---
const popupHTML = `
<div id="prediction-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; align-items:center; justify-content:center;">
    <div style="background:#131b2e; padding:20px; border-radius:12px; width:90%; max-width:400px; border:1px solid #00ffcc;">
        <h3 style="color:#00ffcc; margin-top:0;">Match Prediction</h3>
        <p id="modal-match-name" style="color:white; font-weight:bold;"></p>
        
        <label style="color:#94a3b8; font-size:14px;">Toss Winner:</label>
        <select id="toss-winner" style="width:100%; padding:8px; margin-bottom:10px; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px;"></select>
        
        <label style="color:#94a3b8; font-size:14px;">Toss Decision:</label>
        <select id="toss-decision" style="width:100%; padding:8px; margin-bottom:15px; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px;">
            <option value="bat">Bat First</option>
            <option value="field">Field First</option>
        </select>

        <button id="get-prediction-btn" style="width:100%; padding:10px; background:#00ffcc; color:black; font-weight:bold; border:none; border-radius:6px; cursor:pointer;">Get Prediction</button>
        <button onclick="document.getElementById('prediction-modal').style.display='none'" style="width:100%; padding:10px; background:transparent; color:#ff4d4d; border:none; margin-top:10px; cursor:pointer;">Cancel</button>
        
        <div id="prediction-result" style="color:white; text-align:center; margin-top:15px; font-weight:bold;"></div>
    </div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', popupHTML);

// --- API CALL ---
async function fetchUpcomingMatches() {
    let container = document.getElementById("dynamic-prediction-area");
    if (!container) return;

    container.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Fetching Live & Upcoming Matches...</h3>`;

    try {
        const response = await fetch(CRICAPI_URL);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        console.log("CricAPI Data:", data);
        
        if (data.status === "success" && data.data) {
            renderMatches(data.data, container);
        } else {
            throw new Error(data.reason || "Data not found");
        }

    } catch (error) {
        console.error("Fetch error:", error);
        container.innerHTML = `
            <div style="background: #131b2e; padding: 15px; border-radius: 12px; border: 1px solid #ff4d4d;">
                <h3 style="color: #ff4d4d; margin: 0 0 5px 0;">API Connection Notice</h3>
                <p style="color: #94a3b8; margin: 0;">Error: ${error.message}</p>
            </div>
        `;
    }
}

// --- RENDER MATCHES ---
function renderMatches(matches, container) {
    if (!matches || matches.length === 0) {
        container.innerHTML = `<div style="background: #131b2e; padding: 15px; border-radius: 12px; border: 1px solid #00ffcc;">
            <h3 style="color: #00ffcc; margin: 0;">No Matches Found</h3>
            <p style="color: #94a3b8; margin: 0;">Abhi koi live ya aane wala match available nahi hai.</p>
        </div>`;
        return;
    }

    let htmlContent = `<h3 style="color: #00ffcc; margin-bottom: 12px;">🏏 Live & Upcoming Fixtures</h3>`;
    
    matches.forEach(match => {
        // CricAPI se teams nikalna (Agar teams nahi hain toh skip karein)
        if (!match.teams || match.teams.length < 2) return;

        const team1 = match.teams[0];
        const team2 = match.teams[1];
        const venue = match.venue || "Unknown Venue";
        
        // Format set karna (backend 'T20' ya 'ODI' expect kar raha hai)
        let matchType = match.matchType ? match.matchType.toUpperCase() : "T20";
        if (matchType.includes("T20")) matchType = "T20";
        if (matchType.includes("ODI")) matchType = "ODI";
        if (matchType.includes("TEST")) matchType = "Test";

        const status = match.status || "Match Scheduled";

        htmlContent += `
            <div style="background: #131b2e; padding: 15px; margin: 10px 0; border-radius: 12px; border: 1px solid rgba(0,255,204,0.4);">
                <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 1.1rem;">${team1} vs ${team2}</h4>
                <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 0.85rem;">${status}</p>
                <p style="color: #94a3b8; margin: 0 0 10px 0; font-size: 0.85rem;">Format: ${matchType} | Venue: ${venue}</p>
                <button onclick="openPredictModal('${team1}', '${team2}', '${venue}', '${matchType}')" style="background: #00ffcc; color: #000; padding: 8px 15px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%;">🔮 Predict Winner</button>
            </div>
        `;
    });
    
    container.innerHTML = htmlContent;
}

// --- PREDICTION LOGIC ---
function openPredictModal(team1, team2, venue, matchType) {
    document.getElementById('prediction-modal').style.display = 'flex';
    document.getElementById('modal-match-name').innerText = `${team1} vs ${team2} (${matchType})`;
    document.getElementById('prediction-result').innerText = "";
    
    const tossSelect = document.getElementById('toss-winner');
    tossSelect.innerHTML = `<option value="${team1}">${team1}</option><option value="${team2}">${team2}</option>`;

    document.getElementById('get-prediction-btn').onclick = async () => {
        const tossWinner = tossSelect.value;
        const tossDecision = document.getElementById('toss-decision').value;
        const resultDiv = document.getElementById('prediction-result');
        
        resultDiv.style.color = "#00ffcc";
        resultDiv.innerText = "Calculating... (Server wake up may take 50s)";

        try {
            const response = await fetch(`${BACKEND_URL}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    match_type: matchType,
                    team1: team1,
                    team2: team2,
                    venue: venue,
                    toss_winner: tossWinner,
                    toss_decision: tossDecision
                })
            });
            
            const prediction = await response.json();
            
            if(prediction.success) {
                const p1 = prediction.predictions[team1] || "N/A";
                const p2 = prediction.predictions[team2] || "N/A";
                resultDiv.innerHTML = `<span style="color:#00ffcc;">${team1}: ${p1}</span><br><span style="color:#ff4d4d;">${team2}: ${p2}</span>`;
            } else {
                resultDiv.style.color = "#ff4d4d";
                resultDiv.innerText = "Prediction error.";
            }
        } catch (error) {
            resultDiv.style.color = "#ff4d4d";
            resultDiv.innerText = "Backend connect nahi ho raha. Thodi der baad try karein.";
        }
    };
}

// --- INITIALIZE ---
document.addEventListener("DOMContentLoaded", fetchUpcomingMatches);
