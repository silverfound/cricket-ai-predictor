// Cricket AI Pro - Pure Live API Fetch Script
const API_KEY = "Oc_live_6j4o4fJnnWL0NRrjzdpVL3SZCX2Zk4Jx";
const BASE_URL = "https://api.opencricketcodes.com/v1";

const headers = {
    "Authorization": `Bearer ${API_KEY}`, 
    "Content-Type": "application/json"
};

async function fetchRealApiMatches() {
    let container = document.getElementById("dynamic-prediction-area");
    if (!container) return;

    container.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Fetching Live Matches from API...</h3>`;

    try {
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
    const matches = Array.isArray(data) ? data : (data.matches || data.data || []);
    
    if (matches.length === 0) {
        container.innerHTML = `
            <div style="background: #131b2e; padding: 15px; border-radius: 12px; border: 1px solid #00ffcc;">
                <h3 style="color: #00ffcc; margin: 0 0 5px 0;">No Matches Found</h3>
                <p style="color: #94a3b8; margin: 0;">API ki taraf se abhi koi active ya upcoming match return nahi hua.</p>
            </div>
        `;
        return;
    }

    let htmlContent = `<h3 style="color: #00ffcc; margin-bottom: 12px;">🏏 Live & Upcoming Fixtures (API Feed)</h3>`;
    
    matches.forEach(match => {
        htmlContent += `
            <div style="background: #131b2e; padding: 15px; margin: 10px 0; border-radius: 12px; border: 1px solid rgba(0,255,204,0.4);">
                <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 1.1rem;">${match.name || match.title || match.match_name || 'Cricket Match'}</h4>
                <p style="color: #00ffcc; margin: 0 0 5px 0; font-size: 0.95rem;">Status: <strong>${match.status || 'Scheduled'}</strong></p>
                <p style="color: #94a3b8; margin: 0; font-size: 0.85rem;">Format: ${match.format || 'T20 / ODI'}</p>
            </div>
        `;
    });
    
    container.innerHTML = htmlContent;
}

document.addEventListener("DOMContentLoaded", fetchRealApiMatches);
