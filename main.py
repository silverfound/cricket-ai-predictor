from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import joblib, pandas as pd, numpy as np
import os, requests, time
from threading import Lock
from pydantic import BaseModel
from typing import Optional
from licensing import router as licensing_router, init_db, require_license

app = FastAPI(title="Cricket AI Win Predictor API")
app.include_router(licensing_router)
@app.on_event("startup")
def startup_license_db(): init_db()
# Exact browser origins are configured by the deployment environment.
# Example: CORS_ALLOWED_ORIGINS=https://silverfound.github.io
_cors_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:5500").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Device-ID", "X-Admin-Key"],
)

models = joblib.load('cricket_ensemble_modern.joblib')
elo_ratings = joblib.load('latest_elo_ratings.joblib')
cat_mappings = joblib.load('category_mappings.joblib')
toss_stats = joblib.load('toss_stats.joblib')
DEFAULT_ELO = 1500

class MatchRequest(BaseModel):
    match_type: str
    team1: str             
    team2: str             
    venue: str             
    toss_winner: Optional[str] = None  
    toss_decision: Optional[str] = None
    match_id: str
    competition: str

def get_elo(team_name: str) -> float:
    if team_name in elo_ratings: return elo_ratings[team_name]
    for k in elo_ratings:
        if k.lower() == team_name.lower(): return elo_ratings[k]
    return DEFAULT_ELO

def get_toss_rates(venue, toss_decision):
    v = str(venue).split(',')[0].strip()
    v_tot = toss_stats['v_tw_tot'].get(v, 0)
    v_win = toss_stats['v_tw_wins'].get(v, 0)
    tw_rate = (v_win / v_tot) if v_tot > 0 else 0.5

    if toss_decision == 'bat':
        b_tot = toss_stats['v_bat_tot'].get(v, 0)
        b_win = toss_stats['v_bat_wins'].get(v, 0)
        td_rate = (b_win / b_tot) if b_tot > 0 else 0.5
    else:
        f_tot = toss_stats['v_fld_tot'].get(v, 0)
        f_win = toss_stats['v_fld_wins'].get(v, 0)
        td_rate = (f_win / f_tot) if f_tot > 0 else 0.5

    return tw_rate, td_rate

def calculate_prediction(match, t_winner, t_decision):
    t1_elo = get_elo(match.team1)
    t2_elo = get_elo(match.team2)
    toss_win_t1 = 1 if t_winner == match.team1 else 0
    venue_clean = str(match.venue).split(',')[0].strip()
    
    tw_rate, td_rate = get_toss_rates(venue_clean, t_decision)

    base_data = {
        'match_type': str(match.match_type), 'team1': str(match.team1), 'team2': str(match.team2),
        'venue': str(venue_clean), 'toss_decision': str(t_decision),
        'team1_elo': float(t1_elo), 'team2_elo': float(t2_elo),
        'toss_win_team1': int(toss_win_t1),
        'team1_form': 0.60, 'team2_form': 0.60, 'h2h_team1_ratio': 0.50,
        'toss_winner_win_rate': float(tw_rate), 'toss_decision_win_rate': float(td_rate)
    }
    
    try:
        input_df = pd.DataFrame([base_data])
        cat_cols = ['match_type', 'team1', 'team2', 'venue', 'toss_decision']
        
        for col in cat_cols:
            if input_df[col].iloc[0] not in cat_mappings[col]:
                input_df[col] = "__UNKNOWN__"
            cats = cat_mappings[col]
            if "__UNKNOWN__" not in cats: cats = cats + ["__UNKNOWN__"]
            input_df[col] = pd.Categorical(input_df[col], categories=cats)

        cat_p = models['cat'].predict_proba(input_df)[0]
        lgb_p = models['lgb'].predict_proba(input_df)[0]
        final_probs = (cat_p + lgb_p) / 2.0
        return float(final_probs[1]), float(final_probs[0]), False
        
    except Exception as e:
        print(f"Fallback: {e}")
        exp_t1 = 1 / (1 + 10**((t2_elo - t1_elo) / 400))
        return exp_t1, (1 - exp_t1), True

@app.get("/")
def home():
    return {"status": "Online", "message": "Cricket AI Win Predictor API Active"}

# Shared process-level cache: all visitors to this backend reuse the same
# provider response for the same date/page instead of spending one RapidAPI
# request per visitor. Manual browser refreshes do not bypass this cache.
MATCHES_CACHE_TTL_SECONDS = 300
MATCHES_STALE_MAX_SECONDS = 1800
_matches_cache = {}
_matches_cache_lock = Lock()
_matches_key_locks = {}


@app.get("/matches")
def get_matches(date: str, per_paged: int = 10, paged: int = 1, _nocache: Optional[str] = None, license=Depends(require_license)):
    """Cached server-side proxy for the RapidAPI cricket matches feed."""
    api_key = os.getenv("RAPIDAPI_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Cricket matches provider is not configured")

    # Validate pagination to prevent accidental/unbounded provider requests.
    per_paged = max(1, min(int(per_paged), 50))
    paged = max(1, min(int(paged), 100))
    cache_key = (date, per_paged, paged)

    # One upstream request per cache key at a time, even when many visitors
    # open/refresh the site simultaneously.
    with _matches_cache_lock:
        key_lock = _matches_key_locks.setdefault(cache_key, Lock())

    with key_lock:
        now = time.monotonic()
        with _matches_cache_lock:
            cached = _matches_cache.get(cache_key)
            if cached and now - cached["stored_at"] < MATCHES_CACHE_TTL_SECONDS:
                return cached["payload"]

        params = {"date": date, "per_paged": per_paged, "paged": paged}
        # Intentionally do not forward _nocache: client cache-busters must not
        # force a paid upstream request and defeat the shared cache.

        try:
            response = requests.get(
                "https://cricket-live-line-advance.p.rapidapi.com/matches",
                params=params,
                headers={
                    "X-RapidAPI-Key": api_key,
                    "X-RapidAPI-Host": "cricket-live-line-advance.p.rapidapi.com"
                },
                timeout=20
            )
            response.raise_for_status()
            payload = response.json()
            with _matches_cache_lock:
                _matches_cache[cache_key] = {"stored_at": time.monotonic(), "payload": payload}
                # Keep memory bounded if many dates/pages are requested.
                if len(_matches_cache) > 512:
                    oldest_keys = sorted(_matches_cache, key=lambda key: _matches_cache[key]["stored_at"])
                    for old_key in oldest_keys[:len(_matches_cache) - 384]:
                        _matches_cache.pop(old_key, None)
                        _matches_key_locks.pop(old_key, None)
            return payload
        except requests.RequestException as exc:
            # If the provider quota is temporarily exhausted, keep the site useful
            # by serving the last successful response for up to 30 minutes.
            if cached and now - cached["stored_at"] < MATCHES_STALE_MAX_SECONDS:
                return cached["payload"]
            print(f"Cricket matches provider request failed: {exc}")
            raise HTTPException(status_code=502, detail="Cricket matches provider request failed")
        except ValueError:
            if cached and now - cached["stored_at"] < MATCHES_STALE_MAX_SECONDS:
                return cached["payload"]
            raise HTTPException(status_code=502, detail="Cricket matches provider returned invalid JSON")

@app.post("/predict")
def predict_match(match: MatchRequest, license=Depends(require_license)):
    from licensing import require_match_permission
    require_match_permission(license, match.match_id, match.competition)
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
