from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import joblib
import pandas as pd
import numpy as np
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Cricket Match Predictor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models = joblib.load('cricket_ensemble_modern.joblib')
elo_ratings = joblib.load('latest_elo_ratings.joblib')

DEFAULT_ELO = 1500

class MatchRequest(BaseModel):
    match_type: str
    team1: str             
    team2: str             
    venue: str             
    toss_winner: Optional[str] = None  
    toss_decision: Optional[str] = None 

def get_elo(team_name: str) -> float:
    return elo_ratings.get(team_name, DEFAULT_ELO)

@app.get("/")
def home():
    return {"status": "Online", "message": "Cricket AI Win Predictor API Active"}

def calculate_single_prediction(match, t_winner, t_decision):
    t1_elo = get_elo(match.team1)
    t2_elo = get_elo(match.team2)
    toss_win_t1 = 1 if t_winner == match.team1 else 0
    
    input_data = pd.DataFrame([{
        'match_type': str(match.match_type),
        'team1': str(match.team1),
        'team2': str(match.team2),
        'venue': str(match.venue),
        'toss_decision': str(t_decision),
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
        input_data[col] = input_data[col].astype(str)

    cat_p = models['cat'].predict_proba(input_data)[0]
    xgb_p = models['xgb'].predict_proba(input_data)[0]
    lgb_p = models['lgb'].predict_proba(input_data)[0]

    final_probs = (cat_p + xgb_p + lgb_p) / 3.0
    return float(final_probs[1]), float(final_probs[0]) 

@app.post("/predict")
def predict_match(match: MatchRequest):
    try:
        if not match.toss_winner or not match.toss_decision:
            t1_wins, t2_wins = [], []
            scenarios = [
                (match.team1, 'bat'), (match.team1, 'field'),
                (match.team2, 'bat'), (match.team2, 'field')
            ]
            
            for winner, decision in scenarios:
                w1, w2 = calculate_single_prediction(match, winner, decision)
                t1_wins.append(w1)
                t2_wins.append(w2)
                
            avg_t1 = np.mean(t1_wins)
            avg_t2 = np.mean(t2_wins)
            
            return {
                "success": True,
                "is_default": False,
                "predictions": {
                    match.team1: f"{round(avg_t1 * 100, 2)}%",
                    match.team2: f"{round(avg_t2 * 100, 2)}%"
                }
            }

        else:
            t1_win, t2_win = calculate_single_prediction(match, match.toss_winner, match.toss_decision)
            return {
                "success": True,
                "is_default": False,
                "predictions": {
                    match.team1: f"{round(t1_win * 100, 2)}%",
                    match.team2: f"{round(t2_win * 100, 2)}%"
                }
            }
            
    except Exception as e:
        return {
            "success": True,
            "is_default": True,
            "predictions": {
                match.team1: "50.0%",
                match.team2: "50.0%"
            }
        }
