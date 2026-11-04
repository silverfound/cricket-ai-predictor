// 1. Cricket API (Matches ke liye)
const API_KEY = "oc_live_6j4o4fJnnWL0NRrjzdpVL3SZCX2Zk4Jx"; 
const BASE_URL = "https://opencricketapi.com/v1";

// 2. Aapka AI Backend (Render wala link)
const BACKEND_URL = "https://cricket-ai-predictor-ciat.onrender.com"; 

const headers = {
    "Authorization": `Bearer ${API_KEY}`, 
    "Accept": "application/json"
};

// Popup (Modal) ka HTML code
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

async function fetchRealApiMatches() {
    let container = document.getElementById("dynamic-prediction-area");
    if (!container) return;

    container.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Fetching Matches...</h3>`;

    try {
        const response = await fetch(`${BASE_URL}/matches`, { headers });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        renderRealMatches(data, container);
    } catch (error) {
        container.innerHTML = `
            <div style="background: #131b2e; padding: 15px; border-radius: 12px; border: 1px solid #ff4d4d;">
                <h3 style="color: #ff4d4d; margin: 0 0 5px 0;">API Connection Notice</h3>
                <p style="color: #94a3b8; margin: 0;">Error: ${error.message}</p>
            </div>
        `;
    }
}

function renderRealMatches(data, container) {
    let matches = Array.isArray(data) ? data : (data.data || data.matches || []);
    
    // Filhal purane matches dikha rahe hain kyunki API upcoming nahi de rahi
    matches.sort((a, b) => new Date(b.date) - new Date(a.date)); 
    matches = matches.slice(0, 15); // Top 15 matches

    if (matches.length === 0) {
        container.innerHTML = `<p style="color:white;">No Matches Found.</p>`;
        return;
    }

    let htmlContent = `<h3 style="color: #00ffcc; margin-bottom: 12px;">🏏 Matches & Predictions</h3>`;
    
    matches.forEach(match => {
        const team1 = match.teams && match.teams[0] ? match.teams[0].name : "Team 1";
        const team2 = match.teams && match.teams[1] ? match.teams[1].name : "Team 2";
        const venue = match.venue ? match.venue.name : "Unknown Venue";
        const competition = match.competition ? match.competition.name : "Cricket Match";
        const matchType = match.format || "T20";
        const matchResult = match.result || "Upcoming/Scheduled";

        htmlContent += `
            <div style="background: #131b2e; padding: 15px; margin: 10px 0; border-radius: 12px; border: 1px solid rgba(0,255,204,0.4);">
                <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 1.1rem;">${team1} vs ${team2}</h4>
                <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 0.85rem;">${competition}</p>
                <p style="color: #94a3b8; margin: 0 0 10px 0; font-size: 0.85rem;">Date: ${match.date}</p>
                <button onclick="openPredictModal('${team1}', '${team2}', '${venue}', '${matchType}')" style="background: #00ffcc; color: #000; padding: 8px 15px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%;">🔮 Predict Winner</button>
            </div>
        `;
    });
    
    container.innerHTML = htmlContent;
}

function openPredictModal(team1, team2, venue, matchType) {
    document.getElementById('prediction-modal').style.display = 'flex';
    document.getElementById('modal-match-name').innerText = `${team1} vs ${team2} (${matchType})`;
    document.getElementById('prediction-result').innerText = "";
    
    // Toss winner dropdown mein teams dalein
    const tossSelect = document.getElementById('toss-winner');
    tossSelect.innerHTML = `<option value="${team1}">${team1}</option><option value="${team2}">${team2}</option>`;

    // Button par click event lagayein
    document.getElementById('get-prediction-btn').onclick = async () => {
        const tossWinner = tossSelect.value;
        const tossDecision = document.getElementById('toss-decision').value;
        const resultDiv = document.getElementById('prediction-result');
        
        resultDiv.style.color = "#00ffcc";
        resultDiv.innerText = "Calculating... (Server wake up may take 50s)"; // User ko inform karne ke liye

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
                const p1 = prediction.predictions[team1];
                const p2 = prediction.predictions[team2];
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

document.addEventListener("DOMContentLoaded", fetchRealApiMatches);
