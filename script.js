// Cricket AI Pro - Frontend Script (OpenCricket API Starter Plan Compatible)
const API_KEY = "Oc_live_6j4o4fJnnWL0NRrjzdpVL3SZCX2Zk4Jx";
const BASE_URL = "https://api.opencricketcodes.com/v1"; // Or respective Starter endpoint

async function fetchCricketData(endpoint) {
    try {
        const response = await `${BASE_URL}/${endpoint}?apikey=${API_KEY}`;
        // Fetch logic placeholder for historical matches, stats & player profiles
        console.log("Fetching data securely...");
    } catch (error) {
        console.error("API Error:", error);
    }
}

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    console.log("Cricket AI Pro initialized successfully.");
});
