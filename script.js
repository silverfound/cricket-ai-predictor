// --- CONFIGURATION ---
const CRICAPI_KEY = "198b0b48-1026-4588-b420-fe70695ed472"; 
const CRICAPI_URL = `https://api.cricapi.com/v1/currentMatches?apikey=${CRICAPI_KEY}&offset=0`;
const BACKEND_URL = "https://cricket-ai-predictor-ciat.onrender.com"; 

// Global Variables for Data
let liveMatches = [];
let upcomingMatches = [];
let finishedMatches = [];
let currentTab = 'live'; // Default Tab

// --- POPUP HTML (Toss Select Karne Ke Liye) ---
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

// --- API CALL & TABS SETUP ---
async function fetchUpcomingMatches() {
    let container = document.getElementById("dynamic-prediction-area");
    if (!container) return;

    // Tabs ka HTML structure aur style
    let tabsHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 15px; justify-content: center;">
            <button id="tab-live" onclick="switchTab('live')" style="padding: 8px 15px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; background: #00ffcc; color: #000;">🔴 Live</button>
            <button id="tab-upcoming" onclick="switchTab('upcoming')" style="padding: 8px 15px; border-radius: 6px; border: 1px solid #334155; font-weight: bold; cursor: pointer; background: #131b2e; color: white;">⏳ Upcoming</button>
            <button id="tab-finished" onclick="switchTab('finished')" style="padding: 8px 15px; border-radius: 6px; border: 1px solid #334155; font-weight: bold; cursor: pointer; background: #131b2e; color: white;">✅ Finished</button>
        </div>
        <div id="matches-container"></div>
    `;
    container.innerHTML = tabsHTML;

    let matchesContainer = document.getElementById("matches-container");
    matchesContainer.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Fetching Matches...</h3>`;

    try {
        const response = await fetch(CRICAPI_URL);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        
        if (data.status === "success" && data.data) {
            
            // Arrays ko reset karein
            liveMatches = []; upcomingMatches = []; finishedMatches = [];

            data.data.forEach(match => {
                // SMART FILTER: T20 sab allow, ODI/Test sirf International allow
                let type = match.matchType ? match.matchType.toLowerCase() : "";
                let name = match.name ? match.name.toLowerCase() : "";
                let domesticKeywords = ['county', 'shield', 'one day cup', 'odi cup', 'first class', 'ranji', 'duleep', 'super50', 'ford trophy'];
                let isDomestic = domesticKeywords.some(kw => name.includes(kw));

                let allowed = false;
                if (type === 't20') allowed = true; 
                else if ((type === 'odi' || type === 'test') && !isDomestic) allowed = true;

                if (allowed) {
                    // Matches ko categorize karein
                    if (match.matchEnded === true) {
                        finishedMatches.push(match);
                    } else if (match.matchStarted === true && match.matchEnded === false) {
                        liveMatches.push(match);
                    } else {
                        upcomingMatches.push(match);
                    }
                }
            });

            // Default tab render karein
            switchTab('live');

        } else {
            throw new Error(data.reason || "Data not found");
        }
    } catch (error) {
        matchesContainer.innerHTML = `
            <div style="background: #131b2e; padding: 15px; border-radius: 12px; border: 1px solid #ff4d4d;">
                <h3 style="color: #ff4d4d; margin: 0 0 5px 0;">API Connection Notice</h3>
                <p style="color: #94a3b8; margin: 0;">Error: ${error.message}</p>
            </div>
        `;
    }
}

// --- TAB SWITCHING LOGIC ---
function switchTab(tabName) {
    currentTab = tabName;
    
    // Buttons ka color update karein
    document.getElementById('tab-live').style.background = tabName === 'live' ? '#00ffcc' : '#131b2e';
    document.getElementById('tab-live').style.color = tabName === 'live' ? '#000' : 'white';
    document.getElementById('tab-live').style.border = tabName === 'live' ? 'none' : '1px solid #334155';

    document.getElementById('tab-upcoming').style.background = tabName === 'upcoming' ? '#00ffcc' : '#131b2e';
    document.getElementById('tab-upcoming').style.color = tabName === 'upcoming' ? '#000' : 'white';
    document.getElementById('tab-upcoming').style.border = tabName === 'upcoming' ? 'none' : '1px solid #334155';

    document.getElementById('tab-finished').style.background = tabName === 'finished' ? '#00ffcc' : '#131b2e';
    document.getElementById('tab-finished').style.color = tabName === 'finished' ? '#000' : 'white';
    document.getElementById('tab-finished').style.border = tabName === 'finished' ? 'none' : '1px solid #334155';

    // Data render karein
    let matchesToRender = [];
    if (tabName === 'live') matchesToRender = liveMatches;
    if (tabName === 'upcoming') matchesToRender = upcomingMatches;
    if (tabName === 'finished') matchesToRender = finishedMatches;

    renderMatches(matchesToRender);
}

// --- RENDER MATCHES (WITH LOCAL TIME) ---
function renderMatches(matches) {
    let container = document.getElementById("matches-container");
    
    if (!matches || matches.length === 0) {
        container.innerHTML = `<div style="background: #131b2e; padding: 15px; border-radius: 12px; border: 1px solid #00ffcc; text-align: center;">
            <h3 style="color: #00ffcc; margin: 0;">No Matches Found</h3>
            <p style="color: #94a3b8; margin: 5px 0 0 0;">Is category mein filhal koi match available nahi hai.</p>
        </div>`;
        return;
    }

    let htmlContent = "";
    
    matches.forEach(match => {
        if (!match.teams || match.teams.length < 2) return;

        const team1 = match.teams[0];
        const team2 = match.teams[1];
        const venue = match.venue || "Unknown Venue";
        let matchType = match.matchType ? match.matchType.toUpperCase() : "T20";
        
        // USER KE LOCAL TIME KA LOGIC
        let localDateTime = "Time TBA";
        if (match.dateTimeGMT) {
            // API se aane wala time uthaya
            const dateObj = new Date(match.dateTimeGMT);
            // toLocaleString() automatically user ke mobile (Pakistan, India, Dubai etc) ka timezone apply kar deta hai
            localDateTime = dateObj.toLocaleString(undefined, {
                weekday: 'short', 
                day: 'numeric', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit'
            });
        } else if (match.date) {
            localDateTime = match.date;
        }
        
        // Status text color
        let statusColor = currentTab === 'live' ? '#ff4d4d' : (currentTab === 'finished' ? '#00ffcc' : '#fbbf24');
        let statusText = match.status || (currentTab === 'upcoming' ? "Match Scheduled" : "Status Unknown");

        let buttonHTML = "";
        if (currentTab !== 'finished') {
            buttonHTML = `<button onclick="openPredictModal('${team1}', '${team2}', '${venue}', '${matchType}')" style="background: #00ffcc; color: #000; padding: 8px 15px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px;">🔮 Predict Winner</button>`;
        }

        // Card design jisme local time aur date shamil hai
        htmlContent += `
            <div style="background: #131b2e; padding: 15px; margin: 10px 0; border-radius: 12px; border: 1px solid rgba(0,255,204,0.2);">
                <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 1.1rem;">${team1} vs ${team2}</h4>
                <p style="color: ${statusColor}; margin: 0 0 5px 0; font-size: 0.85rem; font-weight: bold;">${statusText}</p>
                <p style="color: #fbbf24; margin: 0 0 5px 0; font-size: 0.85rem; font-weight: bold;">📅 ${localDateTime}</p>
                <p style="color: #94a3b8; margin: 0; font-size: 0.85rem;">Format: ${matchType} | Venue: ${venue}</p>
                ${buttonHTML}
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
            
            if(response.ok && prediction.success) {
                const p1 = prediction.predictions[team1] || "N/A";
                const p2 = prediction.predictions[team2] || "N/A";
                
                let html = `<span style="color:#00ffcc;">${team1}: ${p1}</span><br><span style="color:#ff4d4d;">${team2}: ${p2}</span>`;
                
                if (prediction.is_default) {
                    html += `<br><br><span style="color:#fbbf24; font-size:12px;">⚠️ Warning: Model ko is team/venue ka data nahi pata, isliye 50-50% prediction hai.</span>`;
                }
                
                resultDiv.innerHTML = html;
            } else {
                resultDiv.style.color = "#ff4d4d";
                resultDiv.innerText = `Error: ${prediction.detail || "Prediction failed"}`;
            }
        } catch (error) {
            resultDiv.style.color = "#ff4d4d";
            resultDiv.innerText = "Backend connect nahi ho raha. Thodi der baad try karein.";
        }
    };
}

// --- INITIALIZE ---
document.addEventListener("DOMContentLoaded", fetchUpcomingMatches);
