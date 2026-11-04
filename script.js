// Cricket AI Pro - Updated Live API Fetch Script (New API with Filter)

const API_KEY = "oc_live_6j4o4fJnnWL0NRrjzdpVL3SZCX2Zk4Jx"; 
const BASE_URL = "https://opencricketapi.com/v1";

const headers = {
    "Authorization": `Bearer ${API_KEY}`, 
    "Accept": "application/json"
};

async function fetchRealApiMatches() {
    let container = document.getElementById("dynamic-prediction-area");
    if (!container) return;

    container.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Fetching Upcoming Matches...</h3>`;

    try {
        // API call
        const response = await fetch(`${BASE_URL}/matches`, { headers });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("API Response:", data);
        
        // Asli data ko render karein
        renderRealMatches(data, container);

    } catch (error) {
        console.error("Fetch error:", error);
        container.innerHTML = `
            <div style="background: #131b2e; padding: 15px; border-radius: 12px; border: 1px solid #ff4d4d;">
                <h3 style="color: #ff4d4d; margin: 0 0 5px 0;">API Connection Notice</h3>
                <p style="color: #94a3b8; margin: 0;">API se data connect hone mein masla aa raha hai. Error: ${error.message}</p>
            </div>
        `;
    }
}

function renderRealMatches(data, container) {
    // API se aaya hua data nikalna
    let matches = Array.isArray(data) ? data : (data.data || data.matches || []);
    
    // 1. FILTER: Sirf wo matches rakhein jinka result nahi aaya (yani upcoming hain)
    // Agar match.result mojood hai, iska matlab match khatam ho chuka hai.
    matches = matches.filter(match => !match.result);

    // 2. SORT: Matches ko date ke hisaab se sort karein (jo pehle hoga wo upar aayega)
    matches.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (matches.length === 0) {
        container.innerHTML = `
            <div style="background: #131b2e; padding: 15px; border-radius: 12px; border: 1px solid #00ffcc;">
                <h3 style="color: #00ffcc; margin: 0 0 5px 0;">No Upcoming Matches</h3>
                <p style="color: #94a3b8; margin: 0;">API ki taraf se abhi koi aane wala match return nahi hua.</p>
            </div>
        `;
        return;
    }

    let htmlContent = `<h3 style="color: #00ffcc; margin-bottom: 12px;">🏏 Upcoming Fixtures</h3>`;
    
    matches.forEach(match => {
        const team1 = match.teams && match.teams[0] ? match.teams[0].name : "Team 1";
        const team2 = match.teams && match.teams[1] ? match.teams[1].name : "Team 2";
        const competition = match.competition ? match.competition.name : "Cricket Match";
        const stage = match.stage || "";
        const matchDate = match.date || "TBD";
        const matchFormat = match.format || "T20";

        // Card design
        htmlContent += `
            <div style="background: #131b2e; padding: 15px; margin: 10px 0; border-radius: 12px; border: 1px solid rgba(0,255,204,0.4);">
                <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 1.1rem;">${team1} vs ${team2}</h4>
                <p style="color: #00ffcc; margin: 0 0 5px 0; font-size: 0.95rem;">Status: <strong>Upcoming</strong></p>
                <p style="color: #94a3b8; margin: 0 0 5px 0; font-size: 0.85rem;">Tournament: ${competition} ${stage ? '('+stage+')' : ''}</p>
                <p style="color: #94a3b8; margin: 0; font-size: 0.85rem;">Format: ${matchFormat} | Date: ${matchDate}</p>
            </div>
        `;
    });
    
    container.innerHTML = htmlContent;
}

document.addEventListener("DOMContentLoaded", fetchRealApiMatches);
