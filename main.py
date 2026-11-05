from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import joblib, pandas as pd, numpy as np
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Cricket AI Win Predictor API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Models load karein
models = joblib.load('cricket_ensemble_modern.joblib')
elo_ratings = joblib.load('latest_elo_ratings.joblib')
cat_mappings = joblib.load('category_mappings.joblib') # Naya mappings file load kiya
DEFAULT_ELO = 1500

class MatchRequest(BaseModel):
    match_type: str
    team1: str             
    team2: str             
    venue: str             
    toss_winner: Optional[str] = None  
    toss_decision: Optional[str] = None 

def get_elo(team_name: str) -> float:
    if team_name in elo_ratings: return elo_ratings[team_name]
    for k in elo_ratings:
        if k.lower() == team_name.lower(): return elo_ratings[k]
    return DEFAULT_ELO

def calculate_prediction(match, t_winner, t_decision):
    t1_elo = get_elo(match.team1)
    t2_elo = get_elo(match.team2)
    toss_win_t1 = 1 if t_winner == match.team1 else 0
    venue_clean = str(match.venue).split(',')[0].strip()

    base_data = {
        'match_type': str(match.match_type), 'team1': str(match.team1), 'team2': str(match.team2),
        'venue': str(venue_clean), 'toss_decision': str(t_decision),
        'team1_elo': float(t1_elo), 'team2_elo': float(t2_elo),
        'toss_win_team1': int(toss_win_t1),
        'team1_form': 0.60, 'team2_form': 0.60, 'h2h_team1_ratio': 0.50
    }
    
    try:
        input_df = pd.DataFrame([base_data])
        cat_cols = ['match_type', 'team1', 'team2', 'venue', 'toss_decision']
        
        # --- SMART UNKNOWN HANDLING (Crash-proof) ---
        for col in cat_cols:
            if input_df[col].iloc[0] not in cat_mappings[col]:
                input_df[col] = "__UNKNOWN__"
            input_df[col] = pd.Categorical(input_df[col], categories=cat_mappings[col])

        # Sirf CatBoost aur LightGBM (No XGBoost)
        cat_p = models['cat'].predict_proba(input_df)[0]
        lgb_p = models['lgb'].predict_proba(input_df)[0]
        
        final_probs = (cat_p + lgb_p) / 2.0
        return float(final_probs[1]), float(final_probs[0]), False
        
    except Exception as e:
        print(f"Fallback to Elo: {e}")
        exp_t1 = 1 / (1 + 10**((t2_elo - t1_elo) / 400))
        return exp_t1, (1 - exp_t1), True

@app.get("/")
def home():
    return {"status": "Online", "message": "Cricket AI Win Predictor API Active"}

@app.post("/predict")
def predict_match(match: MatchRequest):
    if not match.toss_winner or not match.toss_decision:
        t1_wins, t2_wins, is_fb = [], [], False
        for w, d in [(match.team1, 'bat'), (match.team1, 'field'), (match.team2, 'bat'), (match.team2, 'field')]:
            w1, w2, fb = calculate_prediction(match, w, d)
            t1_wins.append(w1); t2_wins.append(w2)
            if fb: is_fb = True
        return {"success": True, "is_default": is_fb, "predictions": {match.team1: f"{round(np.mean(t1_wins)*100, 2)}%", match.team2: f"{round(np.mean(t2_wins)*100, 2)}%"}}
    else:
        t1_win, t2_win, is_fb = calculate_prediction(match, match.toss_winner, match.toss_decision)
        return {"success": True, "is_default": is_fb, "predictions": {match.team1: f"{round(t1_win*100, 2)}%", match.team2: f"{round(t2_win*100, 2)}%"}}
