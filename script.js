// --- CONFIGURATION ---
const CRICLIVE_URL = "https://cricketliveapi.com/api/v1/cricket/schedule";

// 2. Aapka AI Backend (Render wala link)
const BACKEND_URL = "https://cricket-ai-predictor-ciat.onrender.com"; 

// --- POPUP HTML ---
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

// --- API CALL (Without Token) ---
async function fetchUpcomingMatches() {
    let container = document.getElementById("dynamic-prediction-area");
    if (!container) return;

    container.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Fetching Upcoming Matches...</h3>`;

    try {
        // Yahan humne Authorization header hata diya hai
        const response = await fetch(CRICLIVE_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        console.log("CricLive Data:", data);
        
        let matches = Array.isArray(data) ? data : (data.data || data.matches || data.response || []);
        
        renderMatches(matches, container);

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

// Baaki code (renderMatches, openPredictModal, etc.) waisa hi rahega
// ... (pichla code yahan paste karein) ...

// --- INITIALIZE ---
document.addEventListener("DOMContentLoaded", fetchUpcomingMatches);
