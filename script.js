const RAPIDAPI_KEY = "4c9925dbd4msh3c9b1d0ff0489b3p13b539jsn1ef2f7968fc4";
const RAPIDAPI_HOST = "cricket-live-line-advance.p.rapidapi.com";
const BACKEND_URL = "https://cricket-ai-predictor-ciat.onrender.com"; 

let liveMatches = [], upcomingMatches = [], finishedMatches = [], currentTab = 'live';

// --- POPUP HTML ---
const popupHTML = `
<div id="prediction-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; align-items:center; justify-content:center;">
    <div style="background:#131b2e; padding:20px; border-radius:12px; width:90%; max-width:400px; border:1px solid #00ffcc; max-height: 90vh; overflow-y: auto;">
        <h3 style="color:#00ffcc; margin-top:0;">Match Prediction</h3>
        <p id="modal-match-name" style="color:white; font-weight:bold;"></p>
        <p id="modal-venue" style="color:#94a3b8; font-size:12px; margin-top:-10px; margin-bottom:15px;"></p>
        <div id="pre-toss-area" style="background: #0f172a; padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #334155;">
            <p style="color: #fbbf24; margin: 0 0 5px 0; font-size: 12px; font-weight: bold;">📊 Pre-Toss Neutral Prediction</p>
            <div id="pre-toss-result" style="color: white; font-size: 14px;">Calculating...</div>
        </div>
        <label style="color:#94a3b8; font-size:14px;">Toss Winner:</label>
        <select id="toss-winner" style="width:100%; padding:8px; margin-bottom:10px; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px;"></select>
        <label style="color:#94a3b8; font-size:14px;">Toss Decision:</label>
        <select id="toss-decision" style="width:100%; padding:8px; margin-bottom:15px; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px;">
            <option value="bat">Bat First</option><option value="field">Field First</option>
        </select>
        <button id="get-prediction-btn" style="width:100%; padding:10px; background:#00ffcc; color:black; font-weight:bold; border:none; border-radius:6px; cursor:pointer;">Calculate Post-Toss Impact</button>
        <button onclick="document.getElementById('prediction-modal').style.display='none'" style="width:100%; padding:10px; background:transparent; color:#ff4d4d; border:none; margin-top:10px; cursor:pointer;">Cancel</button>
        <div id="post-toss-area" style="display:none; margin-top:15px; padding: 10px; border-radius: 8px; border: 1px solid #00ffcc; background: #0b1120;">
            <p style="color: #00ffcc; margin: 0 0 5px 0; font-size: 12px; font-weight: bold;">🎯 Post-Toss Prediction & Impact</p>
            <div id="prediction-result" style="color:white; text-align:center; font-weight:bold;"></div>
        </div>
    </div>
</div>`;
document.body.insertAdjacentHTML('beforeend', popupHTML);

function wakeUpBackend() {
    fetch(`${BACKEND_URL}/`).catch(() => {});
}

function getFormattedDate(offset) {
    let d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().split('T')[0];
}

async function fetchMatches(forceRefresh = false) {
    let container = document.getElementById("dynamic-prediction-area");
    
    let tabsHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 5px;">
                <button id="tab-live" onclick="switchTab('live')" style="padding: 8px 12px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; background: #00ffcc; color: #000;">🔴 Live</button>
                <button id="tab-upcoming" onclick="switchTab('upcoming')" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #334155; font-weight: bold; cursor: pointer; background: #131b2e; color: white;">⏳ Upcoming</button>
                <button id="tab-finished" onclick="switchTab('finished')" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #334155; font-weight: bold; cursor: pointer; background: #131b2e; color: white;">✅ Finished</button>
            </div>
            <button onclick="fetchMatches(true)" style="background: transparent; color: #00ffcc; border: 1px solid #00ffcc; padding: 8px 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">🔄 Refresh</button>
        </div>
        <div id="matches-container"></div>`;
    
    if (!document.getElementById('tab-live')) {
        container.innerHTML = tabsHTML;
    }

    let matchesContainer = document.getElementById("matches-container");
    matchesContainer.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Fetching Latest Data...</h3>`;

    const today = getFormattedDate(0), tomorrow = getFormattedDate(1);
    const cacheKeyToday = `cricket_data_v9_${today}`; 
    const cacheKeyTomorrow = `cricket_data_v9_${tomorrow}`;
    const cacheExpiry = 10 * 60 * 1000; 

    let allMatches = [];

    try {
        if (forceRefresh) {
            localStorage.removeItem(cacheKeyToday);
            localStorage.removeItem(cacheKeyTomorrow);
        }

        for (let date of [today, tomorrow]) {
            let cacheKey = date === today ? cacheKeyToday : cacheKeyTomorrow;
            let cachedData = localStorage.getItem(cacheKey);
            let fetchNeeded = true;

            if (cachedData && !forceRefresh) {
                let parsed = JSON.parse(cachedData);
                if (Date.now() - parsed.time < cacheExpiry && parsed.data.length > 0) {
                    allMatches.push(...parsed.data);
                    fetchNeeded = false;
                }
            }
            
            if (fetchNeeded) {
                const res = await fetch(`https://${RAPIDAPI_HOST}/matches?date=${date}&_nocache=${Date.now()}`, {
                    headers: { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": RAPIDAPI_HOST },
                    cache: "no-store"
                });
                
                if(res.ok) {
                    const data = await res.json();
                    const items = data.response?.items || [];
                    if (items.length > 0) {
                        allMatches.push(...items);
                        localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data: items }));
                    }
                }
            }
        }

        liveMatches = []; upcomingMatches = []; finishedMatches = [];
        let seen = new Set();

        allMatches.forEach(m => {
            if (!m.teama || !m.teamb) return;
            let fmt = (m.format_str || '').toLowerCase(), isDom = m.domestic === "1";
            if (fmt.includes('first class') && isDom) return; 
            if (fmt.includes('odi') && isDom) return;

            if (seen.has(m.timestamp_start + m.teama.name + m.teamb.name)) return;
            seen.add(m.timestamp_start + m.teama.name + m.teamb.name);

            // --- FIX: API KE EXACT STATUS KE MUTABIQ ---
            let status = (m.status_str || '').toLowerCase();
            
            if (status.includes('completed') || status.includes('finish') || status.includes('result') || status.includes('won') || status.includes('draw') || status.includes('abandon')) {
                finishedMatches.push(m);
            } else if (status.includes('live') || status.includes('progress') || status.includes('break') || status.includes('stumps') || status.includes('innings')) {
                liveMatches.push(m);
            } else {
                // Scheduled ya Not Started
                upcomingMatches.push(m);
            }
        });

        upcomingMatches.sort((a,b) => a.timestamp_start - b.timestamp_start);
        finishedMatches.sort((a,b) => b.timestamp_start - a.timestamp_start);
        
        switchTab(liveMatches.length > 0 ? 'live' : 'upcoming');
        
    } catch (e) {
        matchesContainer.innerHTML = `<div style="color:red; text-align:center;">Error: ${e.message}</div>`;
    }
}

function switchTab(tab) {
    currentTab = tab;
    ['live','upcoming','finished'].forEach(t => {
        let el = document.getElementById('tab-'+t);
        if(!el) return;
        el.style.background = t === tab ? '#00ffcc' : '#131b2e';
        el.style.color = t === tab ? '#000' : 'white';
        el.style.border = t === tab ? 'none' : '1px solid #334155';
    });
    
    let matchesToRender = [];
    if (tab === 'live') matchesToRender = liveMatches;
    if (tab === 'upcoming') matchesToRender = upcomingMatches;
    if (tab === 'finished') matchesToRender = finishedMatches;
    
    renderMatches(matchesToRender);
}

function renderMatches(matches) {
    let container = document.getElementById("matches-container");
    if (!matches.length) {
        container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding: 20px;">Is category mein filhal koi match nahi hai. Refresh dabayein.</div>`;
        return;
    }
    let html = "";
    matches.forEach(m => {
        let fmt = m.format_str || "T20";
        let matchType = "T20";
        if (fmt.toLowerCase().includes("test") || fmt.toLowerCase().includes("first class")) matchType = "Test";
        else if (fmt.toLowerCase().includes("odi") || fmt.toLowerCase().includes("list a")) matchType = "ODI";

        let time = new Date(m.timestamp_start * 1000).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        let statusText = currentTab === 'live' ? `<p style="color: #ff4d4d; margin: 0 0 5px 0; font-size: 0.85rem; font-weight: bold;">🔴 LIVE</p>` : '';
        
        // Agar Finished hai, toh API ka note (jeetne ka margin) dikhayein
        if (currentTab === 'finished' && m.status_note) {
            statusText = `<p style="color: #00ffcc; margin: 0 0 5px 0; font-size: 0.85rem; font-weight: bold;">${m.status_note}</p>`;
        }

        html += `
            <div style="background: #131b2e; padding: 15px; margin: 10px 0; border-radius: 12px; border: 1px solid rgba(0,255,204,0.2);">
                <p style="color: #00ffcc; font-size: 0.8rem; margin: 0 0 5px 0;">${m.competition?.title.toUpperCase() || 'MATCH'} | ${matchType}</p>
                <h4 style="color: #fff; margin: 0 0 5px 0;">${m.teama.name} vs ${m.teamb.name}</h4>
                <p style="color: #cbd5e1; font-size: 0.85rem; margin: 0 0 5px 0;">🏟️ ${m.venue?.name || 'Unknown'}</p>
                ${statusText}
                <p style="color: #fbbf24; font-size: 0.85rem; margin: 0 0 10px 0;">📅 ${time}</p>
                ${currentTab !== 'finished' ? `<button onclick="openPredictModal('${m.teama.name}', '${m.teamb.name}', '${m.venue?.name || ''}', '${matchType}')" style="width: 100%; padding: 8px; background: #00ffcc; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">🔮 Predict Winner</button>` : ''}
            </div>`;
    });
    container.innerHTML = html;
}

async function openPredictModal(t1, t2, venue, type) {
    document.getElementById('prediction-modal').style.display = 'flex';
    document.getElementById('modal-match-name').innerText = `${t1} vs ${t2} (${type})`;
    document.getElementById('modal-venue').innerText = `🏟️ ${venue}`;
    document.getElementById('post-toss-area').style.display = 'none';
    document.getElementById('toss-winner').innerHTML = `<option value="${t1}">${t1}</option><option value="${t2}">${t2}</option>`;

    let preDiv = document.getElementById('pre-toss-result');
    preDiv.innerText = "Calculating Neutral Baseline...";
    window.prePred = null;

    try {
        const res = await fetch(`${BACKEND_URL}/predict`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ match_type: type, team1: t1, team2: t2, venue })
        });
        const pred = await res.json();
        if (pred.success) {
            window.prePred = pred.predictions;
            preDiv.innerHTML = `<div style="display:flex; justify-content:space-between;"><span style="color:#00ffcc;">${t1}: <b>${pred.predictions[t1]}</b></span><span style="color:#ff4d4d;">${t2}: <b>${pred.predictions[t2]}</b></span></div>`;
        }
    } catch (e) { preDiv.innerText = "Error loading prediction."; }

    document.getElementById('get-prediction-btn').onclick = async () => {
        const tw = document.getElementById('toss-winner').value;
        const td = document.getElementById('toss-decision').value;
        let postDiv = document.getElementById('prediction-result');
        
        document.getElementById('post-toss-area').style.display = 'block';
        postDiv.innerHTML = "Calculating Post-Toss Impact...";

        try {
            const res = await fetch(`${BACKEND_URL}/predict`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ match_type: type, team1: t1, team2: t2, venue, toss_winner: tw, toss_decision: td })
            });
            const pred = await res.json();
            if (pred.success) {
                const p1 = pred.predictions[t1], p2 = pred.predictions[t2];
                let html = `<div style="display:flex; justify-content:space-between; margin-bottom:10px;"><span style="color:#00ffcc;">${t1}: <b>${p1}</b></span><span style="color:#ff4d4d;">${t2}: <b>${p2}</b></span></div>`;
                
                if (window.prePred) {
                    const d1 = (parseFloat(p1) - parseFloat(window.prePred[t1])).toFixed(1);
                    const d2 = (parseFloat(p2) - parseFloat(window.prePred[t2])).toFixed(1);
                    html += `<div style="font-size:12px; border-top:1px solid #334155; padding-top:10px;">Toss Impact:</div>
                             <div style="display:flex; justify-content:space-between; font-size:12px;">
                                <span style="color:${d1>0?'#22c55e':(d1<0?'#ef4444':'#94a3b8')}">${t1} (${d1>0?'+':''}${d1}%)</span>
                                <span style="color:${d2>0?'#22c55e':(d2<0?'#ef4444':'#94a3b8')}">${t2} (${d2>0?'+':''}${d2}%)</span>
                             </div>`;
                }
                postDiv.innerHTML = html;
            }
        } catch (e) { postDiv.innerText = "Error calculating impact."; }
    };
}

document.addEventListener("DOMContentLoaded", () => {
    wakeUpBackend(); 
    fetchMatches();
});
