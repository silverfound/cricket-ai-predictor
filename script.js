// --- CONFIGURATION ---
const BBS_API_KEY = "bbs_live_00000mk5VAnc3iBl5yyZdo3Ry1qdYLotbG1tmjcLgarmWgXL"; // <-- Yahan apni BigBallsData ki key dalein
const BBS_URL = "https://api.bigballsdata.com/v1/matches?sport=cricket&limit=100"; 
const BACKEND_URL = "https://cricket-ai-predictor-ciat.onrender.com"; 

let liveMatches = [];
let upcomingMatches = [];
let finishedMatches = [];
let currentTab = 'live';

// --- POPUP HTML ---
const popupHTML = `
<div id="prediction-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; align-items:center; justify-content:center;">
    <div style="background:#131b2e; padding:20px; border-radius:12px; width:90%; max-width:400px; border:1px solid #00ffcc; max-height: 90vh; overflow-y: auto;">
        <h3 style="color:#00ffcc; margin-top:0;">Match Prediction</h3>
        <p id="modal-match-name" style="color:white; font-weight:bold;"></p>
        
        <!-- PRE-TOSS NEUTRAL PREDICTION -->
        <div id="pre-toss-area" style="background: #0f172a; padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #334155;">
            <p style="color: #fbbf24; margin: 0 0 5px 0; font-size: 12px; font-weight: bold;">📊 Pre-Toss Neutral Prediction</p>
            <div id="pre-toss-result" style="color: white; font-size: 14px;">Calculating neutral baseline...</div>
        </div>

        <label style="color:#94a3b8; font-size:14px;">Toss Winner:</label>
        <select id="toss-winner" style="width:100%; padding:8px; margin-bottom:10px; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px;"></select>
        
        <label style="color:#94a3b8; font-size:14px;">Toss Decision:</label>
        <select id="toss-decision" style="width:100%; padding:8px; margin-bottom:15px; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px;">
            <option value="bat">Bat First</option>
            <option value="field">Field First</option>
        </select>

        <button id="get-prediction-btn" style="width:100%; padding:10px; background:#00ffcc; color:black; font-weight:bold; border:none; border-radius:6px; cursor:pointer;">Calculate Post-Toss Impact</button>
        <button onclick="document.getElementById('prediction-modal').style.display='none'" style="width:100%; padding:10px; background:transparent; color:#ff4d4d; border:none; margin-top:10px; cursor:pointer;">Cancel</button>
        
        <!-- POST-TOSS PREDICTION & IMPACT -->
        <div id="post-toss-area" style="display:none; margin-top:15px; padding: 10px; border-radius: 8px; border: 1px solid #00ffcc; background: #0b1120;">
            <p style="color: #00ffcc; margin: 0 0 5px 0; font-size: 12px; font-weight: bold;">🎯 Post-Toss Prediction & Impact</p>
            <div id="prediction-result" style="color:white; text-align:center; font-weight:bold;"></div>
        </div>
    </div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', popupHTML);

// --- API CALL & TABS ---
async function fetchMatches() {
    let container = document.getElementById("dynamic-prediction-area");
    if (!container) return;

    let tabsHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 15px; justify-content: center;">
            <button id="tab-live" onclick="switchTab('live')" style="padding: 8px 15px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; background: #00ffcc; color: #000;">🔴 Live</button>
            <button id="tab-upcoming" onclick="switchTab('upcoming')" style="padding: 8px 15px; border-radius: 6px; border: 1px solid #334155; font-weight: bold; cursor: pointer; background: #131b2e; color: white;">⏳ Next 48 Hours</button>
            <button id="tab-finished" onclick="switchTab('finished')" style="padding: 8px 15px; border-radius: 6px; border: 1px solid #334155; font-weight: bold; cursor: pointer; background: #131b2e; color: white;">✅ Finished</button>
        </div>
        <div id="matches-container"></div>
    `;
    container.innerHTML = tabsHTML;

    let matchesContainer = document.getElementById("matches-container");
    matchesContainer.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Fetching Matches...</h3>`;

    try {
        const response = await fetch(BBS_URL, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${BBS_API_KEY}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        
        if (data.data) {
            liveMatches = []; upcomingMatches = []; finishedMatches = [];
            
            const now = new Date(); 
            const next48Hours = new Date(now.getTime() + (48 * 60 * 60 * 1000)); 
            
            let seenMatches = new Set();

            data.data.forEach(match => {
                const status = match.status; 
                const kickoffDate = new Date(match.kickoff_utc); 
                const competition = match.league || "";
                
                if (match.home && match.away) {
                    let matchType = getMatchFormat(competition);
                    let domesticKeywords = ['county', 'shield', 'one day cup', 'odi cup', 'first class', 'ranji', 'duleep', 'super50', 'ford trophy', 'sheffield shield'];
                    let isDomestic = domesticKeywords.some(kw => competition.toLowerCase().includes(kw));

                    let allowed = false;
                    if (matchType === 'T20') allowed = true; 
                    else if ((matchType === 'ODI' || matchType === 'Test') && !isDomestic) allowed = true;

                    if (!allowed) return;

                    const matchKey = match.kickoff_utc + "-" + [match.home.name, match.away.name].sort().join("-");

                    if (!seenMatches.has(matchKey)) {
                        if (status === 'live') {
                            seenMatches.add(matchKey);
                            liveMatches.push(match);
                        } 
                        else if (status === 'scheduled' && kickoffDate > now && kickoffDate <= next48Hours) {
                            seenMatches.add(matchKey);
                            upcomingMatches.push(match);
                        } 
                        else if (status === 'finished') {
                            seenMatches.add(matchKey);
                            finishedMatches.push(match);
                        }
                    }
                }
            });

            upcomingMatches.sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc));
            finishedMatches.sort((a, b) => new Date(b.kickoff_utc) - new Date(a.kickoff_utc));

            switchTab('live'); 
        } else {
            throw new Error("Data format error");
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

// --- TAB SWITCHING ---
function switchTab(tabName) {
    currentTab = tabName;
    
    document.getElementById('tab-live').style.background = tabName === 'live' ? '#00ffcc' : '#131b2e';
    document.getElementById('tab-live').style.color = tabName === 'live' ? '#000' : 'white';
    document.getElementById('tab-live').style.border = tabName === 'live' ? 'none' : '1px solid #334155';

    document.getElementById('tab-upcoming').style.background = tabName === 'upcoming' ? '#00ffcc' : '#131b2e';
    document.getElementById('tab-upcoming').style.color = tabName === 'upcoming' ? '#000' : 'white';
    document.getElementById('tab-upcoming').style.border = tabName === 'upcoming' ? 'none' : '1px solid #334155';

    document.getElementById('tab-finished').style.background = tabName === 'finished' ? '#00ffcc' : '#131b2e';
    document.getElementById('tab-finished').style.color = tabName === 'finished' ? '#000' : 'white';
    document.getElementById('tab-finished').style.border = tabName === 'finished' ? 'none' : '1px solid #334155';

    let matchesToRender = [];
    if (tabName === 'live') matchesToRender = liveMatches;
    if (tabName === 'upcoming') matchesToRender = upcomingMatches;
    if (tabName === 'finished') matchesToRender = finishedMatches;

    renderMatches(matchesToRender);
}

// --- HELPER: Format sahi karein ---
function getMatchFormat(leagueName) {
    if (!leagueName) return "T20";
    let l = leagueName.toLowerCase();
    if (l.includes('odi') || l.includes('one day') || l.includes('world cup')) return "ODI";
    if (l.includes('test') || l.includes('county') || l.includes('shield')) return "Test";
    return "T20"; 
}

// --- RENDER MATCHES ---
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
        if (!match.home || !match.away) return;

        const team1 = match.home.name;
        const team2 = match.away.name;
        const league = match.league || "Cricket Match";
        const matchType = getMatchFormat(league); 
        const venue = "Venue TBA"; 
        
        let localDateTime = "Time TBA";
        if (match.kickoff_utc) {
            const dateObj = new Date(match.kickoff_utc);
            localDateTime = dateObj.toLocaleString(undefined, {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });
        }
        
        let statusColor = currentTab === 'live' ? '#ff4d4d' : (currentTab === 'finished' ? '#00ffcc' : '#fbbf24');
        let statusText = currentTab === 'live' ? "LIVE NOW" : (currentTab === 'finished' ? "Match Finished" : "Scheduled");

        let buttonHTML = "";
        if (currentTab !== 'finished') {
            buttonHTML = `<button onclick="openPredictModal('${team1}', '${team2}', '${venue}', '${matchType}')" style="background: #00ffcc; color: #000; padding: 8px 15px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 10px;">🔮 Predict Winner</button>`;
        }

        htmlContent += `
            <div style="background: #131b2e; padding: 15px; margin: 10px 0; border-radius: 12px; border: 1px solid rgba(0,255,204,0.2);">
                <p style="color: #00ffcc; margin: 0 0 5px 0; font-size: 0.8rem; font-weight: bold;">${league.toUpperCase()} | ${matchType}</p>
                <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 1.1rem;">${team1} vs ${team2}</h4>
                <p style="color: ${statusColor}; margin: 0 0 5px 0; font-size: 0.85rem; font-weight: bold;">${statusText}</p>
                <p style="color: #fbbf24; margin: 0 0 5px 0; font-size: 0.85rem; font-weight: bold;">📅 ${localDateTime}</p>
                ${buttonHTML}
            </div>
        `;
    });
    
    container.innerHTML = htmlContent;
}

// --- PREDICTION LOGIC (SIMPLIFIED 2 CALLS) ---
async function openPredictModal(team1, team2, venue, matchType) {
    document.getElementById('prediction-modal').style.display = 'flex';
    document.getElementById('modal-match-name').innerText = `${team1} vs ${team2} (${matchType})`;
    document.getElementById('post-toss-area').style.display = 'none';
    
    const tossSelect = document.getElementById('toss-winner');
    tossSelect.innerHTML = `<option value="${team1}">${team1}</option><option value="${team2}">${team2}</option>`;

    // 1. NEUTRAL PRE-TOSS (Only 1 Backend Call)
    let preResultDiv = document.getElementById('pre-toss-result');
    preResultDiv.innerHTML = "Calculating Neutral Baseline...";
    window.neutralPred = null;

    try {
        const res = await fetch(`${BACKEND_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                match_type: matchType, team1, team2, venue
            })
        });
        const pred = await res.json();
        
        if (pred.success && !pred.is_default) {
            window.neutralPred = pred.predictions;
            preResultDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:#00ffcc;">${team1}: <b>${pred.predictions[team1]}</b></span>
                    <span style="color:#ff4d4d;">${team2}: <b>${pred.predictions[team2]}</b></span>
                </div>
            `;
        } else {
            preResultDiv.innerText = "Model lacks data for this match.";
        }
    } catch (e) {
        preResultDiv.innerText = "Error loading initial prediction.";
    }

    // 2. POST-TOSS PREDICTION (1 Backend Call)
    document.getElementById('get-prediction-btn').onclick = async () => {
        const tossWinner = tossSelect.value;
        const tossDecision = document.getElementById('toss-decision').value;
        
        const postArea = document.getElementById('post-toss-area');
        const resultDiv = document.getElementById('prediction-result');
        
        postArea.style.display = 'block';
        resultDiv.style.color = "#00ffcc";
        resultDiv.innerText = "Calculating Post-Toss Impact...";

        try {
            const response = await fetch(`${BACKEND_URL}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    match_type: matchType, team1: team1, team2: team2, venue: venue,
                    toss_winner: tossWinner, toss_decision: tossDecision
                })
            });
            
            const prediction = await response.json();
            
            if(prediction.success) {
                const p1 = prediction.predictions[team1];
                const p2 = prediction.predictions[team2];
                
                let html = `
                    <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
                        <span style="color:#00ffcc;">${team1}: <b>${p1}</b></span>
                        <span style="color:#ff4d4d;">${team2}: <b>${p2}</b></span>
                    </div>
                `;
                
                if(window.neutralPred) {
                    const preP1 = parseFloat(window.neutralPred[team1]);
                    const preP2 = parseFloat(window.neutralPred[team2]);
                    const postP1 = parseFloat(p1);
                    const postP2 = parseFloat(p2);
                    
                    const diff1 = (postP1 - preP1).toFixed(1);
                    const diff2 = (postP2 - preP2).toFixed(1);
                    
                    let impactColor1 = diff1 > 0 ? '#22c55e' : (diff1 < 0 ? '#ef4444' : '#94a3b8');
                    let impactColor2 = diff2 > 0 ? '#22c55e' : (diff2 < 0 ? '#ef4444' : '#94a3b8');
                    let sign1 = diff1 > 0 ? '+' : '';
                    let sign2 = diff2 > 0 ? '+' : '';

                    html += `<div style="font-size:12px; color:#94a3b8; margin-top:10px; border-top:1px solid #334155; padding-top:10px;">Toss Impact:</div>`;
                    html += `
                        <div style="display:flex; justify-content:space-between; font-size:12px; margin-top:5px;">
                            <span style="color:${impactColor1};">${team1} (${sign1}${diff1}%)</span>
                            <span style="color:${impactColor2};">${team2} (${sign2}${diff2}%)</span>
                        </div>
                    `;
                }

                if (prediction.is_default) {
                    html += `<div style="color:#fbbf24; font-size:12px; margin-top:10px;">⚠️ Model lacks data for this team/venue.</div>`;
                }
                
                resultDiv.innerHTML = html;
            } else {
                resultDiv.style.color = "#ff4d4d";
                resultDiv.innerText = `Error: ${prediction.detail || "Failed"}`;
            }
        } catch (error) {
            resultDiv.style.color = "#ff4d4d";
            resultDiv.innerText = "Backend connection error.";
        }
    };
}

// --- INITIALIZE ---
document.addEventListener("DOMContentLoaded", fetchMatches);
