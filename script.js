// Cricket AI Pro - Frontend Script
// OpenCricket API Integration (Starter Plan Compatible)

const API_KEY = "Oc_live_6j4o4fJnnWL0NRrjzdpVL3SZCX2Zk4Jx";
const BASE_URL = "https://api.open-cricket.v1/v1"; // Apne route ke mutabiq base URL check kar lein

// Headers with API Key
const headers = {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
};

// 1. Fetch Historical Matches & Scorecards (Last 12 Months)
async function fetchHistoricalMatches() {
    try {
        const response = await fetch(`${BASE_URL}/matches`, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Historical Matches Data:", data);
        displayMatches(data);
    } catch (error) {
        console.error("Error fetching historical matches:", error);
        showError("Historical data load karne mein masla aa raha hai.");
    }
}

// 2. Search Team or Player Profiles for Prediction Analysis
async function searchEntity(query) {
    try {
        const response = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query)}`, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Search Results:", data);
        return data;
    } catch (error) {
        console.error("Error searching profile:", error);
    }
}

// UI Display Functions (Aap apne HTML ke mutabiq inhe adjust kar sakte hain)
function displayMatches(data) {
    const container = document.getElementById("match-container");
    if (!container) return;
    
    container.innerHTML = "";
    // Yahan data ko loop kar ke UI par show kar sakte hain
}

function showError(message) {
    const container = document.getElementById("error-container");
    if (container) {
        container.innerText = message;
    }
}

// Page load hone par historical data fetch karein
document.addEventListener("DOMContentLoaded", () => {
    fetchHistoricalMatches();
});
