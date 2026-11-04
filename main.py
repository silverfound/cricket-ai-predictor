from fastapi import FastAPI, HTTPException
import joblib
import pandas as pd
import numpy as np
from pydantic import BaseModel

app = FastAPI(title="Cricket Match Predictor API")

# 1. Saved Models aur Elo Ratings Load Karein
models = joblib.load('cricket_ensemble_modern.joblib')
elo_ratings = joblib.load('latest_elo_ratings.joblib')

DEFAULT_ELO = 1500

class MatchRequest(BaseModel):
    match_type: str        # 'T20', 'ODI', 'Test'
    team1: str             # e.g., 'Pakistan'
    team2: str             # e.g., 'Australia'
    venue: str             # ground name
    toss_winner: str       # e.g., 'Pakistan'
    toss_decision: str     # 'bat' ya 'field'

def get_elo(team_name: str) -> float:
    return elo_ratings.get(team_name, DEFAULT_ELO)

@app.get("/")
def home():
    return {"status": "Online", "message": "Cricket AI Win Predictor API Active"}

@app.post("/predict")
def predict_match(match: MatchRequest):
    try:
        t1_elo = get_elo(match.team1)
        t2_elo = get_elo(match.team2)
        
        toss_win_t1 = 1 if match.toss_winner == match.team1 else 0
        
        input_data = pd.DataFrame([{
            'match_type': str(match.match_type),
            'team1': str(match.team1),
            'team2': str(match.team2),
            'venue': str(match.venue),
            'toss_decision': str(match.toss_decision),
            'team1_elo': float(t1_elo),
            'team2_elo': float(t2_elo),
            'toss_win_team1': int(toss_win_t1),
            'team1_form': 0.60,
            'team2_form': 0.60,
            'h2h_team1_ratio': 0.50,
            'venue_form_t1': 0.50,
            'venue_form_t2': 0.50
        }])
        
        cat_cols = ['match_type', 'team1', 'team2', 'venue', 'toss_decision']
        for col in cat_cols:
            input_data[col] = input_data[col].astype('category')

        cat_p = models['cat'].predict_proba(input_data)[0]
        xgb_p = models['xgb'].predict_proba(input_data)[0]
        lgb_p = models['lgb'].predict_proba(input_data)[0]

        final_probs = (cat_p + xgb_p + lgb_p) / 3.0
        
        team1_win_pct = round(float(final_probs[1]) * 100, 2)
        team2_win_pct = round(float(final_probs[0]) * 100, 2)

        return {
            "success": True,
            "match": f"{match.team1} vs {match.team2}",
            "venue": match.venue,
            "predictions": {
                match.team1: f"{team1_win_pct}%",
                match.team2: f"{team2_win_pct}%"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
      
