#!/usr/bin/env python3
"""One-request-per-run feed snapshot generator; inference math mirrors existing main.py."""
import json, os
from datetime import datetime, timezone
from pathlib import Path
import joblib, numpy as np, pandas as pd, requests
API_KEY=os.environ.get("RAPIDAPI_KEY")
if not API_KEY: raise SystemExit("RAPIDAPI_KEY GitHub Actions secret is missing.")
MODELS=joblib.load("cricket_ensemble_modern.joblib")
ELO=joblib.load("latest_elo_ratings.joblib")
MAPPINGS=joblib.load("category_mappings.joblib")
TOSS_STATS=joblib.load("toss_stats.joblib")
DEFAULT_ELO=1500
TEAM_MAPPING={'Saint Lucia Kings':'St Lucia Kings','Northern Brave':'Northern Districts','Northern Brave Women':'Northern Districts Women','Central Hinds':'Central Districts Women','Sudurpaschim Royals':'Sudur Paschim Royals','Antigua & Barbuda Falcons':'Antigua and Barbuda Falcons','St Kitts & Nevis Patriots':'St Kitts and Nevis Patriots','Canterbury Kings':'Canterbury','Auckland Hearts':'Auckland Women','Canterbury Magicians':'Canterbury Women','Otago Sparks':'Otago Women','Wellington Blaze':'Wellington Women'}
def get_elo(name):
    if name in ELO: return ELO[name]
    for key in ELO:
        if key.lower()==name.lower(): return ELO[key]
    return DEFAULT_ELO
def get_toss_rates(venue, decision):
    v=str(venue).split(',')[0].strip()
    tot=TOSS_STATS['v_tw_tot'].get(v,0); win=TOSS_STATS['v_tw_wins'].get(v,0)
    tw=win/tot if tot>0 else 0.5
    if decision=='bat':
        dt=TOSS_STATS['v_bat_tot'].get(v,0); dw=TOSS_STATS['v_bat_wins'].get(v,0)
    else:
        dt=TOSS_STATS['v_fld_tot'].get(v,0); dw=TOSS_STATS['v_fld_wins'].get(v,0)
    return tw, (dw/dt if dt>0 else 0.5)
def calculate_prediction(fmt,t1,t2,venue,toss_winner,toss_decision):
    e1,e2=get_elo(t1),get_elo(t2); toss_t1=1 if toss_winner==t1 else 0
    venue_clean=str(venue).split(',')[0].strip(); twr,tdr=get_toss_rates(venue_clean,toss_decision)
    row={'match_type':str(fmt),'team1':str(t1),'team2':str(t2),'venue':str(venue_clean),'toss_decision':str(toss_decision),
         'team1_elo':float(e1),'team2_elo':float(e2),'toss_win_team1':int(toss_t1),
         'team1_form':0.60,'team2_form':0.60,'h2h_team1_ratio':0.50,
         'toss_winner_win_rate':float(twr),'toss_decision_win_rate':float(tdr)}
    try:
        df=pd.DataFrame([row])
        for col in ['match_type','team1','team2','venue','toss_decision']:
            if df[col].iloc[0] not in MAPPINGS[col]: df[col]="__UNKNOWN__"
            cats=MAPPINGS[col]
            if "__UNKNOWN__" not in cats: cats=cats+["__UNKNOWN__"]
            df[col]=pd.Categorical(df[col],categories=cats)
        cp=MODELS['cat'].predict_proba(df)[0]; lp=MODELS['lgb'].predict_proba(df)[0]
        probs=(cp+lp)/2.0
        return float(probs[1]),float(probs[0]),False
    except Exception as exc:
        print(f"Fallback model inference: {type(exc).__name__}")
        exp=1/(1+10**((e2-e1)/400))
        return exp,1-exp,True
def match_type(fmt):
    s=str(fmt or 'T20').lower()
    if 'test' in s or 'first class' in s: return 'Test'
    if 'odi' in s or 'list a' in s: return 'ODI'
    return 'T20'
def make_prediction(m):
    raw1=(m.get('teama') or {}).get('name') or ''; raw2=(m.get('teamb') or {}).get('name') or ''
    if not raw1 or not raw2: return None
    t1=TEAM_MAPPING.get(raw1,raw1); t2=TEAM_MAPPING.get(raw2,raw2)
    venue=(m.get('venue') or {}).get('name') or ''; fmt=match_type(m.get('format_str'))
    p1s=[];p2s=[];fallback=False;post={}
    for side,winner in [('t1',t1),('t2',t2)]:
        for decision in ('bat','field'):
            p1,p2,fb=calculate_prediction(fmt,t1,t2,venue,winner,decision)
            p1s.append(p1);p2s.append(p2);fallback=fallback or fb
            post[f'{side}_{decision}']={t1:f'{p1*100:.2f}%',t2:f'{p2*100:.2f}%'}
    return {'pre':{t1:f'{np.mean(p1s)*100:.2f}%',t2:f'{np.mean(p2s)*100:.2f}%'},
            'post_toss':post,'is_default':fallback}
def main():
    today=datetime.now(timezone.utc).date().isoformat()
    r=requests.get('https://cricket-live-line-advance.p.rapidapi.com/matches',
        params={'date':today,'per_paged':50,'paged':1},
        headers={'X-RapidAPI-Key':API_KEY,'X-RapidAPI-Host':'cricket-live-line-advance.p.rapidapi.com'},timeout=25)
    if r.status_code!=200: raise SystemExit(f'Provider request failed HTTP {r.status_code}; prior snapshot left untouched.')
    payload=r.json(); response=payload.get('response') or {}; items=response.get('items')
    if not isinstance(items,list): raise SystemExit('Provider payload missing response.items list; prior snapshot left untouched.')
    for item in items:
        pred=make_prediction(item)
        if pred: item['ai_prediction']=pred
    output={'updated_at':datetime.now(timezone.utc).isoformat(),'provider_date':today,'response':response}
    Path('data').mkdir(exist_ok=True)
    Path('data/matches.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'Generated snapshot for {len(items)} fixtures from one API request.')
if __name__=='__main__': main()
