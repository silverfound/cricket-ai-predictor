// Cricket AI Pro - Live & Upcoming Matches Script
const API_KEY = "Oc_live_6j4o4fJnnWL0NRrjzdpVL3SZCX2Zk4Jx";
const BASE_URL = "https://api.opencricketcodes.com/v1";

const headers = {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
};

async function fetchUpcomingMatches() {
    let container = document.getElementById("dynamic-prediction-area");
    if (!container) return;

    container.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Upcoming Matches Fetch ho rahe hain...</h3>`;

    try {
        // Upcoming ya live matches ka endpoint call karein
        const response = await fetch(`${BASE_URL}/matches?status=upcoming,live`, { headers });
        if (!response.ok) throw new Error("API Connection Failed");
        
        const data = await response.json();
        renderUpcomingMatches(data, container);
    } catch (error) {
        console.error("Error fetching upcoming matches:", error);
        container.innerHTML = `
            <div style="background: #131b2e; padding: 15px; border-radius: 12px; border: 1px solid #ff4d4d;">
                <h3 style="color: #ff4d4d; margin: 0 0 5px 0;">Live Data Connection Notice</h3>
                <p style="color: #94a3b8; margin: 0;">Filhal upcoming matches ki live feed synchronize ho rahi hai. Jaise hi naye fixtures update honge, yahan show ho jayenge.</p>
            </div>
        `;
    }
}

function renderUpcomingMatches(data, container) {
    const matches = Array.isArray(data) ? data : (data.matches || []);
    
    if (matches.length === 0) {
        container.innerHTML = `
            <div style="background: #131b2e; padding: 15px; border-radius: 12px; border: 1px solid #00ffcc;">
                <h3 style="color: #00ffcc; margin: 0 0 5px 0;">No Upcoming Matches Found</h3>
                <p style="color: #94a3b8; margin: 0;">Abhi koi naya match schedule mein nahi hai. Jaise hi match announce hoga, prediction yahan ajayegi.</p>
            </div>
        `;
        return;
    }

    let htmlContent = `<h3 style="color: #00ffcc; margin-bottom: 12px;">📅 Upcoming & Live Matches (AI Predictor)</h3>`;
    
    matches.forEach(match => {
        htmlContent += `
            <div style="background: #131b2e; padding: 15px; margin: 10px 0; border-radius: 12px; border: 1px solid rgba(0,255,204,0.4); box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 1.1rem;">${match.name || match.title || 'Cricket Fixture'}</h4>
                <p style="color: #00ffcc; margin: 0 0 5px 0; font-size: 0.95rem;">Status: <strong>${match.status || 'Upcoming'}</strong></p>
                <p style="color: #94a3b8; margin: 0; font-size: 0.85rem;">Venue: ${match.venue || 'International Ground'}</p>
            </div>
        `;
    });
    
    container.innerHTML = htmlContent;
}

document.addEventListener("DOMContentLoaded", fetchUpcomingMatches);
